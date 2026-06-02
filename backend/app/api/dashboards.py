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
    # 경기도지사 표창 — 의원당 역년(임기 교체해는 반기) 1건. 자동 집계 없이 담당자 수동 체크.
    governor_used: bool = False


class QuotaResponse(BaseModel):
    term_start: date
    term_end: date
    calendar_start: date
    calendar_end: date
    rows: List[QuotaRow]


class CaseRow(BaseModel):
    id: str
    title: str
    award_grade: Optional[str] = None  # 훈격(의장/도지사 표창)
    recommender_name: Optional[str]
    chair_sign: bool = False  # 위원장 명의로 제출(문서만 위원장 명의, 통계는 원래 의원)
    recommendation_date: Optional[date]  # 공적제출일
    award_date: Optional[date]  # 표창일(대상자별 대표값=최솟값)
    award_date_count: int = 0  # 서로 다른 표창일 개수(>1이면 목록에 '복수' 표시)
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
    db: Session, name: str, start: date, end: date
) -> tuple[int, int]:
    """해당 의원이 추천한 (의장 표창) case의 recipient 수 + case 수를 반환.

    기준 날짜는 case.recommendation_date — [start, end] 안 케이스만 카운트.
    과거 데이터에 도지사('지사') 건이 남아 있을 수 있어 의장 쿼터에선 제외한다.
    """
    cases = (
        db.query(models.AwardCase)
        .filter(models.AwardCase.recommender_name == name)
        .filter(models.AwardCase.deleted_at.is_(None))
        # 기관 대표가 아직 최종 제출 안 한 draft 건은 쿼터에 포함하지 않음(제출 시 집계).
        .filter(models.AwardCase.applicant_submitted.isnot(False))
        .filter(models.AwardCase.recommendation_date >= start)
        .filter(models.AwardCase.recommendation_date <= end)
        .all()
    )
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
    # 경기도지사 표창 수동 체크 — 현재 역년/반기에 체크된 의원 집합
    gov_marked = {
        m.legislator_name
        for m in db.query(models.GovernorAwardMark)
        .filter(models.GovernorAwardMark.period_start == cal_start)
        .all()
    }
    legislators = (
        db.query(models.Legislator)
        .filter(models.Legislator.active == True)  # noqa: E712
        .order_by(models.Legislator.sort_order, models.Legislator.name)
        .all()
    )
    rows: List[QuotaRow] = []
    for L in legislators:
        used, case_count = _count_for_legislator(db, L.name, term_start, term_end)
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
                # 토글 저장 시 이름을 strip하므로 비교도 동일하게 정규화(공백 desync 방지)
                governor_used=(L.name or "").strip() in gov_marked,
            )
        )
    return QuotaResponse(
        term_start=term_start,
        term_end=term_end,
        calendar_start=cal_start,
        calendar_end=cal_end,
        rows=rows,
    )


class GovernorMarkUpdate(BaseModel):
    legislator_name: str
    used: bool
    today: Optional[date] = None  # 기준일(미지정 시 오늘) — 역년/반기 구간 결정


class GovernorMarkResponse(BaseModel):
    legislator_name: str
    used: bool
    period_start: date


@router.post("/api/dashboards/quota/governor", response_model=GovernorMarkResponse)
def set_governor_mark(payload: GovernorMarkUpdate, db: Session = Depends(get_db)):
    """경기도지사 표창 사용 여부를 수동으로 체크/해제(의원당 역년·반기 1건).

    used=True면 현재 구간 마크 생성(이미 있으면 유지), False면 삭제.
    """
    cal_start, _ = current_calendar_range(payload.today)
    name = payload.legislator_name.strip()
    existing = (
        db.query(models.GovernorAwardMark)
        .filter(models.GovernorAwardMark.legislator_name == name)
        .filter(models.GovernorAwardMark.period_start == cal_start)
        .first()
    )
    if payload.used and existing is None:
        db.add(models.GovernorAwardMark(legislator_name=name, period_start=cal_start))
        db.commit()
    elif not payload.used and existing is not None:
        db.delete(existing)
        db.commit()
    return GovernorMarkResponse(
        legislator_name=name, used=payload.used, period_start=cal_start
    )


@router.get("/api/dashboards/cases", response_model=CasesResponse)
def get_all_cases(
    today: Optional[date] = Query(None, description="기준일 — 미지정 시 오늘"),
    legislator: Optional[str] = Query(None, description="의원명 필터"),
    db: Session = Depends(get_db),
):
    """전체 표창 케이스 통합 목록(관리·현황 통합 화면용).

    관리 화면과 통합되면서, 회기년도 밖이거나 recommendation_date가 없는(수동 생성) 건도
    누락되지 않도록 전체 활성 케이스를 반환한다. term_start/term_end는 표시용으로만 계산.
    legislator를 지정하면 해당 의원만.
    """
    term_start, term_end = current_term_range(today)
    q = db.query(models.AwardCase).filter(models.AwardCase.deleted_at.is_(None))
    # 기관 대표가 아직 '최종 제출'하지 않은 건(applicant_submitted=False)은 담당자 목록에서 숨김.
    # 일반/개인/수동·기존 건은 True(또는 NULL)이라 그대로 보인다.
    q = q.filter(models.AwardCase.applicant_submitted.isnot(False))
    if legislator:
        q = q.filter(models.AwardCase.recommender_name == legislator)
    cases = q.order_by(models.AwardCase.created_at.desc()).all()

    rows: List[CaseRow] = []
    for c in cases:
        # 대상자 개인별 표창일(미설정 시 case.award_date 폴백)의 대표값=최솟값,
        # 서로 다른 날짜 개수=award_date_count.
        eff = [(r.award_date or c.award_date) for r in c.recipients]
        eff = [d for d in eff if d]
        rep_award_date = min(eff) if eff else c.award_date
        rows.append(
            CaseRow(
                id=c.id,
                title=c.title,
                award_grade=c.award_grade,
                recommender_name=c.recommender_name,
                chair_sign=bool(c.chair_sign),
                recommendation_date=c.recommendation_date,
                award_date=rep_award_date,
                award_date_count=len(set(eff)),
                target_issue_date=compute_target_issue_date(rep_award_date),
                recipient_count=len(c.recipients),
                recipient_names=[r.recipient_name for r in c.recipients],
                applicant_name=c.applicant_name,
                applicant_contact=c.applicant_contact,
                status=c.status,
            )
        )
    return CasesResponse(term_start=term_start, term_end=term_end, rows=rows)
