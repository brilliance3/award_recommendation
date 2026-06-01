"""대시보드 / 현황 API.

- 의원별 쿼터 현황 (회기년도 7.1~익년 6.30 기준)
- 전체 표창 케이스 통합 목록
"""
from __future__ import annotations

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..business_days import compute_target_issue_date
from ..database import get_db
from ..legislators import current_calendar_range, current_term_range

router = APIRouter(tags=["dashboards"])


class QuotaRow(BaseModel):
    legislator_name: str
    party: str
    staff: Optional[str] = None
    is_chair: bool
    max_quota: Optional[int]  # 위원장은 None
    used: int  # 회기년도 안 추천한 (의장 표창) 대상자 총 수
    remaining: Optional[int]  # max_quota - used; 위원장은 None
    case_count: int  # 케이스 개수 (참고)
    seal_filename: Optional[str] = None
    # 경기도지사 표창 쿼터 (역년 1.1~12.31, 위원장 구분 없이 의원당 동일)
    governor_max: int = 1
    governor_used: int = 0
    governor_remaining: int = 1


class QuotaResponse(BaseModel):
    term_start: date
    term_end: date
    calendar_start: date
    calendar_end: date
    rows: List[QuotaRow]


class CaseRow(BaseModel):
    id: str
    title: str
    recommender_name: Optional[str]
    recommendation_date: Optional[date]  # 공적제출일
    award_date: Optional[date]  # 표창일
    target_issue_date: Optional[date]  # 발급목표일 (표창일 D-3 영업일)
    recipient_count: int
    recipient_names: List[str]
    applicant_name: Optional[str]
    applicant_contact: Optional[str]
    status: Optional[str]


class CasesResponse(BaseModel):
    term_start: date
    term_end: date
    rows: List[CaseRow]


def _count_for_legislator(
    db: Session, name: str, start: date, end: date, governor: bool = False
) -> tuple[int, int]:
    """해당 의원이 추천한 case의 recipient 수 + case 수를 반환.

    기준 날짜는 case.recommendation_date — [start, end] 안 케이스만 카운트.
    governor=True면 award_grade에 '지사' 포함(경기도지사 표창)만, False면 그 외(의장 표창)만.
    """
    cases = (
        db.query(models.AwardCase)
        .filter(models.AwardCase.recommender_name == name)
        .filter(models.AwardCase.deleted_at.is_(None))
        .filter(models.AwardCase.recommendation_date >= start)
        .filter(models.AwardCase.recommendation_date <= end)
        .all()
    )
    if governor:
        cases = [c for c in cases if "지사" in (c.award_grade or "")]
    else:
        cases = [c for c in cases if "지사" not in (c.award_grade or "")]
    used = sum(len(c.recipients) for c in cases)
    return used, len(cases)


@router.get("/api/dashboards/quota", response_model=QuotaResponse)
def get_quota_status(
    today: Optional[date] = Query(None, description="기준일 — 미지정 시 오늘"),
    db: Session = Depends(get_db),
):
    """의원별 쿼터 현황 (회기년도 기준).

    회기년도: 기준일 기준 7.1 ~ 익년 6.30.
    """
    term_start, term_end = current_term_range(today)
    cal_start, cal_end = current_calendar_range(today)
    setting = db.query(models.AppSetting).first()
    quota = (setting.quota_per_legislator if setting else None) or 100
    gov_quota = (setting.governor_quota_per_year if setting else None) or 1
    legislators = (
        db.query(models.Legislator)
        .filter(models.Legislator.active == True)  # noqa: E712
        .order_by(models.Legislator.sort_order, models.Legislator.name)
        .all()
    )
    rows: List[QuotaRow] = []
    for L in legislators:
        used, case_count = _count_for_legislator(db, L.name, term_start, term_end)
        # 경기도지사 표창 — 역년 기준, 위원장 포함 의원당 동일 한도
        gov_used, _ = _count_for_legislator(db, L.name, cal_start, cal_end, governor=True)
        max_quota = None if L.is_chair else quota
        rows.append(
            QuotaRow(
                legislator_name=L.name,
                party=L.party or "",
                staff=L.staff,
                is_chair=L.is_chair,
                max_quota=max_quota,
                used=used,
                # remaining은 한도 초과 시 음수 그대로 표시 (위원장은 None)
                remaining=None if L.is_chair else quota - used,
                case_count=case_count,
                seal_filename=L.seal_filename,
                governor_max=gov_quota,
                governor_used=gov_used,
                governor_remaining=gov_quota - gov_used,
            )
        )
    return QuotaResponse(
        term_start=term_start,
        term_end=term_end,
        calendar_start=cal_start,
        calendar_end=cal_end,
        rows=rows,
    )


@router.get("/api/dashboards/cases", response_model=CasesResponse)
def get_all_cases(
    today: Optional[date] = Query(None, description="기준일 — 미지정 시 오늘"),
    legislator: Optional[str] = Query(None, description="의원명 필터"),
    db: Session = Depends(get_db),
):
    """전체 표창 케이스 통합 목록 (회기년도 기준).

    legislator를 지정하면 해당 의원만, 미지정 시 전체.
    """
    term_start, term_end = current_term_range(today)
    q = (
        db.query(models.AwardCase)
        .filter(models.AwardCase.deleted_at.is_(None))
        .filter(models.AwardCase.recommendation_date >= term_start)
        .filter(models.AwardCase.recommendation_date <= term_end)
    )
    if legislator:
        q = q.filter(models.AwardCase.recommender_name == legislator)
    cases = q.order_by(models.AwardCase.recommendation_date.desc()).all()

    rows: List[CaseRow] = []
    for c in cases:
        rows.append(
            CaseRow(
                id=c.id,
                title=c.title,
                recommender_name=c.recommender_name,
                recommendation_date=c.recommendation_date,
                award_date=c.award_date,
                target_issue_date=compute_target_issue_date(c.award_date),
                recipient_count=len(c.recipients),
                recipient_names=[r.recipient_name for r in c.recipients],
                applicant_name=c.applicant_name,
                applicant_contact=c.applicant_contact,
                status=c.status,
            )
        )
    return CasesResponse(term_start=term_start, term_end=term_end, rows=rows)
