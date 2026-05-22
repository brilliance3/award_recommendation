"""표창 건 스키마"""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from .recipient import RecipientRead


class AwardCaseBase(BaseModel):
    title: str
    award_grade: str
    recommender_department: Optional[str] = None
    recommender_position: Optional[str] = None
    recommender_name: Optional[str] = None
    recommender_full_title: Optional[str] = None
    recommendation_date: Optional[date] = None
    award_date: Optional[date] = None


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


class AwardCaseRead(AwardCaseBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
    recipient_count: int = 0


class AwardCaseDetail(AwardCaseRead):
    recipients: List[RecipientRead] = []
