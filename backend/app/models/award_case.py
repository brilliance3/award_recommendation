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
    # 기관 대표 신청용 공유 링크 — 외부 피추천자가 이 토큰으로 본인 정보를 직접 1명씩 추가.
    # 기관 신청 시에만 발급(개인·수동 생성은 NULL). 회수(enabled=False)·만료(expires_at) 가능.
    share_token = Column(String(36), unique=True, index=True)
    share_enabled = Column(Boolean, default=True, nullable=False)
    share_expires_at = Column(DateTime)
    # 관리 링크(/apply/manage) 보호 자격(선택) — 대표가 신청서 제출 시 설정.
    # 설정 시 관리 링크 접근에 아이디/비밀번호 요구. 담당자(관리자)도 조회·재설정 가능. 평문 저장.
    # (DB 컬럼명은 기존 share_* 재사용 — 마이그레이션 불필요)
    manage_username = Column("share_username", String(100))
    manage_password = Column("share_password", String(255))
    # 기관 대표 전용 검토·최종제출 관리 토큰(대상자 추가 토큰과 별개, 대표만 보유).
    manage_token = Column(String(36), unique=True, index=True)
    # 신청자(대표) 최종 제출 여부. False면 담당자 목록(표창 관리)에서 숨김.
    # 일반/개인/수동 생성은 True(즉시 노출), 기관 대표 신청은 생성 시 False → 최종제출 시 True.
    applicant_submitted = Column(Boolean, default=True, nullable=False)
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
