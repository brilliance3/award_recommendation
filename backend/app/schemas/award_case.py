"""표창 건 스키마"""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from .recipient import RecipientDetail, RecipientRead


class AwardCaseBase(BaseModel):
    title: str
    award_grade: str
    recommender_department: Optional[str] = None
    recommender_position: Optional[str] = None
    recommender_name: Optional[str] = None
    recommender_full_title: Optional[str] = None
    recommendation_date: Optional[date] = None
    award_date: Optional[date] = None
    applicant_role: Optional[str] = None
    applicant_name: Optional[str] = None
    applicant_organization: Optional[str] = None
    applicant_contact: Optional[str] = None
    applicant_delivery_address: Optional[str] = None
    status: Optional[str] = None
    seal_applied: bool = False
    chair_sign: bool = False


class AwardCaseCreate(AwardCaseBase):
    pass


class AwardCaseUpdate(BaseModel):
    title: Optional[str] = None
    award_grade: Optional[str] = None
    recommender_department: Optional[str] = None
    recommender_position: Optional[str] = None
    recommender_name: Optional[str] = None
    recommender_full_title: Optional[str] = None
    recommendation_date: Optional[date] = None
    award_date: Optional[date] = None
    applicant_role: Optional[str] = None
    applicant_name: Optional[str] = None
    applicant_organization: Optional[str] = None
    applicant_contact: Optional[str] = None
    applicant_delivery_address: Optional[str] = None
    status: Optional[str] = None
    seal_applied: Optional[bool] = None
    chair_sign: Optional[bool] = None
    share_enabled: Optional[bool] = None  # 공유 링크 회수(False) 토글


class AwardCaseRead(AwardCaseBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
    recipient_count: int = 0
    # 표창일이 대상자 개인 단위가 되며, 대표(최솟값) award_date 외에 서로 다른 날짜 개수.
    # 1보다 크면 목록에서 '복수' 표시.
    award_date_count: int = 0
    # 기관 대표 신청 공유 링크(자가추가용) — 담당자 화면에서 복사·회수에 사용
    share_token: Optional[str] = None
    share_enabled: bool = True
    share_expires_at: Optional[datetime] = None


class AwardCaseDetail(AwardCaseRead):
    recipients: List[RecipientRead] = []
    # 모든 대상자 관리자 검토 완료 여부 — True여야 문서 생성 가능(서버 계산)
    all_reviewed: bool = False


class AwardCasePreview(AwardCaseRead):
    """문서 미리보기용 — 각 recipient의 본문·경력·과거표창까지 포함."""

    recipients: List[RecipientDetail] = []
