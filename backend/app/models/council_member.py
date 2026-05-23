"""경기도의회 의원 / 상임위원회 정보 모델"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from ..database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class CouncilCommittee(Base):
    """상임위원회 / 특별위원회"""

    __tablename__ = "council_committees"

    id = Column(String(36), primary_key=True, default=_uuid)
    code = Column(String(20), unique=True, index=True)
    name = Column(String(100), nullable=False)
    short_name = Column(String(50))
    kind = Column(String(20), default="standing")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class CouncilMember(Base):
    """경기도의회 의원"""

    __tablename__ = "council_members"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(50), nullable=False, index=True)
    chinese_name = Column(String(50))
    english_name = Column(String(100))
    party = Column(String(50))
    district = Column(String(200))
    district_detail = Column(String(500))
    term_count = Column(Integer, default=1)
    committee_name = Column(String(100))
    committee_role = Column(String(50))
    council_role = Column(String(50))
    phone = Column(String(50))
    fax = Column(String(50))
    email = Column(String(200))
    office_room = Column(String(50))
    photo_url = Column(String(500))
    blog_url = Column(String(500))
    aide_name = Column(String(100))
    aide_phone = Column(String(50))
    biography = Column(Text)
    pledges = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
