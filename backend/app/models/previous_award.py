"""과거 표창기록 모델"""
import uuid

from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from ..database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class PreviousAward(Base):
    __tablename__ = "previous_awards"

    id = Column(String(36), primary_key=True, default=_uuid)
    recipient_id = Column(String(36), ForeignKey("recipients.id", ondelete="CASCADE"))
    award_date = Column(String(50))
    description = Column(Text)
    sort_order = Column(Integer, default=0)

    recipient = relationship("Recipient", back_populates="previous_awards")
