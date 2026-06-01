"""표창 건 모델"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String, Date
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
    # 신청자(applicant) 정보 — 추천의원과 별도. 민간인이 /apply에서 직접 작성한 본인 정보.
    applicant_role = Column(String(20))  # 'individual' | 'organization'
    applicant_name = Column(String(255))
    applicant_organization = Column(String(255))
    applicant_contact = Column(String(255))
    applicant_delivery_address = Column(String(500))
    # 진행 상태: 대기 → 예정 → 진행 → 보관 → 완료 / 취소
    status = Column(String(20), default="예정")
    # 도장(인) 적용 여부 — 다운로드 페이지에서 [검토 완료·도장 찍기] 토글
    seal_applied = Column(Boolean, default=False, nullable=False)
    # 도장을 찍은(검토 완료) 날짜 — 현지조사 확인서 날짜로 사용
    seal_applied_at = Column(DateTime)
    # 위원장 명의 제출 — 통계(쿼터)는 recommender_name(원래 의원)에 남기되,
    # 문서(공적조서 추천관·추천자)만 위원장 명의로 출력. 의원 쿼터 초과 시 사용.
    chair_sign = Column(Boolean, default=False, nullable=False)
    # 휴지통 — 값이 있으면 삭제됨(soft delete). 목록에서 숨기고 휴지통에서 복구/완전삭제.
    deleted_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    recipients = relationship(
        "Recipient",
        back_populates="award_case",
        cascade="all, delete-orphan",
        order_by="Recipient.sequence_no",
    )
