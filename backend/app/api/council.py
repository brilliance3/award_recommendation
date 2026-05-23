"""경기도의회 의원 / 상임위원회 조회 API

추천자 자동완성, 상임위 필터링, 의원 명단 표시 등에 사용.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services.council_seeder import seed_all

router = APIRouter(prefix="/api/council", tags=["council"])


@router.get("/committees", response_model=list[schemas.CouncilCommitteeRead])
def list_committees(db: Session = Depends(get_db)):
    items = (
        db.query(models.CouncilCommittee)
        .order_by(models.CouncilCommittee.sort_order, models.CouncilCommittee.name)
        .all()
    )
    return [schemas.CouncilCommitteeRead.model_validate(c) for c in items]


@router.get("/members", response_model=list[schemas.CouncilMemberRead])
def list_members(
    db: Session = Depends(get_db),
    committee: Optional[str] = Query(None, description="상임위원회 이름으로 필터링"),
    q: Optional[str] = Query(None, description="이름/지역구 부분 검색"),
):
    query = db.query(models.CouncilMember).filter(models.CouncilMember.is_active == True)  # noqa: E712
    if committee:
        query = query.filter(models.CouncilMember.committee_name == committee)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (models.CouncilMember.name.like(like))
            | (models.CouncilMember.district.like(like))
        )
    items = query.order_by(models.CouncilMember.name).all()
    return [schemas.CouncilMemberRead.model_validate(m) for m in items]


@router.get("/members/{member_id}", response_model=schemas.CouncilMemberRead)
def get_member(member_id: str, db: Session = Depends(get_db)):
    m = db.query(models.CouncilMember).filter_by(id=member_id).one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="의원을 찾을 수 없습니다")
    return schemas.CouncilMemberRead.model_validate(m)


@router.get(
    "/members/{member_id}/recommender",
    response_model=schemas.CouncilMemberRecommender,
)
def member_as_recommender(member_id: str, db: Session = Depends(get_db)):
    """의원 정보로 추천자 정보를 자동 채움.

    예: 강웅철 → "경기도의회 의원 강웅철 (안전행정위원회)"
    """
    m = db.query(models.CouncilMember).filter_by(id=member_id).one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="의원을 찾을 수 없습니다")

    role_part = ""
    if m.council_role:
        role_part = m.council_role
    elif m.committee_role and m.committee_name:
        role_part = f"{m.committee_name} {m.committee_role}"
    elif m.committee_name:
        role_part = m.committee_name

    full_title = "경기도의회 의원"
    if role_part:
        full_title = f"경기도의회 {role_part}" if m.council_role else f"경기도의회 의원 / {role_part}"

    return schemas.CouncilMemberRecommender(
        recommender_full_title=full_title,
        recommender_name=m.name,
        recommender_department="경기도의회",
        recommender_position=m.council_role or "의원",
    )


@router.post("/seed")
def reseed(db: Session = Depends(get_db)):
    """수동으로 시드 재실행. 운영 환경에서 의원 정보 갱신 시 사용."""
    return seed_all(db)
