"""의원/상임위 통계 API - 사무처 대시보드용."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _extract_committee(full_title: str | None) -> str:
    """추천자 full_title 에서 위원회 이름 추출."""
    if not full_title:
        return "(미지정)"
    m = re.search(r"([가-힣]+위원회)", full_title)
    return m.group(1) if m else "(미지정)"


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    """전체 현황 요약."""
    cases = db.query(models.AwardCase).all()
    recipients = db.query(models.Recipient).all()
    council_members = db.query(models.CouncilMember).filter_by(is_active=True).all()

    by_status: dict[str, int] = {}
    for r in recipients:
        s = (r.status or "draft")
        by_status[s] = by_status.get(s, 0) + 1

    by_grade: dict[str, int] = {}
    for c in cases:
        g = (c.award_grade or "기타")
        by_grade[g] = by_grade.get(g, 0) + 1

    return {
        "total_cases": len(cases),
        "total_recipients": len(recipients),
        "total_council_members": len(council_members),
        "by_recipient_status": by_status,
        "by_award_grade": by_grade,
    }


@router.get("/by-committee")
def by_committee(db: Session = Depends(get_db)):
    """상임위별 추천 건수 + 대상자 수."""
    cases = db.query(models.AwardCase).all()
    agg: dict[str, dict] = {}
    for c in cases:
        com = _extract_committee(c.recommender_full_title)
        if com not in agg:
            agg[com] = {"committee": com, "cases": 0, "recipients": 0}
        agg[com]["cases"] += 1
        agg[com]["recipients"] += len(c.recipients)
    return sorted(agg.values(), key=lambda x: -x["recipients"])


@router.get("/by-member")
def by_member(db: Session = Depends(get_db)):
    """의원별 추천 건수 + 대상자 수 (추천자 이름 매칭)."""
    cases = db.query(models.AwardCase).all()
    members = {m.name: m for m in db.query(models.CouncilMember).filter_by(is_active=True).all()}
    agg: dict[str, dict] = {}
    for c in cases:
        name = c.recommender_name or "(미지정)"
        if name not in agg:
            m = members.get(name)
            agg[name] = {
                "name": name,
                "party": m.party if m else None,
                "committee": m.committee_name if m else None,
                "district": m.district if m else None,
                "cases": 0,
                "recipients": 0,
            }
        agg[name]["cases"] += 1
        agg[name]["recipients"] += len(c.recipients)
    return sorted(agg.values(), key=lambda x: -x["recipients"])


@router.get("/by-merit-category")
def by_merit_category(db: Session = Depends(get_db)):
    """공적분야별 대상자 수."""
    recipients = db.query(models.Recipient).all()
    agg: dict[str, int] = {}
    for r in recipients:
        cat = r.merit_category or "(미분류)"
        agg[cat] = agg.get(cat, 0) + 1
    return sorted(
        [{"category": k, "count": v} for k, v in agg.items()],
        key=lambda x: -x["count"],
    )
