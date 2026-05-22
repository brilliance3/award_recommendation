"""공적 내용 모델"""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from ..database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class MeritContent(Base):
    __tablename__ = "merit_contents"

    id = Column(String(36), primary_key=True, default=_uuid)
    recipient_id = Column(
        String(36),
        ForeignKey("recipients.id", ondelete="CASCADE"),
        unique=True,
    )

    merit_short_summary = Column(Text)  # 공적요지 (50자 내외)
    recommendation_reason = Column(Text)  # 추천사유

    # 공적개요서의 1~4번 항목
    merit_overview_1 = Column(Text)
    merit_overview_2 = Column(Text)
    merit_overview_3 = Column(Text)
    merit_overview_4 = Column(Text)

    # 공적사항(공적조서 본문, 긴 문장)
    full_merit_text = Column(Text)

    # 현지조사
    character_assessment = Column(Text)  # 성품
    local_reputation = Column(Text)  # 지역여론
    merit_consistency = Column(String(255), default="공적내용과 일치함")

    # 현지조사자 정보 (대상자별 오버라이드)
    investigator_department = Column(String(255))
    investigator_position = Column(String(255))
    investigator_rank = Column(String(255))
    investigator_name = Column(String(255))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    recipient = relationship("Recipient", back_populates="merit_content")
