"""HWPX(한글 OWPML) 형식의 공적조서 생성 서비스.

베이스 OWPML 템플릿(`templates/hwpx_base/`)을 복사한 뒤
section0.xml 만 Jinja2 로 렌더링해서 교체하고
ZIP(mimetype-first, uncompressed)로 패키징한다.

복잡한 표 서식 대신 텍스트 기반 단순 레이아웃으로 출력 — 한글에서 열어 추가 편집 가능.
미리보기/뷰어는 프론트엔드 @rhwp/core (WASM) 를 사용한다.
"""
from __future__ import annotations

import io
import re
import shutil
import zipfile
from datetime import date, datetime
from pathlib import Path
from typing import Iterable

from jinja2 import Environment, FileSystemLoader, select_autoescape

from ..config import (
    DEFAULT_INVESTIGATOR,
    DEFAULT_RECOMMENDER_AGENCY,
    GENERATED_DIR,
    TEMPLATE_DIR,
)
from ..models import AwardCase, Recipient

HWPX_BASE_DIR = TEMPLATE_DIR / "hwpx_award"
SECTION_TEMPLATE_NAME = "hwpx_award_section.xml.j2"

# XML autoescape 활성화 — 한글 문자열에 <, >, & 가 들어가도 안전
_jinja = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["xml", "j2"]),
    keep_trailing_newline=True,
)


def _fmt_date(d) -> str:
    if d is None:
        return ""
    if isinstance(d, (date, datetime)):
        return d.strftime("%Y. %m. %d.")
    return str(d)


def _safe_filename(name: str) -> str:
    cleaned = re.sub(r"[\\/:*?\"<>|]", "_", name or "").strip()
    return cleaned or "공적조서"


def _personal_rows(case: AwardCase, r: Recipient) -> list[str]:
    rows = [
        f"○ 성    명 : {r.recipient_name or ''}    (한자: {r.chinese_name or ''})",
        f"○ 생년월일 : {_fmt_date(r.birth_date)}",
        f"○ 주    소 : {r.address or ''}",
        f"○ 직    업 : {r.occupation or ''}",
        f"○ 소    속 : {r.organization_name or ''}",
        f"○ 직    위 : {r.recipient_position_title or ''}",
        f"○ 대외직명 : {r.external_title or r.recipient_position_title or ''}",
        f"○ 공적분야 : {r.merit_category or ''}",
        f"○ 공적기간 : {r.merit_period or ''}",
        f"○ 추천훈격 : {case.award_grade or ''}",
        f"○ 추천순위 : {r.recommendation_rank or '1순위'}",
    ]
    return rows


def _split_text_lines(text: str | None) -> list[str]:
    """긴 문장을 한글 줄바꿈으로 나눠 HWPX 문단 배열로 변환."""
    if not text:
        return [""]
    lines: list[str] = []
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line:
            lines.append("")
            continue
        # 한 줄이 너무 길면 70자 단위 강제 줄바꿈 (한글에서 자동 줄바꿈하지만 가독성)
        while len(line) > 70:
            lines.append(line[:70])
            line = line[70:]
        lines.append(line)
    return lines


def _career_lines(r: Recipient) -> list[str]:
    items = []
    for c in r.career_records or []:
        items.append(f"• {c.record_date or ''}  {c.description or ''}")
    return items


def _previous_award_lines(r: Recipient) -> list[str]:
    items = []
    for a in r.previous_awards or []:
        items.append(f"• {a.award_date or ''}  {a.description or ''}")
    return items


def _render_section_xml(case: AwardCase, r: Recipient) -> str:
    merit_text = ""
    merit_summary = ""
    reason = ""
    mc = r.merit_content
    if mc:
        merit_text = mc.full_merit_text or ""
        merit_summary = mc.merit_short_summary or ""
        reason = mc.recommendation_reason or ""

    recommender_full = case.recommender_full_title or (
        f"{DEFAULT_RECOMMENDER_AGENCY} 의원" if not case.recommender_position else
        f"{DEFAULT_RECOMMENDER_AGENCY} {case.recommender_position}"
    )

    inv_dept = (mc.investigator_department if mc and mc.investigator_department else DEFAULT_INVESTIGATOR["department"])
    inv_pos = (mc.investigator_position if mc and mc.investigator_position else DEFAULT_INVESTIGATOR["position"])
    inv_rank = (mc.investigator_rank if mc and mc.investigator_rank else DEFAULT_INVESTIGATOR["rank"])
    inv_name = (mc.investigator_name if mc and mc.investigator_name else DEFAULT_INVESTIGATOR["name"]) or ""

    ctx = {
        # 인적사항
        "recipient_name": r.recipient_name or "",
        "chinese_name": r.chinese_name or "",
        "birth_date": _fmt_date(r.birth_date),
        "military_id": getattr(r, "military_id", "") or "-",
        "nationality": getattr(r, "nationality", "") or "대한민국",
        "address": r.address or "",
        "occupation": r.occupation or "",
        "organization_name": r.organization_name or "",
        "rank_field": "",
        "recipient_position_title": r.recipient_position_title or "",
        "external_title": r.external_title or r.recipient_position_title or "",
        # 공적
        "merit_period": r.merit_period or "",
        "merit_category": r.merit_category or "",
        "award_grade": case.award_grade or "",
        "recommendation_rank": r.recommendation_rank or "1순위",
        "merit_short_summary": merit_summary,
        "merit_lines": _split_text_lines(merit_text),
        "career_lines": _career_lines(r),
        "previous_award_lines": _previous_award_lines(r),
        "recommendation_reason": reason or "-",
        # 조사자
        "investigator_department": inv_dept,
        "investigator_position": inv_pos,
        "investigator_rank": inv_rank,
        "investigator_name": inv_name,
        # 추천자
        "recommendation_date": _fmt_date(case.recommendation_date or case.award_date),
        "recommender_full_title": recommender_full,
        "recommender_name": case.recommender_name or "",
    }
    template = _jinja.get_template(SECTION_TEMPLATE_NAME)
    return template.render(**ctx)


def _iter_template_files() -> Iterable[Path]:
    """베이스 템플릿의 모든 파일을 ZIP 엔트리 순서대로 순회.

    mimetype 이 가장 먼저 와야 하고 ZIP_STORED 로 압축 없이 저장되어야 함.
    """
    mimetype = HWPX_BASE_DIR / "mimetype"
    yield mimetype
    for path in sorted(HWPX_BASE_DIR.rglob("*")):
        if path.is_dir() or path == mimetype:
            continue
        yield path


def _arcname(path: Path) -> str:
    return path.relative_to(HWPX_BASE_DIR).as_posix()


def generate_hwpx(case: AwardCase, r: Recipient) -> Path:
    """HWPX 파일을 GENERATED_DIR 에 생성하고 경로 반환."""
    if not HWPX_BASE_DIR.exists():
        raise FileNotFoundError(f"HWPX 베이스 템플릿을 찾을 수 없습니다: {HWPX_BASE_DIR}")

    section_xml = _render_section_xml(case, r)

    safe_name = _safe_filename(f"공적조서_{r.recipient_name or '대상자'}")
    suffix = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = GENERATED_DIR / f"{safe_name}_{suffix}.hwpx"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        # 1. mimetype - 반드시 첫 엔트리, ZIP_STORED
        mimetype_text = (HWPX_BASE_DIR / "mimetype").read_text(encoding="utf-8")
        zi = zipfile.ZipInfo("mimetype")
        zi.compress_type = zipfile.ZIP_STORED
        zf.writestr(zi, mimetype_text)

        # 2. 나머지 파일 (section0.xml 은 교체)
        for path in _iter_template_files():
            if path.name == "mimetype":
                continue
            arc = _arcname(path)
            if arc == "Contents/section0.xml":
                zf.writestr(arc, section_xml, compress_type=zipfile.ZIP_DEFLATED)
            else:
                data = path.read_bytes()
                zf.writestr(arc, data, compress_type=zipfile.ZIP_DEFLATED)

    out_path.write_bytes(buf.getvalue())
    return out_path


def ensure_base_template_present() -> dict:
    """배포 환경 진단용 — 베이스 템플릿이 모두 있는지 확인."""
    required = [
        "mimetype",
        "version.xml",
        "settings.xml",
        "Contents/header.xml",
        "Contents/section0.xml",
        "Contents/content.hpf",
        "META-INF/container.xml",
        "META-INF/manifest.xml",
    ]
    missing = [r for r in required if not (HWPX_BASE_DIR / r).exists()]
    return {"base_dir": str(HWPX_BASE_DIR), "missing": missing, "ok": not missing}
