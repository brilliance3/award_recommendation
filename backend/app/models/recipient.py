"""표창 대상자 모델"""
import uuid
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from ..database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Recipient(Base):
    __tablename__ = "recipients"

    id = Column(String(36), primary_key=True, default=_uuid)
    award_case_id = Column(String(36), ForeignKey("award_cases.id", ondelete="CASCADE"))
    sequence_no = Column(Integer, default=1)

    # 인적사항
    recipient_name = Column(String(100), nullable=False)
    chinese_name = Column(String(100))
    birth_date = Column(Date)
    birth_yymmdd = Column(String(6))
    address = Column(String(500))
    registered_address = Column(String(500))
    region = Column(String(100))
    occupation = Column(String(255))
    nationality = Column(String(50), default="대한민국")
    military_id = Column(String(50))
    organization_name = Column(String(255))
    recipient_position_title = Column(String(255))
    external_title = Column(String(255))

    # 공적
    merit_category = Column(String(255))
    merit_period = Column(String(100))
    recommendation_rank = Column(String(50), default="1순위")
    note = Column(String(500))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    award_case = relationship("AwardCase", back_populates="recipients")
    merit_content = relationship(
        "MeritContent",
        back_populates="recipient",
        cascade="all, delete-orphan",
        uselist=False,
    )
    career_records = relationship(
        "CareerRecord",
        back_populates="recipient",
        cascade="all, delete-orphan",
        order_by="CareerRecord.sort_order",
    )
    previous_awards = relationship(
        "PreviousAward",
        back_populates="recipient",
        cascade="all, delete-orphan",
        order_by="PreviousAward.sort_order",
    )
    generated_documents = relationship(
        "GeneratedDocument",
        back_populates="recipient",
        cascade="all, delete-orphan",
    )
