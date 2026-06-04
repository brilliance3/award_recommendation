"""민간인 신청 폼 일괄 제출 스키마"""
from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field

from .checklist import ChecklistSubmit
from .merit_content import MeritContentUpdate
from .recipient import RecipientDetail, RecipientUpdate


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
    recipient_position_title: Optional[str] = None  # 직위/직명 (선택)
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

    # 훈격은 경기도의회 의장 표창 단일(도지사 표창은 별도 기능 제거됨).
    award_date: Optional[date] = None  # 희망 표창일 (선택)

    # 관리 링크 보호 자격은 신청자가 설정하지 않는다(관리자가 표창관리에서 관리).

    # 대상자 — 개인 신청은 본인 1명 이상, 기관 대표 신청은 0명 허용(공유 URL로 자가추가).
    # 역할별 최소개수는 핸들러(submit_application)에서 검증한다.
    recipients: List[ApplicationRecipient] = Field(default_factory=list)


class ApplicationSubmitResponse(BaseModel):
    award_case_id: str
    recipient_ids: List[str]
    # 기관 대표 신청이면 대상자 자가추가용 공유 토큰(개인 신청은 None). 프론트가 URL 조립.
    share_token: Optional[str] = None
    # 기관 대표 전용 검토·최종제출 관리 토큰(개인 신청은 None).
    manage_token: Optional[str] = None
    message: str = "신청이 정상적으로 접수되었습니다."


class ShareCaseInfo(BaseModel):
    """공유 토큰으로 외부 피추천자가 보는 신청 요약 — PII 최소(대상자 명단·생년월일·주소 미노출)."""
    organization: Optional[str] = None  # 신청 기관명
    recommender_name: Optional[str] = None  # 추천의원
    award_grade: Optional[str] = None  # 훈격
    award_date: Optional[date] = None  # 희망 표창일
    recipient_count: int = 0  # 현재까지 추가된 대상자 수


class ManageCredentialsUpdate(BaseModel):
    """관리 링크 자격 설정/변경 — password 가 비면 자격 해제(공개)."""
    username: str = ""
    password: str = ""


class ManageCredentialsRead(BaseModel):
    protected: bool = False
    username: str = ""
    password: str = ""  # 관리자/대표가 확인·전달할 수 있게 평문 반환


class ShareRecipientAddResponse(BaseModel):
    recipient_id: str
    recipient_count: int
    message: str = "대상자가 추가되었습니다."


class ManageRecipientItem(BaseModel):
    """대표 검토 화면에 보이는 대상자 1명 요약(주소·생년월일 등 민감정보 제외)."""
    id: Optional[str] = None  # 대표 수정/제외 호출용
    recipient_name: Optional[str] = None
    organization_name: Optional[str] = None
    recipient_position_title: Optional[str] = None
    merit_category: Optional[str] = None


class ManageCaseInfo(BaseModel):
    """기관 대표 전용 관리/검토 화면 데이터(대표 본인이 모은 명단 확인 + 최종 제출)."""
    organization: Optional[str] = None
    recommender_name: Optional[str] = None
    award_grade: Optional[str] = None
    award_date: Optional[date] = None
    share_token: Optional[str] = None  # 대표가 대상자 추가 링크를 다시 복사할 수 있게
    submitted: bool = False  # 최종 제출 여부(False면 담당자에게 아직 안 보임)
    recipient_count: int = 0
    recipients: List[ManageRecipientItem] = []
    protected: bool = False  # 관리 링크 자격 보호 여부
    authorized: bool = True  # 보호 시 자격 일치로 열람 가능 여부
    manage_username: str = ""  # 설정된 관리 아이디(대표 확인용)


class ManageRecipientUpdate(BaseModel):
    """대표(중간관리자)가 관리 화면에서 대상자 1명 수정 — 기본정보 + 공적사항."""
    basic: RecipientUpdate
    merit: Optional[MeritContentUpdate] = None


class ManageSubmitResponse(BaseModel):
    submitted: bool = True
    recipient_count: int = 0
    message: str = "최종 제출되었습니다."
