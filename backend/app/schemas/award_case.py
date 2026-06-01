"""표창 건 스키마"""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from .recipient import RecipientDetail, RecipientRead


class AwardCaseBase(BaseModel):
    title: str
    award_grade: str
    recommender_department: Optional[str] = None
    recommender_position: Optional[str] = None
    recommender_name: Optional[str] = None
    recommender_full_title: Optional[str] = None
    recommendation_date: Optional[date] = None
    award_date: Optional[date] = None
    applicant_role: Optional[str] = None
    applicant_name: Optional[str] = None
    applicant_organization: Optional[str] = None
    applicant_contact: Optional[str] = None
    applicant_delivery_address: Optional[str] = None
    status: Optional[str] = None
    seal_applied: bool = False
    chair_sign: bool = False


class AwardCaseCreate(AwardCaseBase):
    pass


class AwardCaseUpdate(BaseModel):
    title: Optional[str] = None
    award_grade: Optional[str] = None
    recommender_department: Optional[str] = None
    recommender_position: Optional[str] = None
    recommender_name: Optional[str] = None
    recommender_full_title: Optional[str] = None
    recommendation_date: Optional[date] = None
    award_date: Optional[date] = None
    applicant_role: Optional[str] = None
    applicant_name: Optional[str] = None
    applicant_organization: Optional[str] = None
    applicant_contact: Optional[str] = None
    applicant_delivery_address: Optional[str] = None
    status: Optional[str] = None
    seal_applied: Optional[bool] = None
    chair_sign: Optional[bool] = None


class AwardCaseRead(AwardCaseBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
    recipient_count: int = 0


class AwardCaseDetail(AwardCaseRead):
    recipients: List[RecipientRead] = []


class AwardCasePreview(AwardCaseRead):
    """문서 미리보기용 — 각 recipient의 본문·경력·과거표창까지 포함."""

    recipients: List[RecipientDetail] = []
