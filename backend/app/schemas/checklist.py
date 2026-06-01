"""체크리스트 스키마"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ChecklistSubmit(BaseModel):
    """대상자 본인이 제출하는 체크리스트"""
    item_service_period: str
    item_service_period_note: Optional[str] = None
    item_prior_award: str
    item_prior_award_note: Optional[str] = None
    item_discipline: str
    item_discipline_note: Optional[str] = None
    item_investigation: str
    item_investigation_note: Optional[str] = None
    item_criminal: str
    item_criminal_note: Optional[str] = None
    item_arrears: str
    item_arrears_note: Optional[str] = None
    item_misconduct: str
    item_misconduct_note: Optional[str] = None
    item_award_revoked: str
    item_award_revoked_note: Optional[str] = None

    self_confirm_name: str
    self_confirm_birth: str


class AdminReviewSubmit(BaseModel):
    """관리자(전문위원실) 공직선거법 검토 제출"""
    admin_election_law_general: str
    admin_election_law_general_note: Optional[str] = None
    admin_election_law_basis: str
    admin_election_law_basis_note: Optional[str] = None
    admin_election_law_art112: str
    admin_election_law_art112_note: Optional[str] = None
    admin_reviewer_name: str


class ChecklistRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    recipient_id: str
    item_service_period: Optional[str] = None
    item_service_period_note: Optional[str] = None
    item_prior_award: Optional[str] = None
    item_prior_award_note: Optional[str] = None
    item_discipline: Optional[str] = None
    item_discipline_note: Optional[str] = None
    item_investigation: Optional[str] = None
    item_investigation_note: Optional[str] = None
    item_criminal: Optional[str] = None
    item_criminal_note: Optional[str] = None
    item_arrears: Optional[str] = None
    item_arrears_note: Optional[str] = None
    item_misconduct: Optional[str] = None
    item_misconduct_note: Optional[str] = None
    item_award_revoked: Optional[str] = None
    item_award_revoked_note: Optional[str] = None
    self_confirm_name: Optional[str] = None
    self_confirm_birth: Optional[str] = None
    submitted_at: Optional[datetime] = None
    admin_election_law_general: Optional[str] = None
    admin_election_law_general_note: Optional[str] = None
    admin_election_law_basis: Optional[str] = None
    admin_election_law_basis_note: Optional[str] = None
    admin_election_law_art112: Optional[str] = None
    admin_election_law_art112_note: Optional[str] = None
    admin_reviewer_name: Optional[str] = None
    admin_reviewed_at: Optional[datetime] = None


class ChecklistPublicInfo(BaseModel):
    """대상자가 입력 페이지에서 확인할 수 있는 정보 (이름 마스킹)"""
    recipient_id: str
    recipient_name_masked: str  # 홍길동 → 홍**
    organization_name: Optional[str] = None
    merit_category: Optional[str] = None
    already_submitted: bool
