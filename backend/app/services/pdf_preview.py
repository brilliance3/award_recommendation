"""HWPX → PDF 변환 service (LibreOffice + H2Orestart 사용).

soffice CLI를 subprocess로 호출. 변환 결과를 GENERATED_DIR/preview/ 에 캐싱.
"""
from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path

from ..config import GENERATED_DIR

SOFFICE_BIN = shutil.which("soffice") or "/opt/homebrew/bin/soffice"
NODE_BIN = shutil.which("node") or "node"
RENDER_SCRIPT = Path(__file__).resolve().parents[2] / "render" / "render_svg.mjs"
PREVIEW_DIR = GENERATED_DIR / "preview"
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
_CACHE_DIR = PREVIEW_DIR / "cache"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)
# 렌더 방식이 바뀌면(폰트 임베드 추가 등) 이 값을 올려 옛 캐시를 무효화한다.
_RENDER_VERSION = "2026-06-02-batang-regular-face"


def convert_to_pdf_cached(src_path: Path, engine: str = "soffice") -> Path:
    """미리보기용 PDF 변환 + 내용 해시 캐시.

    소스(HWPX/XLSX) 내용이 같으면 이미 변환해 둔 PDF를 즉시 반환한다(변환 생략).
    대상자 데이터가 바뀌면 소스 바이트가 달라져 자동으로 새로 변환된다.
    배포 서버에서 chromium/soffice 변환이 무거워 첫 변환은 수십 초 걸리므로,
    같은 내용 재조회는 캐시로 즉시 응답해 체감 속도를 크게 높인다.
    engine: 'soffice' | 'rhwp'.
    """
    data = src_path.read_bytes()
    # 캐시 키에 렌더 버전(_RENDER_VERSION)을 넣어, 폰트 임베드 등 렌더 방식이 바뀌면
    # 소스 내용이 같아도 옛 캐시(폰트 깨진 PDF)를 재사용하지 않고 새로 변환한다.
    key = hashlib.sha256(
        (_RENDER_VERSION + "\0" + engine).encode() + b"\0" + data
    ).hexdigest()[:32]
    cached = _CACHE_DIR / f"{key}.pdf"
    if cached.exists() and cached.stat().st_size > 0:
        return cached
    out = convert_to_pdf_rhwp(src_path) if engine == "rhwp" else convert_to_pdf(src_path)
    try:
        shutil.copyfile(out, cached)
        if out != cached:
            try:
                out.unlink(missing_ok=True)
            except Exception:
                pass
        return cached
    except Exception:
        return out  # 캐시 복사 실패 시 원본 반환

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

    token = uuid.uuid4().hex[:8]
    ratio_hwpx = PREVIEW_DIR / f"{src_path.stem}_{token}_preview.hwpx"
    svg_dir = PREVIEW_DIR / f"{src_path.stem}_{token}_svg"
    pdf_path = PREVIEW_DIR / f"{src_path.stem}_{token}.pdf"
    try:
        # 미리보기 전용 장평 보정본 생성(원본 불변)
        _apply_preview_ratio(src_path, ratio_hwpx)

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

        _svgs_to_pdf(svgs, pdf_path)
        return pdf_path
    finally:
        shutil.rmtree(svg_dir, ignore_errors=True)
        ratio_hwpx.unlink(missing_ok=True)  # 미리보기 임시 HWPX 정리


_FONTS_DIR = Path(__file__).resolve().parents[2] / "render" / "fonts"


def _font_face_css() -> str:
    """SVG가 요청하는 경기천년체 패밀리명(경기천년바탕/경기천년제목)을 실제 OTF 파일에
    바인딩하는 @font-face CSS를 base64로 임베드해 반환.

    배포 서버에는 설치 폰트의 패밀리명이 '경기천년바탕OTF'(OTF 접미사)라 SVG의
    '경기천년바탕' 요청과 매칭이 안 돼 Noto로 fallback 되는 문제가 있었다. 시스템 폰트
    매칭에 의존하지 않고 요청 이름 그대로 OTF를 임베드하면 chromium이 정확히 렌더한다.
    """
    import base64

    # (요청 패밀리명, weight, 파일)
    # ' Regular' 접미사 포함명: header.xml 폰트 테이블이 id0을 '경기천년바탕 Regular'로
    # 두므로 rhwp SVG가 그 이름을 그대로 요청한다 → 동일 OTF로 바인딩해야 폰트 미설치
    # 서버에서도 Noto 폴백 없이 렌더된다.
    faces = [
        ("경기천년바탕", "normal", "경기천년바탕OTF_Regular.otf"),
        ("경기천년바탕", "bold", "경기천년바탕OTF_Bold.otf"),
        ("경기천년바탕 Regular", "normal", "경기천년바탕OTF_Regular.otf"),
        ("경기천년바탕 Regular", "bold", "경기천년바탕OTF_Bold.otf"),
        ("경기천년제목", "normal", "경기천년제목OTF_Medium.otf"),
        ("경기천년제목", "bold", "경기천년제목OTF_Bold.otf"),
    ]
    css = []
    for family, weight, fname in faces:
        fp = _FONTS_DIR / fname
        if not fp.exists():
            continue
        b64 = base64.b64encode(fp.read_bytes()).decode()
        css.append(
            f"@font-face{{font-family:'{family}';font-weight:{weight};"
            f"src:url(data:font/otf;base64,{b64}) format('opentype');}}"
        )
    return "".join(css)


def pdf_page_count(pdf_path: Path) -> int:
    """PDF 페이지 수."""
    import pypdfium2 as pdfium

    doc = pdfium.PdfDocument(str(pdf_path))
    try:
        return len(doc)
    finally:
        doc.close()


def pdf_page_png(pdf_path: Path, page_index: int, scale: float = 2.0) -> bytes:
    """PDF의 한 페이지를 PNG 바이트로 렌더(pypdfium2, 시스템 의존 없음).

    미리보기를 '페이지 이미지 + 좌우 화살표'로 보여주기 위해 사용. react-pdf(worker)에
    의존하지 않아 모든 배포 환경에서 동작한다.
    """
    import io

    import pypdfium2 as pdfium

    doc = pdfium.PdfDocument(str(pdf_path))
    try:
        n = len(doc)
        idx = max(0, min(page_index, n - 1))
        bitmap = doc[idx].render(scale=scale)
        pil = bitmap.to_pil()
        buf = io.BytesIO()
        pil.save(buf, format="PNG")
        return buf.getvalue()
    finally:
        doc.close()


def _namespace_svg_ids(svg_text: str, idx: int) -> str:
    """여러 SVG를 한 DOM에 넣을 때 clipPath/filter id 충돌이 없도록 접두사를 붙인다."""
    prefix = f"p{idx}_"
    svg_text = re.sub(
        r'id="([^"]+)"',
        lambda m: f'id="{prefix}{m.group(1)}"',
        svg_text,
    )
    svg_text = re.sub(
        r"url\(#([^)]+)\)",
        lambda m: f"url(#{prefix}{m.group(1)})",
        svg_text,
    )
    return re.sub(
        r'href="#([^"]+)"',
        lambda m: f'href="#{prefix}{m.group(1)}"',
        svg_text,
    )


def _combined_html(svgs) -> str:
    """페이지 SVG 전체를 한 번에 인쇄할 HTML(경기천년체 임베드 1회)."""
    pages = []
    for idx, svg in enumerate(svgs, start=1):
        svg_text = svg.read_text(encoding="utf-8")
        pages.append(f'<div class="page">{_namespace_svg_ids(svg_text, idx)}</div>')
    return (
        '<!doctype html><html><head><meta charset="utf-8"><style>'
        + _font_face_css()  # 경기천년체를 직접 임베드 (시스템 폰트명 매칭 의존 제거)
        + f"@page{{size:{_PAGE_W_PX}px {_PAGE_H_PX}px;margin:0;}}"
        + "*{margin:0;padding:0;box-sizing:border-box;}html,body{background:#fff;}"
        f".page{{width:{_PAGE_W_PX}px;height:{_PAGE_H_PX}px;overflow:hidden;}}"
        ".page + .page{break-before:page;}"
        f"svg{{display:block;width:{_PAGE_W_PX}px;height:{_PAGE_H_PX}px;}}"
        "</style></head><body>"
        + "".join(pages)
        + "</body></html>"
    )


def _svgs_to_pdf(svgs, pdf_path: Path) -> None:
    """페이지 SVG들을 A4 PDF로 합친다(벡터, 텍스트 보존).

    rhwp SVG는 페이지마다 같은 clipPath/filter id를 재사용한다. 여러 SVG를 한 HTML에
    넣기 전에 페이지별 접두사를 붙여 id/url(#id)/href="#id" 참조 충돌을 막는다.
    """
    from playwright.sync_api import sync_playwright

    html = _combined_html(svgs)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            page.set_default_timeout(60000)
            page.set_content(html, wait_until="load")
            # 임베드 경기천년체 로드 완료까지 대기(미완 시 fallback 박힘 방지)
            try:
                page.wait_for_function(
                    "document.fonts.status === 'loaded'", timeout=10000
                )
            except Exception:
                page.wait_for_timeout(1000)
            pdf_bytes = page.pdf(prefer_css_page_size=True, print_background=True)
        finally:
            browser.close()
    pdf_path.write_bytes(pdf_bytes)


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
    # 전용 LibreOffice 프로파일 디렉토리. 한 번 만들어 재사용하면 매 호출마다 프로파일을
    # 새로 초기화(H2Orestart 로딩 포함)하지 않아 두 번째 변환부터 크게 빨라진다. 또한
    # 동시 호출 시 기본 프로파일 lock 충돌로 멈추는 것을 막는다.
    # 경로에 공백·한글이 있으면 file:// URI가 깨져 LibreOffice가 Abort 하므로(로컬 맥의
    # '클로드 코드' 경로), 공백·비ASCII 없는 임시경로에 둔다. 배포(/data)는 영향 없음.
    import tempfile

    profile_dir = Path(tempfile.gettempdir()) / "award_soffice_profile"
    profile_uri = "file://" + str(profile_dir)
    # 옵션은 최소로. --nologo/--nofirststartwizard/--norestore 는 일부 LibreOffice
    # 버전에서 Abort trap 충돌을 일으키므로 쓰지 않는다. 전용 프로파일만 지정.
    result = subprocess.run(
        [
            SOFFICE_BIN,
            f"-env:UserInstallation={profile_uri}",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(out_dir),
            str(hwpx_path),
        ],
        capture_output=True,
        text=True,
        timeout=300,  # 첫 변환은 프로파일 초기화로 느릴 수 있어 넉넉히
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
