"""상시 워밍된 Chromium 1개로 HTML→PDF를 빠르게 렌더.

playwright sync API는 스레드 고정(thread-affine)이라 FastAPI 스레드풀에서 매 요청 브라우저를
새로 띄우면 느리다(작은 인스턴스에서 수 초). 전용 워커 스레드 1개가 브라우저를 계속 들고,
렌더 요청을 큐로 받아 처리 → 첫 1회만 실행 비용, 이후 워밍 상태로 ~수백 ms.

브라우저 미가용/충돌 시 호출부가 None/예외로 받아 기존 launch-per-call로 폴백한다.
"""
from __future__ import annotations

import queue
import threading
from pathlib import Path

_req_q: "queue.Queue" = queue.Queue()
_worker: threading.Thread | None = None
_start_lock = threading.Lock()
_worker_failed = False


def _worker_loop() -> None:
    global _worker_failed
    try:
        from playwright.sync_api import sync_playwright

        pw = sync_playwright().start()
        browser = pw.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"])
    except Exception:
        _worker_failed = True
        # 큐에 쌓인 요청을 모두 실패 처리
        while True:
            try:
                _, _, holder, done = _req_q.get_nowait()
                holder["err"] = RuntimeError("browser pool unavailable")
                done.set()
            except queue.Empty:
                return

    while True:
        html, out_path, holder, done = _req_q.get()
        page = None
        try:
            page = browser.new_page()
            page.set_content(html, wait_until="load")
            page.pdf(
                path=str(out_path),
                format="A4",
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                print_background=True,
            )
            holder["ok"] = True
        except Exception as e:  # 렌더 실패 — 브라우저가 죽었을 수 있음
            holder["err"] = e
            try:
                # 브라우저 재기동 시도(다음 요청을 위해)
                if not browser.is_connected():
                    browser = pw.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"])
            except Exception:
                _worker_failed = True
        finally:
            if page is not None:
                try:
                    page.close()
                except Exception:
                    pass
            done.set()


def render_pdf(html: str, out_path: Path, timeout: float = 40.0) -> bool:
    """워밍된 브라우저로 렌더. 성공 True. 풀 미가용이면 RuntimeError(호출부가 폴백)."""
    global _worker
    if _worker_failed:
        raise RuntimeError("browser pool unavailable")
    with _start_lock:
        if _worker is None:
            _worker = threading.Thread(target=_worker_loop, daemon=True, name="pdf-browser-pool")
            _worker.start()
    holder: dict = {}
    done = threading.Event()
    _req_q.put((html, out_path, holder, done))
    if not done.wait(timeout=timeout):
        raise RuntimeError("browser pool render timeout")
    if holder.get("err"):
        raise holder["err"]
    return bool(holder.get("ok"))
