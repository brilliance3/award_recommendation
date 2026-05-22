"""표창 건 모델"""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, Date
from sqlalchemy.orm import relationship

from ..database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class AwardCase(Base):
    __tablename__ = "award_cases"

    id = Column(String(36), primary_key=True, default=_uuid)
    title = Column(String(255), nullable=False)
    award_grade = Column(String(255), nullable=False)
    recommender_department = Column(String(255))
    recommender_position = Column(String(255))
    recommender_name = Column(String(255))
    recommender_full_title = Column(String(500))
    recommendation_date = Column(Date)
    award_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    recipients = relationship(
        "Recipient",
        back_populates="award_case",
        cascade="all, delete-orphan",
        order_by="Recipient.sequence_no",
    )
