"""개인정보 수집·이용 및 제공 동의서 생성 (HWPX 아님 — HTML→PDF).

요구사항(2026-06-09 사용자):
- 표 셀 글자 잘림 없음(HTML 표 자동 높이) · 공적조서와 동일한 경기천년체
- 단어 단위 줄바꿈(word-break: keep-all) · 무조건 1페이지
- '동의함'에만 체크(CSS로 그린 체크박스 — 폰트 글리프 의존 제거)
- 자필 서명을 '(서명 또는 인)' 위에 겹쳐서, 더 진하고 선명하게 표시

엔진은 공적조서와 동일(playwright/weasyprint). 로컬 chromium으로 렌더 검증 가능.
"""
from __future__ import annotations

import base64
import functools
import hashlib
import io
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from PIL import Image, ImageFilter

from ..config import GENERATED_DIR, PDF_ENGINE, TEMPLATE_DIR
from ..models import Recipient
from .pdf_generator import (
    PDFEngineUnavailable,
    _render_with_playwright,
    _render_with_weasyprint,
)

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


@functools.lru_cache(maxsize=1)
def _consent_font_css() -> str:
    """동의서 경기천년 폰트를 file:// URL로 참조(base64 인라인 금지).

    예전엔 OTF를 base64로 HTML에 인라인(11~22MB)해, 상시 워밍된 브라우저도 매 렌더마다
    그 11MB를 다시 파싱하느라 렌더가 ~1.5s였다(병목). file:// URL로 참조하면 브라우저가
    폰트를 1회만 로드·캐시 → 이후 렌더는 ~0.05s. HTML 용량도 작아지고 출력 PDF엔 사용
    글자만 서브셋 임베드돼 파일도 가벼워진다. (브라우저 launch에 --allow-file-access-from-files 필요)
    """
    from .pdf_preview import _FONTS_DIR

    faces = [
        ("경기천년바탕", "normal", "경기천년바탕OTF_Regular.otf"),
        ("경기천년바탕", "bold", "경기천년바탕OTF_Bold.otf"),
        ("경기천년제목", "normal", "경기천년제목OTF_Medium.otf"),
    ]
    css = []
    for family, weight, fname in faces:
        fp = _FONTS_DIR / fname
        if not fp.exists():
            continue
        css.append(
            f"@font-face{{font-family:'{family}';font-weight:{weight};"
            f"src:url('file://{fp.as_posix()}') format('opentype');}}"
        )
    return "".join(css)


def _signature_path(recipient: Recipient) -> Path | None:
    from ..config import SIGNATURE_DIR

    if recipient.signature_path and Path(recipient.signature_path).exists():
        return Path(recipient.signature_path)
    p = SIGNATURE_DIR / f"{recipient.id}.png"
    return p if p.exists() else None


def _signature_data_url(png_path: Path) -> str:
    """서명 PNG을 더 진하고 선명하게 보정 → base64 data URL.

    - 비어 있지 않은 획은 순수 검정으로 + 알파를 키워 진하게
    - MaxFilter로 살짝 두껍게(선명/진하게)
    """
    img = Image.open(png_path).convert("RGBA")
    r, g, b, a = img.split()
    # 알파(획) 두껍게 — 펜 굵기 보강
    a = a.filter(ImageFilter.MaxFilter(3))
    # 반투명 획도 진하게: 일정 이상은 불투명 처리
    a = a.point(lambda v: 255 if v > 40 else int(v * 1.8))
    black = Image.new("L", img.size, 0)
    out = Image.merge("RGBA", (black, black, black, a))
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _department_name(recipient: Recipient) -> str:
    """동의서 머리말·수신처 부서명 — AppSetting.department_name, 기본 보건복지전문위원실."""
    try:
        from ..database import SessionLocal
        from .. import models

        db = SessionLocal()
        try:
            s = db.query(models.AppSetting).first()
            return (s.department_name if s and s.department_name else None) or "보건복지전문위원실"
        finally:
            db.close()
    except Exception:
        return "보건복지전문위원실"


def render_consent_html(recipient: Recipient, when: datetime | None = None) -> str:
    when = when or recipient.signed_at or datetime.now()
    sig_path = _signature_path(recipient)
    signature = _signature_data_url(sig_path) if sig_path else None
    template = _env.get_template("consent.html")
    return template.render(
        name=recipient.recipient_name or "",
        dept=_department_name(recipient),
        year=when.year,
        month=when.month,
        day=when.day,
        signature=signature,
        font_css=_consent_font_css(),
    )


def generate_consent_pdf(recipient: Recipient, when: datetime | None = None) -> Path:
    """동의서 PDF 생성(HTML→PDF). 경로 반환.

    동일 입력(성명·날짜·서명)이면 캐시된 PDF를 즉시 반환해 '동의서 확인' 반복 클릭이
    빠르게 동작하게 한다(크로미움 재실행·폰트 파싱 생략).
    """
    html = render_consent_html(recipient, when)
    out_pdf = GENERATED_DIR / f"개인정보동의서_{recipient.id}.pdf"

    # 캐시 — HTML(서명·데이터 포함) 해시가 같으면 재생성 생략
    key = hashlib.sha256(html.encode("utf-8")).hexdigest()
    meta = out_pdf.with_suffix(".pdf.key")
    if out_pdf.exists() and meta.exists() and meta.read_text(encoding="utf-8").strip() == key:
        return out_pdf

    # 1순위: 상시 워밍된 브라우저 풀(빠름). 실패하면 기존 launch-per-call로 폴백.
    if PDF_ENGINE.lower() == "playwright":
        try:
            from . import browser_pool

            if browser_pool.render_pdf(html, out_pdf):
                try:
                    meta.write_text(key, encoding="utf-8")
                except Exception:
                    pass
                return out_pdf
        except Exception:
            pass

    preferred = PDF_ENGINE.lower()
    order = ["playwright", "weasyprint"] if preferred == "playwright" else ["weasyprint", "playwright"]
    errors = []
    for engine in order:
        try:
            if engine == "playwright":
                _render_with_playwright(html, out_pdf)
            else:
                _render_with_weasyprint(html, out_pdf)
            try:
                meta.write_text(key, encoding="utf-8")
            except Exception:
                pass
            return out_pdf
        except PDFEngineUnavailable as e:
            errors.append(f"{engine}: {e}")
            continue
        except Exception as e:
            raise RuntimeError(f"[{engine}] 동의서 PDF 렌더링 실패: {e}") from e
    raise PDFEngineUnavailable("사용 가능한 PDF 엔진이 없습니다.\n - " + "\n - ".join(errors))
