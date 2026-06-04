"""표창 대상자 스키마"""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from .career_record import CareerRecordRead
from .checklist import ChecklistRead
from .merit_content import MeritContentRead
from .previous_award import PreviousAwardRead


class RecipientBase(BaseModel):
    sequence_no: Optional[int] = 1
    recipient_name: str
    chinese_name: Optional[str] = None
    birth_date: Optional[date] = None
    birth_yymmdd: Optional[str] = Field(None, max_length=6)
    gender: Optional[str] = None
    address: Optional[str] = None
    region: Optional[str] = None
    occupation: Optional[str] = None
    organization_name: Optional[str] = None
    recipient_position_title: Optional[str] = None
    external_title: Optional[str] = None
    rank_grade: Optional[str] = None
    merit_category: Optional[str] = None
    merit_period: Optional[str] = None
    recommendation_rank: Optional[str] = "1순위"
    award_date: Optional[date] = None  # 표창일(대상자 개인 단위)
    note: Optional[str] = None


class RecipientCreate(RecipientBase):
    pass


class RecipientUpdate(BaseModel):
    sequence_no: Optional[int] = None
    recipient_name: Optional[str] = None
    chinese_name: Optional[str] = None
    birth_date: Optional[date] = None
    birth_yymmdd: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    region: Optional[str] = None
    occupation: Optional[str] = None
    organization_name: Optional[str] = None
    recipient_position_title: Optional[str] = None
    external_title: Optional[str] = None
    rank_grade: Optional[str] = None
    merit_category: Optional[str] = None
    merit_period: Optional[str] = None
    recommendation_rank: Optional[str] = None
    award_date: Optional[date] = None  # 표창일(대상자 개인 단위) 수정
    note: Optional[str] = None


class RecipientRead(RecipientBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    award_case_id: str
    created_at: datetime
    updated_at: datetime
    # 관리자 검토(공직선거법) 완료 여부 — checklist.admin_reviewed_at 기반(서버 계산)
    admin_reviewed: bool = False
    # 개인정보 동의 로깅
    consent_at: Optional[datetime] = None
    consent_version: Optional[str] = None
    consent_path: Optional[str] = None


class RecipientDetail(RecipientRead):
    merit_content: Optional[MeritContentRead] = None
    checklist: Optional[ChecklistRead] = None
    career_records: List[CareerRecordRead] = []
    previous_awards: List[PreviousAwardRead] = []
