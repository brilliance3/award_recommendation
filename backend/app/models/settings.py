"""설정 + 의원 명단 모델 (부서·기관·조사자·도장을 담당자가 수정 가능하게 DB화)."""
import uuid

from sqlalchemy import Boolean, Column, Integer, String

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
    # 경기도지사 표창 — 위원장 구분 없이 의원당 1년(역년) 1명
    governor_award_grade = Column(String(255), default="경기도지사 표창")
    governor_quota_per_year = Column(Integer, default=1)
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
