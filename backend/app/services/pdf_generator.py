"""PDF 생성 서비스 (공적조서)

기본은 WeasyPrint(HTML→PDF), 환경변수 PDF_ENGINE=playwright 면 Playwright 사용.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

from jinja2 import Environment, FileSystemLoader, select_autoescape

from ..config import (
    DEFAULT_INVESTIGATOR,
    DEFAULT_RECOMMENDER_AGENCY,
    GENERATED_DIR,
    PDF_ENGINE,
    TEMPLATE_DIR,
)
from ..models import AwardCase, Recipient


_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def _fmt_date_dot(d: Optional[date]) -> str:
    if not d:
        return ""
    return f"{d.year:04d}.{d.month:02d}.{d.day:02d}."


def _fmt_date_short(d: Optional[date]) -> str:
    if not d:
        return ""
    return f"{d.year % 100:02d}.{d.month:02d}.{d.day:02d}."


def _fmt_date_long(d: Optional[date]) -> str:
    if not d:
        return ""
    return f"{d.year}년 {d.month}월 {d.day}일"


def _pair_two(items: Iterable) -> List[Tuple]:
    items = list(items)
    pairs: List[Tuple] = []
    for i in range(0, len(items), 2):
        left = items[i]
        right = items[i + 1] if i + 1 < len(items) else None
        pairs.append((left, right))
    return pairs


def _award_grade_authority(award_grade: str) -> str:
    """추천 표지 하단 '경기도의회 의장 귀하' 용 권자."""
    if not award_grade:
        return "의장"
    g = award_grade
    if "의장" in g:
        return "의장"
    if "지사" in g:
        return "지사"
    return g.split()[-1]


def _award_grade_short(award_grade: str) -> str:
    if not award_grade:
        return "표창"
    g = award_grade
    for prefix in ["경기도의회 ", "경기도 "]:
        if g.startswith(prefix):
            return g[len(prefix):]
    return g


def build_context(case: AwardCase, recipient: Recipient) -> dict:
    """공적조서 PDF용 Jinja 컨텍스트 구성"""
    mc = recipient.merit_content
    inv_dept = (mc.investigator_department if mc and mc.investigator_department else DEFAULT_INVESTIGATOR["department"])
    inv_pos = (mc.investigator_position if mc and mc.investigator_position else DEFAULT_INVESTIGATOR["position"])
    inv_rank = (mc.investigator_rank if mc and mc.investigator_rank else DEFAULT_INVESTIGATOR["rank"])
    inv_name = (mc.investigator_name if mc and mc.investigator_name else DEFAULT_INVESTIGATOR["name"])

    full_title = case.recommender_full_title or " ".join(
        x for x in [
            DEFAULT_RECOMMENDER_AGENCY,
            case.recommender_department or "",
            case.recommender_position or "",
        ]
        if x
    ).strip()

    ctx = {
        # 추천 정보
        "award_grade": case.award_grade,
        "award_grade_short": _award_grade_short(case.award_grade or ""),
        "award_grade_authority": _award_grade_authority(case.award_grade or ""),
        "recommender_full_title": full_title,
        "recommender_name": case.recommender_name or "",
        "recommender_agency": DEFAULT_RECOMMENDER_AGENCY,
        "recommendation_date": _fmt_date_long(case.recommendation_date),
        "award_date": _fmt_date_dot(case.award_date),
        "award_date_short": _fmt_date_short(case.award_date),
        "recipient_count": len(case.recipients) if case.recipients else 1,

        # 대상자 인적사항
        "recipient_name": recipient.recipient_name or "",
        "chinese_name": recipient.chinese_name or "",
        "birth_date": _fmt_date_dot(recipient.birth_date),
        "address": recipient.address or "",
        "registered_address": getattr(recipient, "registered_address", "") or "",
        "nationality": getattr(recipient, "nationality", "") or "",
        "military_id": getattr(recipient, "military_id", "") or "",
        "occupation": recipient.occupation or "",
        "organization_name": recipient.organization_name or "",
        "recipient_position_title": recipient.recipient_position_title or "",
        "external_title": recipient.external_title or "",
        "merit_category": recipient.merit_category or "",
        "merit_period": recipient.merit_period or "",
        "recommendation_rank": recipient.recommendation_rank or "1순위",
        "rank_field": "",

        # 공적 내용
        "merit_short_summary": (mc.merit_short_summary if mc else "") or "",
        "recommendation_reason": (mc.recommendation_reason if mc else "") or "",
        "full_merit_text": (mc.full_merit_text if mc else "") or "",
        "character_assessment": (mc.character_assessment if mc else "") or "",
        "local_reputation": (mc.local_reputation if mc else "") or "",
        "merit_consistency": (mc.merit_consistency if mc else "") or "공적내용과 일치함",

        # 조사자
        "investigator_department": inv_dept,
        "investigator_position": inv_pos,
        "investigator_rank": inv_rank,
        "investigator_name": inv_name,

        # 경력/표창
        "career_pairs": _pair_two(recipient.career_records or []),
        "award_pairs": _pair_two(recipient.previous_awards or []),
    }
    return ctx


def render_html(case: AwardCase, recipient: Recipient) -> str:
    template = _env.get_template("merit_report.html")
    return template.render(**build_context(case, recipient))


class PDFEngineUnavailable(RuntimeError):
    """PDF 엔진을 사용할 수 없을 때."""


def generate_pdf(case: AwardCase, recipient: Recipient) -> Path:
    """공적조서 PDF 생성 → 파일 경로 반환.

    설정된 엔진 시도 → 실패하면 다른 엔진으로 자동 폴백.
    둘 다 없으면 명확한 안내 메시지로 PDFEngineUnavailable 발생.
    """
    html = render_html(case, recipient)
    file_name = f"02. 공적조서({recipient.recipient_name}).pdf"
    file_path = GENERATED_DIR / file_name

    preferred = PDF_ENGINE.lower()
    order = ["playwright", "weasyprint"] if preferred == "playwright" else ["weasyprint", "playwright"]

    errors = []
    for engine in order:
        try:
            if engine == "playwright":
                _render_with_playwright(html, file_path)
            else:
                _render_with_weasyprint(html, file_path)
            return file_path
        except PDFEngineUnavailable as e:
            errors.append(f"{engine}: {e}")
            continue
        except Exception as e:
            # 엔진은 있지만 렌더링 실패 - 더이상 폴백하지 않고 에러 전파
            raise RuntimeError(f"[{engine}] PDF 렌더링 실패: {e}") from e

    raise PDFEngineUnavailable(
        "사용 가능한 PDF 엔진이 없습니다.\n\n"
        "가장 쉬운 해결: Playwright 설치 (시스템 라이브러리 불필요)\n"
        "    pip install playwright\n"
        "    playwright install chromium\n"
        "그리고 backend/.env 파일에 `PDF_ENGINE=playwright` 추가 후 백엔드 재시작.\n\n"
        "또는 WeasyPrint: macOS는 `brew install pango cairo gdk-pixbuf libffi` 먼저.\n\n"
        f"세부 사유:\n - " + "\n - ".join(errors)
    )


def _render_with_weasyprint(html: str, file_path: Path) -> None:
    try:
        from weasyprint import HTML  # type: ignore
    except Exception as e:
        raise PDFEngineUnavailable(
            f"weasyprint 임포트 실패: {e}"
        ) from e
    HTML(string=html, base_url=str(TEMPLATE_DIR)).write_pdf(str(file_path))


def _render_with_playwright(html: str, file_path: Path) -> None:
    try:
        from playwright.sync_api import sync_playwright  # type: ignore
    except Exception as e:
        raise PDFEngineUnavailable(
            f"playwright 임포트 실패: {e} (pip install playwright && playwright install chromium)"
        ) from e
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            page = browser.new_page()
            page.set_content(html, wait_until="load")
            page.pdf(
                path=str(file_path),
                format="A4",
                margin={"top": "18mm", "right": "18mm", "bottom": "18mm", "left": "18mm"},
                print_background=True,
            )
            browser.close()
    except Exception as e:
        msg = str(e).lower()
        # Chromium 바이너리 자체가 없을 때만 PDFEngineUnavailable로 폴백
        if "executable doesn't exist" in msg or "no such file" in msg:
            raise PDFEngineUnavailable(
                f"playwright chromium 바이너리 없음: {e}"
            ) from e
        # 그 외 (메모리 부족, 권한, 폰트 등)는 원본 에러를 그대로 전파해 진단 가능하게
        raise RuntimeError(f"playwright 렌더링 실패: {e}") from e


def render_html_for_preview(case: AwardCase, recipient: Recipient) -> str:
    """미리보기용 HTML 직접 반환 (PDF로 변환하지 않음)"""
    return render_html(case, recipient)
