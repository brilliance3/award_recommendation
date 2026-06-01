"""XLSX 생성 서비스
- 01. 공적개요서.xlsx
- 03. 표창대상자.xlsx
"""
from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from typing import List

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from ..config import GENERATED_DIR
from ..models import AwardCase, Recipient


def _extract_region_from_address(address: str | None) -> str:
    """주소에서 'OO시' 추출 — 예: '경기도 수원시 영통구 ...' -> '수원시'.
    '서울특별시'/'부산광역시' 등은 '서울'/'부산'으로 축약."""
    if not address:
        return ""
    m = re.search(r"[가-힣]+시", address)
    if not m:
        return ""
    region = m.group()
    for suffix in ("특별시", "광역시", "특별자치시"):
        if suffix in region:
            return region.replace(suffix, "")
    return region


def _yymmdd_from_birth_date(d) -> str:
    if not d or not isinstance(d, date):
        return ""
    return f"{d.year % 100:02d}{d.month:02d}{d.day:02d}"

_THIN = Side(border_style="thin", color="000000")
_BORDER = Border(left=_THIN, right=_THIN, top=_THIN, bottom=_THIN)
_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
_LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)
_HDR_FILL = PatternFill("solid", fgColor="F3F4F6")


def _fmt_date_dot(d) -> str:
    if not d:
        return ""
    if isinstance(d, date):
        return f"{d.year:04d}.{d.month:02d}.{d.day:02d}."
    return str(d)


def _merit_overview_text(recipient: Recipient) -> str:
    mc = recipient.merit_content
    if not mc:
        return ""
    lines = []
    for idx, key in enumerate(
        ["merit_overview_1", "merit_overview_2", "merit_overview_3", "merit_overview_4"],
        start=1,
    ):
        val = getattr(mc, key) or ""
        if val.strip():
            lines.append(f"{idx}. {val.strip()}")
    return "\n".join(lines)


def generate_merit_overview_xlsx(case: AwardCase) -> Path:
    """01. 공적개요서.xlsx 생성"""
    wb = Workbook()
    ws = wb.active
    ws.title = "공적개요서"

    # 제목
    ws.merge_cells("A1:G1")
    ws["A1"] = "공 적 개 요 서"
    ws["A1"].font = Font(size=18, bold=True)
    ws["A1"].alignment = _CENTER
    ws.row_dimensions[1].height = 36

    headers = ["연번", "단체명", "성 명\n(생년월일)", "공적분야", "추천훈격", "직위", "공 적 개 요"]
    for col, h in enumerate(headers, start=1):
        cell = ws.cell(row=3, column=col, value=h)
        cell.font = Font(bold=True)
        cell.alignment = _CENTER
        cell.fill = _HDR_FILL
        cell.border = _BORDER
    ws.row_dimensions[3].height = 36

    # 컬럼 폭
    widths = [6, 14, 18, 14, 14, 10, 50]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    row = 4
    for r in case.recipients or []:
        name_dob = f"{r.recipient_name}\n({_fmt_date_dot(r.birth_date)})"
        values = [
            r.sequence_no or row - 3,
            r.organization_name or "",
            name_dob,
            r.merit_category or "",
            case.award_grade or "",
            r.recipient_position_title or "",
            _merit_overview_text(r),
        ]
        for col, v in enumerate(values, start=1):
            cell = ws.cell(row=row, column=col, value=v)
            cell.alignment = _CENTER if col != 7 else _LEFT
            cell.border = _BORDER
        ws.row_dimensions[row].height = 110
        row += 1

    suffix = case.recommender_name or "추천자"
    file_name = f"01. 공적개요서({suffix} 의원).xlsx"
    file_path = GENERATED_DIR / file_name
    wb.save(file_path)
    return file_path


def generate_recipient_list_xlsx(case: AwardCase) -> Path:
    """03. 표창대상자.xlsx 생성"""
    wb = Workbook()
    ws = wb.active
    ws.title = "표창대상자"

    # 가로로 긴 표 → 가로(landscape) 방향 + 너비를 한 페이지에 맞춤 (PDF 변환·인쇄 시)
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True

    # 제목
    year = (case.award_date.year if case.award_date else date.today().year)
    title = f"{year}년도 {case.award_grade or '표창'} 추천자 명단"
    ws.merge_cells("A1:N1")
    ws["A1"] = title
    ws["A1"].font = Font(size=14, bold=True)
    ws["A1"].alignment = _CENTER
    ws.row_dimensions[1].height = 28

    # 상단 헤더 (행 2: 연번 / 추천자(B:D) / E:M 병합(빈) / 비고)
    # — 샘플 파일과 동일한 병합 구조. 지역·주소·대상자 하위 헤더는 모두 행 3에 위치
    ws.merge_cells("A2:A3")
    ws["A2"] = "연번"
    ws.merge_cells("B2:D2")
    ws["B2"] = "추천자"
    ws.merge_cells("E2:M2")
    ws.merge_cells("N2:N3")
    ws["N2"] = "비고"

    subheaders = {
        "B3": "소속",
        "C3": "직위",
        "D3": "성명",
        "E3": "지역",
        "F3": "주소",
        "G3": "소속",
        "H3": "직위및직명",
        "I3": "성명",
        "J3": "생년월일\n(6자리)",
        "K3": "공적분야",
        "L3": "공적기간",
        "M3": "표창일",
    }
    for k, v in subheaders.items():
        ws[k] = v

    for col in range(1, 15):
        for row in (2, 3):
            cell = ws.cell(row=row, column=col)
            cell.font = Font(bold=True)
            cell.alignment = _CENTER
            cell.fill = _HDR_FILL
            cell.border = _BORDER
    ws.row_dimensions[2].height = 22
    ws.row_dimensions[3].height = 28

    widths = [5, 14, 10, 10, 8, 28, 18, 14, 10, 12, 16, 10, 12, 16]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    row = 4
    for r in case.recipients or []:
        award_dt = case.award_date  # date 객체 — 엑셀에서 날짜 셀로 표시
        # 추천자 소속·직위는 case에 저장된 값(설정 탭에서 정해짐) 사용
        recommender_dept = case.recommender_department or ""
        recommender_pos = case.recommender_position or "위원"
        region = r.region or _extract_region_from_address(r.address)
        birth_yymmdd = r.birth_yymmdd or _yymmdd_from_birth_date(r.birth_date)
        values = [
            r.sequence_no or row - 3,
            recommender_dept,
            recommender_pos,
            case.recommender_name or "",
            region,
            r.address or "",
            r.organization_name or "",
            r.recipient_position_title or "",
            r.recipient_name or "",
            birth_yymmdd,
            r.merit_category or "",
            r.merit_period or "",
            award_dt if award_dt else "",
            r.note or "",
        ]
        for col, v in enumerate(values, start=1):
            cell = ws.cell(row=row, column=col, value=v)
            cell.alignment = _CENTER if col != 6 else _LEFT
            cell.border = _BORDER
            if col == 13 and award_dt:
                cell.number_format = "yyyy-mm-dd"
        ws.row_dimensions[row].height = 24
        row += 1

    # 파일명 규칙: 03. 표창대상자(000 의원 추천_홍길동 등 N인).xlsx
    recommender = case.recommender_name or "추천자"
    recipients: List[Recipient] = list(case.recipients or [])
    first_name = recipients[0].recipient_name if recipients else "대상자"
    n = len(recipients) or 1
    file_name = f"03. 표창대상자({recommender} 의원 추천_{first_name} 등 {n}인).xlsx"
    file_path = GENERATED_DIR / file_name
    wb.save(file_path)
    return file_path
