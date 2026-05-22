"""표창 건 API"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import UPLOAD_DIR
from ..database import get_db
from ..services import xlsx_importer
from .deps import get_case_or_404

router = APIRouter(prefix="/api/award-cases", tags=["award-cases"])


def _to_read(case: models.AwardCase) -> schemas.AwardCaseRead:
    data = schemas.AwardCaseRead.model_validate(case)
    try:
        data.recipient_count = len(case.recipients)
    except Exception:
        data.recipient_count = 0
    return data


def _to_detail(case: models.AwardCase) -> schemas.AwardCaseDetail:
    detail = schemas.AwardCaseDetail.model_validate(case)
    try:
        detail.recipient_count = len(case.recipients)
    except Exception:
        detail.recipient_count = 0
    return detail


@router.get("", response_model=list[schemas.AwardCaseRead])
def list_cases(db: Session = Depends(get_db)) -> list[schemas.AwardCaseRead]:
    cases = db.query(models.AwardCase).order_by(models.AwardCase.created_at.desc()).all()
    return [_to_read(c) for c in cases]


@router.post("", response_model=schemas.AwardCaseRead)
def create_case(payload: schemas.AwardCaseCreate, db: Session = Depends(get_db)):
    case = models.AwardCase(**payload.model_dump())
    db.add(case)
    db.commit()
    db.refresh(case)
    return _to_read(case)


@router.get("/{case_id}", response_model=schemas.AwardCaseDetail)
def get_case(case_id: str, db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    return _to_detail(case)


@router.patch("/{case_id}", response_model=schemas.AwardCaseRead)
def update_case(case_id: str, payload: schemas.AwardCaseUpdate, db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(case, k, v)
    db.commit()
    db.refresh(case)
    return _to_read(case)


@router.delete("/{case_id}")
def delete_case(case_id: str, db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    db.delete(case)
    db.commit()
    return {"ok": True}


@router.post("/{case_id}/import-xlsx", response_model=schemas.AwardCaseDetail)
async def import_xlsx(case_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """기존 표창대상자 XLSX 업로드 → 대상자 일괄 등록"""
    case = get_case_or_404(db, case_id)
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="XLSX 파일만 업로드 가능합니다")
    dst = UPLOAD_DIR / f"{case_id}_{file.filename}"
    with open(dst, "wb") as f:
        f.write(await file.read())

    new_recipients = xlsx_importer.import_recipients_from_xlsx(dst, case)
    for r in new_recipients:
        r.award_case_id = case.id
        db.add(r)
    db.commit()
    db.refresh(case)
    return _to_detail(case)
