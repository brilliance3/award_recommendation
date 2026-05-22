"""공적 내용 스키마"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class MeritContentBase(BaseModel):
    merit_short_summary: Optional[str] = None
    recommendation_reason: Optional[str] = None
    merit_overview_1: Optional[str] = None
    merit_overview_2: Optional[str] = None
    merit_overview_3: Optional[str] = None
    merit_overview_4: Optional[str] = None
    full_merit_text: Optional[str] = None
    character_assessment: Optional[str] = None
    local_reputation: Optional[str] = None
    merit_consistency: Optional[str] = "공적내용과 일치함"
    investigator_department: Optional[str] = None
    investigator_position: Optional[str] = None
    investigator_rank: Optional[str] = None
    investigator_name: Optional[str] = None


class MeritContentUpdate(MeritContentBase):
    pass


class MeritContentRead(MeritContentBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    recipient_id: str
    created_at: datetime
    updated_at: datetime


class MeritGenerateRequest(BaseModel):
    """AI 공적사항 자동 생성 요청"""
    tone: str = "formal"  # formal | warm
    length: str = "standard"  # short | standard | long
    keywords: List[str] = []
    activity_summary: Optional[str] = None
    generate_summary: bool = True
    generate_full_text: bool = True
    generate_reason: bool = True
