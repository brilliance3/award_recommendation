"""표창 대상자 스키마"""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from .career_record import CareerRecordRead
from .merit_content import MeritContentRead
from .previous_award import PreviousAwardRead


class RecipientBase(BaseModel):
    sequence_no: Optional[int] = 1
    recipient_name: str
    chinese_name: Optional[str] = None
    birth_date: Optional[date] = None
    birth_yymmdd: Optional[str] = Field(None, max_length=6)
    phone_number: Optional[str] = None
    address: Optional[str] = None
    address_zipcode: Optional[str] = None
    registered_address: Optional[str] = None
    region: Optional[str] = None
    occupation: Optional[str] = None
    nationality: Optional[str] = "대한민국"
    military_id: Optional[str] = None
    organization_name: Optional[str] = None
    recipient_position_title: Optional[str] = None
    external_title: Optional[str] = None
    merit_category: Optional[str] = None
    merit_period: Optional[str] = None
    recommendation_rank: Optional[str] = "1순위"
    note: Optional[str] = None
    status: Optional[str] = "draft"
    invitation_token: Optional[str] = None


class RecipientCreate(RecipientBase):
    pass


class RecipientUpdate(BaseModel):
    sequence_no: Optional[int] = None
    recipient_name: Optional[str] = None
    chinese_name: Optional[str] = None
    birth_date: Optional[date] = None
    birth_yymmdd: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    address_zipcode: Optional[str] = None
    registered_address: Optional[str] = None
    region: Optional[str] = None
    occupation: Optional[str] = None
    nationality: Optional[str] = None
    military_id: Optional[str] = None
    organization_name: Optional[str] = None
    recipient_position_title: Optional[str] = None
    external_title: Optional[str] = None
    merit_category: Optional[str] = None
    merit_period: Optional[str] = None
    recommendation_rank: Optional[str] = None
    note: Optional[str] = None
    status: Optional[str] = None


class RecipientRead(RecipientBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    award_case_id: str
    created_at: datetime
    updated_at: datetime


class RecipientDetail(RecipientRead):
    merit_content: Optional[MeritContentRead] = None
    career_records: List[CareerRecordRead] = []
    previous_awards: List[PreviousAwardRead] = []
