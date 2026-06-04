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
    gender = Column(String(10))
    address = Column(String(500))
    region = Column(String(100))
    occupation = Column(String(255))
    organization_name = Column(String(255))
    recipient_position_title = Column(String(255))
    external_title = Column(String(255))
    rank_grade = Column(String(100))

    # 공적
    merit_category = Column(String(255))
    merit_period = Column(String(100))
    recommendation_rank = Column(String(50), default="1순위")
    # 표창일(대상자 개인 단위). 미설정이면 AwardCase.award_date로 폴백.
    award_date = Column(Date)
    note = Column(String(500))

    # 개인정보 수집·이용 및 제공 활용 동의 로깅 (동의 시각=동의함, 문안 버전, 입력 경로)
    consent_at = Column(DateTime)
    consent_version = Column(String(20))
    consent_path = Column(String(30))  # self_apply | self_add | org_apply | manage_add

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
    checklist = relationship(
        "Checklist",
        back_populates="recipient",
        cascade="all, delete-orphan",
        uselist=False,
    )
