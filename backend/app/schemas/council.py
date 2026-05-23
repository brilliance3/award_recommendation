"""경기도의회 의원/상임위 응답 스키마"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict


class CouncilCommitteeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    code: Optional[str] = None
    name: str
    short_name: Optional[str] = None
    kind: Optional[str] = None
    sort_order: int = 0


class CouncilMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    chinese_name: Optional[str] = None
    english_name: Optional[str] = None
    party: Optional[str] = None
    district: Optional[str] = None
    district_detail: Optional[str] = None
    term_count: Optional[int] = None
    committee_name: Optional[str] = None
    committee_role: Optional[str] = None
    council_role: Optional[str] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None
    office_room: Optional[str] = None
    photo_url: Optional[str] = None
    blog_url: Optional[str] = None
    aide_name: Optional[str] = None
    aide_phone: Optional[str] = None
    biography: Optional[str] = None
    pledges: Optional[str] = None
    is_active: bool = True


class CouncilMemberFullTitle(BaseModel):
    """추천자 자동 채움용 — 의원 ID 로부터 추천자 정보를 만들 때 사용"""
    member_id: str


class CouncilMemberRecommender(BaseModel):
    recommender_full_title: str
    recommender_name: str
    recommender_department: Optional[str] = None
    recommender_position: Optional[str] = None
