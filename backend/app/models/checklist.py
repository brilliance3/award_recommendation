"""대상자 자가 부적격 체크리스트 모델 (서식8 기반, 공직선거법 항목 제외)"""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from ..database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Checklist(Base):
    __tablename__ = "checklists"

    id = Column(String(36), primary_key=True, default=_uuid)
    recipient_id = Column(
        String(36),
        ForeignKey("recipients.id", ondelete="CASCADE"),
        unique=True,
    )

    # 8개 항목 — 각 항목은 "ok" / "has_issue" 두 상태 + 추가 설명
    item_service_period = Column(String(20))  # 수공기간
    item_service_period_note = Column(Text)
    item_prior_award = Column(String(20))  # 기포상
    item_prior_award_note = Column(Text)
    item_discipline = Column(String(20))  # 징계
    item_discipline_note = Column(Text)
    item_investigation = Column(String(20))  # 수사·기소
    item_investigation_note = Column(Text)
    item_criminal = Column(String(20))  # 형사처분
    item_criminal_note = Column(Text)
    item_arrears = Column(String(20))  # 체납
    item_arrears_note = Column(Text)
    item_misconduct = Column(String(20))  # 비위·물의
    item_misconduct_note = Column(Text)
    item_award_revoked = Column(String(20))  # 표창 취소 이력
    item_award_revoked_note = Column(Text)

    # 본인 확인
    self_confirm_name = Column(String(100))  # 본인이 입력한 이름
    self_confirm_birth = Column(String(20))  # 본인이 입력한 생년월일(YYYY-MM-DD)
    submitted_at = Column(DateTime)  # 제출 시각
    submitter_ip = Column(String(64))  # 제출 IP

    # 관리자(전문위원실) 공직선거법 검토 — 민간인/기관/단체 표창만
    admin_election_law_general = Column(String(20))  # "lawful" | "violation"
    admin_election_law_general_note = Column(Text)
    admin_election_law_basis = Column(String(20))
    admin_election_law_basis_note = Column(Text)
    admin_election_law_art112 = Column(String(20))
    admin_election_law_art112_note = Column(Text)
    admin_reviewer_name = Column(String(100))
    admin_reviewed_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    recipient = relationship("Recipient", back_populates="checklist")
