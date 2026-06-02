"""PDF에 도장 이미지를 오버레이.

흐름:
1. 원본 PDF에서 pdfplumber로 "(인)" 텍스트 좌표 추출
2. 도장 종류 판별 (추천관 = 의원 도장 / 조사자 = 이호준 도장)
3. reportlab으로 각 (인) 자리에 도장 이미지를 그린 빈 PDF 생성
4. pypdf로 원본 페이지와 도장 페이지를 merge
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import List, Optional, Tuple

import pdfplumber
from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from ..config import SEAL_DIR

# 도장 출력 크기 (pt, 1cm ≈ 28.35pt). 양식 (인) 글자 크기에 자연스러운 약 1.5cm.
SEAL_SIZE_PT = 42


def _resolve_seal_path(filename: Optional[str]) -> Optional[Path]:
    if not filename:
        return None
    p = SEAL_DIR / filename
    return p if p.exists() else None


def _load_seal_image(path: Path) -> io.BytesIO:
    """PIL로 도장 이미지 로드 → 흰 배경을 투명으로 변환 + PNG.

    도장은 over=True로 (인) 글자 위에 그려지므로, 도장의 흰 배경이 글자를 가리지 않도록
    임계치 이상 밝은 픽셀은 알파 0 처리. 빨간 인주만 남고 (인)/표 셀이 도장 너머로 보임.
    """
    img = Image.open(path).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = pixels[x, y]
            # 흰색/매우 밝은 회색 → 투명
            if r > 210 and g > 210 and b > 210:
                pixels[x, y] = (255, 255, 255, 0)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def _classify_seal_target(line_text: str, investigator_name: str) -> str:
    """(인)이 포함된 라인 텍스트로 어떤 도장인지 판별.

    반환:
      - 'recommender': 추천 의원 도장
      - 'investigator': 조사자 도장
      - 'unknown': 위치는 알지만 어느 도장인지 모름 → 도장 안 박음
    """
    # 양식 텍스트가 "추 천 관", "이 호 준" 처럼 글자 사이 공백이 들어가므로 공백 제거 후 비교.
    t = (line_text or "").replace(" ", "")
    if "추천관" in t or "추천(의뢰)자" in t:
        return "recommender"
    # 본문 표 (19)성명/현지조사 성명 줄에 조사자 이름이 있으면 조사자 도장
    inv = (investigator_name or "").replace(" ", "")
    if inv and inv in t:
        return "investigator"
    return "unknown"


def stamp_pdf(
    input_pdf: Path,
    output_pdf: Path,
    recommender_name: Optional[str],
    recommender_seal_filename: Optional[str] = None,
    investigator_seal_filename: Optional[str] = None,
    investigator_name: str = "",
) -> Path:
    """input_pdf의 (인) 텍스트 위에 의원/조사자 도장 오버레이.

    도장 파일명·조사자 이름은 호출부(documents.py)에서 DB(Legislator/AppSetting) 조회 후 전달.
    반환: (출력 PDF 경로, 실제로 찍힌 도장 개수). 개수 0이면 '(인)' 미검출 또는 도장 미설정.
    """
    recommender_seal = _resolve_seal_path(recommender_seal_filename)
    investigator_seal = _resolve_seal_path(investigator_seal_filename)

    # 1) 페이지별 도장 좌표 수집
    page_marks: List[List[Tuple[float, float, float, float, str]]] = []
    page_sizes: List[Tuple[float, float]] = []
    with pdfplumber.open(input_pdf) as pdf:
        for page in pdf.pages:
            marks: List[Tuple[float, float, float, float, str]] = []
            words = page.extract_words(use_text_flow=True)
            for w in words:
                if w["text"] != "(인)":
                    continue
                # 같은 줄 텍스트 컨텍스트로 도장 종류 판별 (top 좌표 ±5pt)
                line_words = [
                    ww for ww in words if abs(ww["top"] - w["top"]) < 5
                ]
                line_text = " ".join(ww["text"] for ww in line_words)
                target = _classify_seal_target(line_text, investigator_name)
                marks.append(
                    (w["x0"], w["x1"], w["top"], w["bottom"], target)
                )
            page_marks.append(marks)
            page_sizes.append((page.width, page.height))

    # 2) 도장 PDF 생성 (원본과 동일한 페이지 크기, 같은 페이지 수)
    applied = 0  # 실제로 찍힌 도장 수(도장 없는 성공 방지용)
    overlay_buf = io.BytesIO()
    c = canvas.Canvas(overlay_buf, pagesize=A4)
    for page_idx, marks in enumerate(page_marks):
        pw, ph = page_sizes[page_idx]
        c.setPageSize((pw, ph))
        for x0, x1, top, bottom, target in marks:
            if target == "recommender":
                seal_path = recommender_seal
            elif target == "investigator":
                seal_path = investigator_seal
            else:
                continue
            if seal_path is None:
                continue
            applied += 1
            # (인) 박스 중심 좌표
            cx = (x0 + x1) / 2
            cy_top = (top + bottom) / 2
            # reportlab 좌표 = 좌하단 원점이므로 변환
            y_reportlab = ph - cy_top
            # 도장은 (인) 중심에 정사각형으로 배치
            size = SEAL_SIZE_PT
            seal_buf = _load_seal_image(seal_path)
            c.drawImage(
                ImageReader(seal_buf),
                cx - size / 2,
                y_reportlab - size / 2,
                width=size,
                height=size,
                mask="auto",
                preserveAspectRatio=True,
            )
        c.showPage()
    c.save()
    overlay_buf.seek(0)

    # 3) 원본 + 오버레이 merge — over=True (도장이 최상위).
    # 도장 이미지의 흰 배경이 _load_seal_image에서 투명 처리되었으므로 (인) 글자와
    # 셀 배경이 도장 너머로 자연스럽게 보임. 진짜 종이 도장 효과.
    src = PdfReader(input_pdf)
    overlay = PdfReader(overlay_buf)
    writer = PdfWriter()
    for i, page in enumerate(src.pages):
        if i < len(overlay.pages):
            page.merge_page(overlay.pages[i])
        writer.add_page(page)
    with open(output_pdf, "wb") as f:
        writer.write(f)
    return output_pdf, applied
