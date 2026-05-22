"""생성 문서 메타정보 모델"""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from ..database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class GeneratedDocument(Base):
    __tablename__ = "generated_documents"

    id = Column(String(36), primary_key=True, default=_uuid)
    award_case_id = Column(String(36), ForeignKey("award_cases.id", ondelete="CASCADE"))
    recipient_id = Column(
        String(36),
        ForeignKey("recipients.id", ondelete="CASCADE"),
        nullable=True,
    )
    document_type = Column(String(50), nullable=False)  # merit_overview / merit_report / recipient_list
    file_name = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    recipient = relationship("Recipient", back_populates="generated_documents")
