"""설정 + 의원 명단 모델 (부서·기관·조사자·도장을 담당자가 수정 가능하게 DB화)."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Integer,
    String,
    UniqueConstraint,
)

from ..database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class AppSetting(Base):
    """기관/부서/조사자 등 단일 설정 행 (id 고정 'singleton')."""

    __tablename__ = "app_settings"

    id = Column(String(36), primary_key=True, default="singleton")
    agency_name = Column(String(255), default="경기도의회")
    committee_name = Column(String(255), default="보건복지위원회")
    # 부서명 (헤더·푸터 표시용 — 전문위원실 단위). 다른 부서가 사용할 때 수정.
    department_name = Column(String(255), default="보건복지전문위원실")
    award_grade = Column(String(255), default="경기도의회 의장 표창")
    recommender_position = Column(String(100), default="위원")
    quota_per_legislator = Column(Integer, default=100)
    # 현지조사자 (수석전문위원 등)
    investigator_department = Column(String(255), default="경기도의회 보건복지전문위원실")
    investigator_position = Column(String(100), default="수석전문위원")
    investigator_rank = Column(String(100), default="지방서기관")
    investigator_name = Column(String(100), default="")
    investigator_seal_filename = Column(String(255))


class Legislator(Base):
    """위원회 의원 명단 (회기/부서가 바뀌면 설정에서 수정)."""

    __tablename__ = "legislators"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(100), nullable=False)
    party = Column(String(100), default="")
    is_chair = Column(Boolean, default=False, nullable=False)
    staff = Column(String(100))
    seal_filename = Column(String(255))
    sort_order = Column(Integer, default=0)
    active = Column(Boolean, default=True, nullable=False)


class GovernorAwardMark(Base):
    """경기도지사 표창 '사용' 수동 표시 — 의원당 역년(임기 교체해는 반기) 1건.

    도지사 표창은 1년에 1명뿐이라 자동 집계 없이 담당자가 처리 시 직접 체크한다.
    period_start = legislators.current_calendar_range(today)[0] (역년/반기 시작일).
    체크하면 행 추가, 해제하면 행 삭제.
    """

    __tablename__ = "governor_award_marks"
    __table_args__ = (
        UniqueConstraint("legislator_name", "period_start", name="uq_gov_mark_name_period"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    legislator_name = Column(String(100), nullable=False)
    period_start = Column(Date, nullable=False)
    marked_at = Column(DateTime, default=datetime.utcnow)
