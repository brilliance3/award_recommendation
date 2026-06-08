"""개인정보 수집·이용 및 제공 동의서 생성 + 자필 서명 합성.

흐름:
1. 동의서_template.hwpx 의 section0.xml 텍스트를 채운다(성명·날짜·동의함 체크).
2. soffice 로 PDF 변환.
3. pdf_seal 과 동일한 방식으로 '대상자 성명' 줄의 빈칸에 서명 PNG 를 오버레이.

서명 원본 PNG 는 storage/signatures/<recipient_id>.png (신청 시 저장됨).
"""
from __future__ import annotations

import io
import zipfile
from datetime import datetime
from pathlib import Path

import pdfplumber
from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from ..config import GENERATED_DIR, SIGNATURE_DIR, TEMPLATE_DIR
from ..models import Recipient
from . import pdf_preview

CONSENT_TEMPLATE = TEMPLATE_DIR / "동의서_template.hwpx"


def _fill_section(xml: str, name: str, when: datetime) -> str:
    """동의서 본문 텍스트 채우기 — 단일 run 문자열을 직접 치환."""
    # 두 항목 모두 '동의함'에 체크(수집·이용 / 제3자 제공)
    xml = xml.replace("동의함 ☐", "동의함 ☑")
    # 날짜 — "20          년          월          일" → 실제 동의일
    xml = xml.replace(
        "20          년          월          일",
        f"{when.year}년    {when.month}월    {when.day}일",
    )
    # 대상자 성명 — 빈칸 앞에 인쇄(서명 이미지는 PDF 단계에서 그 뒤 빈칸에 합성)
    xml = xml.replace("대상자 성명 :", f"대상자 성명 :  {name}", 1)
    return xml


def generate_consent_hwpx(recipient: Recipient, when: datetime | None = None) -> Path:
    """동의서 HWPX 생성(성명·날짜·동의 체크 반영). 경로 반환."""
    when = when or recipient.signed_at or datetime.now()
    with zipfile.ZipFile(CONSENT_TEMPLATE, "r") as z:
        section = z.read("Contents/section0.xml").decode("utf-8")
    section = _fill_section(section, recipient.recipient_name or "", when)

    out_path = GENERATED_DIR / f"개인정보동의서_{recipient.id}.hwpx"
    with zipfile.ZipFile(CONSENT_TEMPLATE, "r") as zin:
        with zipfile.ZipFile(out_path, "w") as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "Contents/section0.xml":
                    data = section.encode("utf-8")
                if item.filename == "mimetype":
                    zout.writestr(item, data, compress_type=zipfile.ZIP_STORED)
                else:
                    zout.writestr(item, data, compress_type=zipfile.ZIP_DEFLATED)
    return out_path


def _signature_path(recipient: Recipient) -> Path | None:
    """저장된 서명 PNG 경로 — 컬럼값 우선, 없으면 규칙 경로로 폴백."""
    if recipient.signature_path and Path(recipient.signature_path).exists():
        return Path(recipient.signature_path)
    p = SIGNATURE_DIR / f"{recipient.id}.png"
    return p if p.exists() else None


def _overlay_signature(input_pdf: Path, output_pdf: Path, sig_png: Path) -> Path:
    """'대상자 성명' 줄의 인쇄 성명과 '(서명 또는 인)' 사이 빈칸에 서명 이미지를 그린다."""
    sig_img = Image.open(sig_png).convert("RGBA")
    sig_w, sig_h = sig_img.size
    aspect = sig_w / sig_h if sig_h else 3.0
    sig_buf = io.BytesIO()
    sig_img.save(sig_buf, format="PNG")
    sig_buf.seek(0)

    overlay_buf = io.BytesIO()
    c = canvas.Canvas(overlay_buf)
    with pdfplumber.open(input_pdf) as pdf:
        for page in pdf.pages:
            c.setPageSize((page.width, page.height))
            words = page.extract_words(use_text_flow=True)
            # '(서명' 이 있는 줄 = 서명란. 그 중 '대상자' 가 같은 줄에 있는 첫 줄만 사용.
            target = None
            for w in words:
                if not w["text"].startswith("(서명"):
                    continue
                line = [ww for ww in words if abs(ww["top"] - w["top"]) < 5]
                if any("대상자" in ww["text"] for ww in line):
                    target = (w, line)
                    break
            if target:
                sign_word, line = target
                # 왼쪽 경계 = 줄에서 '(서명' 직전 단어의 오른쪽 끝(인쇄된 성명 뒤)
                lefts = [ww["x1"] for ww in line if ww["x1"] <= sign_word["x0"]]
                left = max(lefts) if lefts else sign_word["x0"] - 140
                right = sign_word["x0"]
                top, bottom = sign_word["top"], sign_word["bottom"]
                line_h = bottom - top
                gap = max(right - left - 6, 30)
                # 서명 높이는 줄 높이의 약 2.6배, 폭은 비율 유지하되 빈칸을 넘지 않음
                h = line_h * 2.6
                w_img = min(h * aspect, gap)
                h = w_img / aspect if aspect else h
                x = left + 4
                y_bottom = page.height - bottom - (h - line_h) / 2
                c.drawImage(
                    ImageReader(sig_buf),
                    x,
                    y_bottom,
                    width=w_img,
                    height=h,
                    mask="auto",
                    preserveAspectRatio=True,
                )
                sig_buf.seek(0)
            c.showPage()
    c.save()
    overlay_buf.seek(0)

    src = PdfReader(input_pdf)
    overlay = PdfReader(overlay_buf)
    writer = PdfWriter()
    for i, page in enumerate(src.pages):
        if i < len(overlay.pages):
            page.merge_page(overlay.pages[i])
        writer.add_page(page)
    with open(output_pdf, "wb") as f:
        writer.write(f)
    return output_pdf


def generate_consent_pdf(recipient: Recipient, when: datetime | None = None) -> Path:
    """동의서 PDF 생성 — 본문 채움 + 자필 서명 합성(서명 있을 때만)."""
    hwpx = generate_consent_hwpx(recipient, when)
    base_pdf = pdf_preview.convert_to_pdf(hwpx)
    sig_png = _signature_path(recipient)
    out_pdf = GENERATED_DIR / f"개인정보동의서_{recipient.id}.pdf"
    if sig_png:
        return _overlay_signature(base_pdf, out_pdf, sig_png)
    # 서명 없으면 변환본 그대로 저장 위치로 복사
    out_pdf.write_bytes(Path(base_pdf).read_bytes())
    return out_pdf
