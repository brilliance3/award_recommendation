"""주요 경력 스키마"""
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CareerRecordCreate(BaseModel):
    record_date: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = 0


class CareerRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    recipient_id: str
    record_date: Optional[str] = None
    description: Optional[str] = None
    sort_order: int = 0
