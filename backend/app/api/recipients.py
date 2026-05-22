"""표창 대상자 API"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services import pdf_generator
from .deps import get_case_or_404, get_recipient_or_404

router = APIRouter(tags=["recipients"])


@router.post(
    "/api/award-cases/{case_id}/recipients",
    response_model=schemas.RecipientDetail,
)
def create_recipient(case_id: str, payload: schemas.RecipientCreate, db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    data = payload.model_dump()
    if not data.get("sequence_no"):
        data["sequence_no"] = (len(case.recipients) + 1) if case.recipients else 1
    recipient = models.Recipient(award_case_id=case.id, **data)

    # 빈 merit_content 자동 생성
    recipient.merit_content = models.MeritContent()
    db.add(recipient)
    db.commit()
    db.refresh(recipient)
    return schemas.RecipientDetail.model_validate(recipient)


@router.get("/api/recipients/{recipient_id}", response_model=schemas.RecipientDetail)
def get_recipient(recipient_id: str, db: Session = Depends(get_db)):
    r = get_recipient_or_404(db, recipient_id)
    return schemas.RecipientDetail.model_validate(r)


@router.patch("/api/recipients/{recipient_id}", response_model=schemas.RecipientDetail)
def update_recipient(recipient_id: str, payload: schemas.RecipientUpdate, db: Session = Depends(get_db)):
    r = get_recipient_or_404(db, recipient_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return schemas.RecipientDetail.model_validate(r)


@router.delete("/api/recipients/{recipient_id}")
def delete_recipient(recipient_id: str, db: Session = Depends(get_db)):
    r = get_recipient_or_404(db, recipient_id)
    db.delete(r)
    db.commit()
    return {"ok": True}


@router.get("/api/recipients/{recipient_id}/preview", response_class=HTMLResponse)
def preview_html(recipient_id: str, db: Session = Depends(get_db)):
    """공적조서 HTML 미리보기"""
    r = get_recipient_or_404(db, recipient_id)
    if not r.award_case:
        raise HTTPException(status_code=400, detail="표창 건 정보가 없습니다")
    html = pdf_generator.render_html_for_preview(r.award_case, r)
    return HTMLResponse(content=html)
