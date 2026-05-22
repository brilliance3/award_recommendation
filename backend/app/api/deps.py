"""API 공통 의존성"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models


def get_case_or_404(db: Session, case_id: str) -> models.AwardCase:
    case = db.query(models.AwardCase).filter(models.AwardCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="표창 건을 찾을 수 없습니다")
    return case


def get_recipient_or_404(db: Session, recipient_id: str) -> models.Recipient:
    r = db.query(models.Recipient).filter(models.Recipient.id == recipient_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="대상자를 찾을 수 없습니다")
    return r
