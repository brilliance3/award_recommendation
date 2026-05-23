"""경기도의회 의원/상임위 시드 데이터를 DB 에 적재."""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from ..models import CouncilCommittee, CouncilMember

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def seed_committees(db: Session) -> int:
    """상임위원회 시드. 기존 코드가 있으면 업데이트, 없으면 신규."""
    path = DATA_DIR / "council_committees.json"
    if not path.exists():
        return 0
    items = json.loads(path.read_text(encoding="utf-8"))
    n = 0
    for item in items:
        existing = db.query(CouncilCommittee).filter_by(code=item["code"]).one_or_none()
        if existing:
            for k, v in item.items():
                setattr(existing, k, v)
        else:
            db.add(CouncilCommittee(**item))
            n += 1
    db.commit()
    return n


def seed_members(db: Session) -> int:
    """의원 시드. 이름+지역구 조합으로 중복 검사."""
    path = DATA_DIR / "council_members.json"
    if not path.exists():
        return 0
    items = json.loads(path.read_text(encoding="utf-8"))
    n = 0
    for item in items:
        existing = (
            db.query(CouncilMember)
            .filter_by(name=item["name"], district=item.get("district"))
            .one_or_none()
        )
        if existing:
            for k, v in item.items():
                setattr(existing, k, v)
        else:
            db.add(CouncilMember(**item))
            n += 1
    db.commit()
    return n


def seed_all(db: Session) -> dict:
    return {
        "committees_new": seed_committees(db),
        "members_new": seed_members(db),
    }
