"""민간인 신청 폼 일괄 제출 스키마"""
from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field

from .checklist import ChecklistSubmit


class ApplicationMeritContent(BaseModel):
    merit_short_summary: Optional[str] = None
    recommendation_reason: Optional[str] = None
    merit_overview_1: Optional[str] = None
    merit_overview_2: Optional[str] = None
    merit_overview_3: Optional[str] = None
    merit_overview_4: Optional[str] = None
    full_merit_text: Optional[str] = None


class ApplicationCareerRecord(BaseModel):
    """주요 경력 1줄 (신청자 입력)"""
    record_date: Optional[str] = None  # 자유 형식 (예: "2018.03 ~ 2020.02")
    description: Optional[str] = None


class ApplicationPreviousAward(BaseModel):
    """과거 표창수여 1줄 (신청자 입력)"""
    award_date: Optional[str] = None  # 자유 형식 (예: "2022.05.15")
    description: Optional[str] = None


class ApplicationRecipient(BaseModel):
    """대상자 1명 (기본정보 + 체크리스트 + 공적사항 + 경력 + 과거표창)"""
    recipient_name: str = Field(..., min_length=1)
    chinese_name: Optional[str] = None
    birth_date: date  # 필수
    gender: Optional[str] = None  # "남" | "여" (신청 폼 토글)
    address: Optional[str] = None
    region: Optional[str] = None
    occupation: Optional[str] = None
    organization_name: str = Field(..., min_length=1)  # 단체명 필수
    recipient_position_title: str = Field(..., min_length=1)  # 직위 필수
    rank_grade: Optional[str] = None
    external_title: Optional[str] = None
    merit_category: str = Field(..., min_length=1)  # 공적분야 필수
    merit_period: str = Field(..., min_length=1)  # 공적기간 필수 (2년 이상은 클라이언트 검증)

    checklist: ChecklistSubmit  # 대상자 본인 자가 체크
    merit_content: ApplicationMeritContent
    careers: List[ApplicationCareerRecord] = Field(default_factory=list)
    previous_awards: List[ApplicationPreviousAward] = Field(default_factory=list)


class ApplicationSubmit(BaseModel):
    """공용 /apply 폼 일괄 제출"""
    # 신청자 정보 — 폼을 직접 작성하는 민간인/기관 (추천의원과는 별개)
    applicant_role: str = Field(..., pattern="^(individual|organization)$")  # 개인/기관 대표
    applicant_name: str = Field(..., min_length=1)
    applicant_organization: Optional[str] = None  # 기관일 때 단체명
    applicant_contact: Optional[str] = None  # 연락처
    applicant_delivery_address: Optional[str] = None  # 희망 등기수령 주소

    # 추천의원 정보 — 추천자(case.recommender_*)로 저장됨
    recommender_name: str = Field(..., min_length=1)  # 의원 성명 (필수)

    # 훈격: 경기도의회 의장(chairman) / 경기도지사(governor)
    award_kind: str = Field("chairman", pattern="^(chairman|governor)$")
    award_date: Optional[date] = None  # 희망 표창일 (선택)

    # 대상자 N명 (1명 이상)
    recipients: List[ApplicationRecipient] = Field(..., min_length=1)


class ApplicationSubmitResponse(BaseModel):
    award_case_id: str
    recipient_ids: List[str]
    message: str = "신청이 정상적으로 접수되었습니다."
