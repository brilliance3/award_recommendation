"""과거 표창기록 스키마"""
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PreviousAwardCreate(BaseModel):
    award_date: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = 0


class PreviousAwardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    recipient_id: str
    award_date: Optional[str] = None
    description: Optional[str] = None
    sort_order: int = 0
