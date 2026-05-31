"""HWPX → PDF 변환 service (LibreOffice + H2Orestart 사용).

soffice CLI를 subprocess로 호출. 변환 결과를 GENERATED_DIR/preview/ 에 캐싱.
"""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from ..config import GENERATED_DIR

SOFFICE_BIN = shutil.which("soffice") or "/opt/homebrew/bin/soffice"
NODE_BIN = shutil.which("node") or "node"
RENDER_SCRIPT = Path(__file__).resolve().parents[2] / "render" / "render_svg.mjs"
PREVIEW_DIR = GENERATED_DIR / "preview"
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

# 한글(한컴) A4 한 페이지의 픽셀 크기(96dpi). rhwp가 내는 SVG의 width/height와 동일.
_PAGE_W_PX = 793.7066666666667
_PAGE_H_PX = 1122.48

# rhwp 렌더 엔진은 한글/한자를 1.0em(정사각형)으로 레이아웃하지만, 실제 경기천년바탕은
# 한글 0.91em·한자 0.92em이다. 그대로 두면 rhwp가 한글보다 넓게 잡아 줄/페이지가 어긋난다
# (긴 공적사항이 한 줄 더 생겨 페이지가 늘어남). 미리보기 전용 HWPX의 글자 장평을 줄여
# rhwp 레이아웃을 실제 폰트 폭에 맞춘다 → 한글과 줄바꿈·페이지가 일치.
# 89/90: 본문표를 블록 표(treatAsChar=0, 아래 참조)로 바꾸면 표가 인라인보다 세로로 약간
#   더 차지해 긴 케이스가 한 줄 밀리므로, 그 1줄을 흡수하도록 장평을 91/92에서 추가로 낮춤.
#   (다운로드본은 원본 장평 100%라 한글 출력에는 영향 없음. 미리보기 글자만 미세하게 좁음.)
_HANGUL_RATIO = "89"
_HANJA_RATIO = "90"


def _apply_preview_ratio(src_hwpx: Path, dst_hwpx: Path) -> None:
    """미리보기 전용: header.xml charPr의 한글/한자 장평을 줄여 rhwp 레이아웃을 실제 폰트
    폭에 맞춘다. 원본(다운로드본)은 건드리지 않으므로 한글 출력에는 영향이 없다."""
    import zipfile as _zip
    from lxml import etree

    H = "{http://www.hancom.co.kr/hwpml/2011/head}"
    P = "{http://www.hancom.co.kr/hwpml/2011/paragraph}"
    with _zip.ZipFile(src_hwpx) as zin:
        items = zin.infolist()
        datas = {it.filename: zin.read(it.filename) for it in items}
    try:
        root = etree.fromstring(datas["Contents/header.xml"])
        for cp in root.iter(H + "charPr"):
            r = cp.find(H + "ratio")
            if r is not None:
                r.set("hangul", _HANGUL_RATIO)
                r.set("hanja", _HANJA_RATIO)
        datas["Contents/header.xml"] = etree.tostring(
            root, xml_declaration=True, encoding="UTF-8", standalone=True
        )
    except Exception:
        pass  # header 파싱 실패 시 원본 그대로 렌더(폴백)
    try:
        # 본문표(44셀)를 인라인(글자처럼)→블록 표로 바꿔 표 직후 각주("* 대외직명란…")가
        # 표와 겹치지 않게 한다. 한글은 인라인이라도 정상이지만 rhwp는 인라인 표 다음
        # 텍스트를 표 높이만큼 못 내려 표 위에 겹쳐 그린다. 미리보기 전용 처리.
        sroot = etree.fromstring(datas["Contents/section0.xml"])
        for tbl in sroot.iter(P + "tbl"):
            if len(tbl.findall(".//" + P + "tc")) == 44:
                pos = tbl.find(P + "pos")
                if pos is not None:
                    pos.set("treatAsChar", "0")
        datas["Contents/section0.xml"] = etree.tostring(
            sroot, xml_declaration=True, encoding="UTF-8", standalone=True
        )
    except Exception:
        pass
    with _zip.ZipFile(dst_hwpx, "w") as zout:
        for it in items:
            ct = _zip.ZIP_STORED if it.filename == "mimetype" else _zip.ZIP_DEFLATED
            zout.writestr(it, datas[it.filename], compress_type=ct)


def convert_to_pdf_rhwp(src_path: Path) -> Path:
    """HWPX → PDF (rhwp WASM 렌더 → chromium 인쇄). 한컴 한글과 동일한 페이지 분할.

    soffice 경로(convert_to_pdf)는 줄 높이가 한글과 달라 페이지가 어긋난다. 공적조서(02)
    처럼 한글 레이아웃이 그대로 보여야 하는 문서는 이 함수를 쓴다.
    1) 미리보기 전용 장평 보정 → 2) render/render_svg.mjs(@rhwp/core)로 페이지별 SVG 렌더
    → 3) chromium으로 A4 PDF.
    """
    if not src_path.exists():
        raise FileNotFoundError(src_path)
    if not RENDER_SCRIPT.exists():
        raise RuntimeError(f"렌더 스크립트를 찾을 수 없습니다: {RENDER_SCRIPT}")

    # 미리보기 전용 장평 보정본 생성(원본 불변)
    ratio_hwpx = PREVIEW_DIR / (src_path.stem + "_preview.hwpx")
    _apply_preview_ratio(src_path, ratio_hwpx)

    svg_dir = PREVIEW_DIR / (src_path.stem + "_svg")
    if svg_dir.exists():
        shutil.rmtree(svg_dir, ignore_errors=True)
    result = subprocess.run(
        [NODE_BIN, str(RENDER_SCRIPT), str(ratio_hwpx), str(svg_dir)],
        capture_output=True,
        text=True,
        timeout=120,
        cwd=str(RENDER_SCRIPT.parent),
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"rhwp 렌더 실패: {result.stderr or result.stdout or '(no output)'}"
        )
    svgs = sorted(svg_dir.glob("page_*.svg"))
    if not svgs:
        raise RuntimeError("rhwp가 렌더한 페이지가 없습니다")

    pdf_path = PREVIEW_DIR / (src_path.stem + ".pdf")
    _svgs_to_pdf(svgs, pdf_path)
    shutil.rmtree(svg_dir, ignore_errors=True)
    ratio_hwpx.unlink(missing_ok=True)  # 미리보기 임시 HWPX 정리
    return pdf_path


def _svgs_to_pdf(svgs, pdf_path: Path) -> None:
    """페이지 SVG들을 A4 PDF로 합친다 (chromium 인쇄, 페이지당 SVG 1장)."""
    from playwright.sync_api import sync_playwright

    parts = [
        f'<div class="page">{s.read_text(encoding="utf-8")}</div>' for s in svgs
    ]
    html = (
        '<!doctype html><html><head><meta charset="utf-8"><style>'
        "*{margin:0;padding:0;box-sizing:border-box;}"
        "@page{size:A4;margin:0;}"
        f".page{{width:{_PAGE_W_PX}px;height:{_PAGE_H_PX}px;overflow:hidden;"
        "page-break-after:always;}"
        ".page:last-child{page-break-after:auto;}"
        f"svg{{display:block;width:{_PAGE_W_PX}px;height:{_PAGE_H_PX}px;}}"
        "</style></head><body>" + "".join(parts) + "</body></html>"
    )
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            page.set_content(html, wait_until="networkidle")
            page.pdf(
                path=str(pdf_path),
                prefer_css_page_size=True,
                print_background=True,
            )
        finally:
            browser.close()


def convert_to_pdf(src_path: Path) -> Path:
    """HWPX/XLSX 등 → 같은 폴더에 PDF 생성. soffice headless 호출."""
    hwpx_path = src_path
    if not hwpx_path.exists():
        raise FileNotFoundError(hwpx_path)
    if not Path(SOFFICE_BIN).exists():
        raise RuntimeError(
            f"soffice 명령을 찾을 수 없습니다 ({SOFFICE_BIN}). "
            "LibreOffice 설치 + H2Orestart 활성화가 필요합니다."
        )

    out_dir = PREVIEW_DIR
    env = os.environ.copy()
    env.setdefault("HOME", str(Path.home()))
    result = subprocess.run(
        [
            SOFFICE_BIN,
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(out_dir),
            str(hwpx_path),
        ],
        capture_output=True,
        text=True,
        timeout=120,
        env=env,
    )
    pdf_path = out_dir / (hwpx_path.stem + ".pdf")
    if not pdf_path.exists():
        raise RuntimeError(
            f"PDF 변환 실패: {result.stderr or result.stdout or '(no output)'}"
        )
    return pdf_path


def strip_blank_pages(pdf_path: Path) -> Path:
    """PDF에서 내용이 없는(페이지 번호만 있는) 빈 페이지를 제거.

    LibreOffice가 표/문단을 페이지 경계에 배치하며 끝에 빈 페이지를 만드는 경우가 있어
    02 공적조서처럼 대상자마다 빈 페이지가 끼는 것을 후처리로 정리한다.
    숫자·공백을 뺀 '의미 있는 글자'가 3자 미만이면 빈 페이지로 간주.
    """
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(str(pdf_path))
    if len(reader.pages) <= 1:
        return pdf_path
    writer = PdfWriter()
    for page in reader.pages:
        text = page.extract_text() or ""
        meaningful = "".join(c for c in text if not c.isdigit() and not c.isspace())
        if len(meaningful) < 3:
            continue
        writer.add_page(page)
    if len(writer.pages) == 0:  # 전부 빈 페이지로 판정되면 원본 유지(오판 방지)
        return pdf_path
    with open(pdf_path, "wb") as f:
        writer.write(f)
    return pdf_path
