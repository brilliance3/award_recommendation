"""표창 건 API"""
from __future__ import annotations

from datetime import datetime

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
        recips = list(case.recipients)
        data.recipient_count = len(recips)
        # 대상자 개인별 표창일(미설정 시 case.award_date 폴백)의 대표값=최솟값,
        # 서로 다른 날짜 개수=award_date_count(>1이면 목록에서 '복수' 표시).
        eff = [(r.award_date or case.award_date) for r in recips]
        eff = [d for d in eff if d]
        if eff:
            data.award_date = min(eff)
        data.award_date_count = len(set(eff))
    except Exception:
        data.recipient_count = 0
    return data


def _to_detail(case: models.AwardCase) -> schemas.AwardCaseDetail:
    detail = schemas.AwardCaseDetail.model_validate(case)
    try:
        recips = list(case.recipients)
        detail.recipient_count = len(recips)
        # 대상자별 관리자 검토 완료(checklist.admin_reviewed_at) 표시 + 전체 검토 여부.
        # detail.recipients는 case.recipients와 동일 순서로 생성됨.
        for d, r in zip(detail.recipients, recips):
            d.admin_reviewed = bool(
                r.checklist is not None and r.checklist.admin_reviewed_at is not None
            )
        detail.all_reviewed = len(recips) > 0 and all(
            d.admin_reviewed for d in detail.recipients
        )
    except Exception:
        detail.recipient_count = 0
        detail.all_reviewed = False
    return detail


@router.get("", response_model=list[schemas.AwardCaseRead])
def list_cases(db: Session = Depends(get_db)) -> list[schemas.AwardCaseRead]:
    cases = (
        db.query(models.AwardCase)
        .filter(models.AwardCase.deleted_at.is_(None))
        .order_by(models.AwardCase.created_at.desc())
        .all()
    )
    return [_to_read(c) for c in cases]


@router.post("", response_model=schemas.AwardCaseRead)
def create_case(payload: schemas.AwardCaseCreate, db: Session = Depends(get_db)):
    case = models.AwardCase(**payload.model_dump())
    db.add(case)
    db.commit()
    db.refresh(case)
    return _to_read(case)


# --- 휴지통 (정적 경로 — /{case_id} 동적 라우트보다 먼저 등록) ---
@router.get("/trash", response_model=list[schemas.AwardCaseRead])
def list_trash(db: Session = Depends(get_db)) -> list[schemas.AwardCaseRead]:
    """휴지통(삭제됨) 목록 — 최근 삭제순."""
    cases = (
        db.query(models.AwardCase)
        .filter(models.AwardCase.deleted_at.isnot(None))
        .order_by(models.AwardCase.deleted_at.desc())
        .all()
    )
    return [_to_read(c) for c in cases]


@router.post("/trash-all")
def trash_all(db: Session = Depends(get_db)):
    """관리 목록의 모든 표창건을 휴지통으로 이동 (전체 삭제)."""
    now = datetime.utcnow()
    db.query(models.AwardCase).filter(models.AwardCase.deleted_at.is_(None)).update(
        {models.AwardCase.deleted_at: now}, synchronize_session=False
    )
    db.commit()
    return {"ok": True}


@router.post("/restore-all")
def restore_all(db: Session = Depends(get_db)):
    """휴지통의 모든 표창건을 관리로 복구 (전체 복구)."""
    db.query(models.AwardCase).filter(models.AwardCase.deleted_at.isnot(None)).update(
        {models.AwardCase.deleted_at: None}, synchronize_session=False
    )
    db.commit()
    return {"ok": True}


@router.delete("/trash/empty")
def empty_trash(db: Session = Depends(get_db)):
    """휴지통 비우기 — 삭제된 표창건을 영구 삭제(대상자·문서 cascade)."""
    cases = (
        db.query(models.AwardCase)
        .filter(models.AwardCase.deleted_at.isnot(None))
        .all()
    )
    for c in cases:
        db.delete(c)
    db.commit()
    return {"ok": True, "deleted": len(cases)}


@router.get("/{case_id}", response_model=schemas.AwardCaseDetail)
def get_case(case_id: str, db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    return _to_detail(case)


@router.get("/{case_id}/preview-data", response_model=schemas.AwardCasePreview)
def get_case_preview(case_id: str, db: Session = Depends(get_db)):
    """문서 미리보기용 — 각 recipient의 본문·경력·과거표창까지 포함된 전체 detail."""
    case = get_case_or_404(db, case_id)
    preview = schemas.AwardCasePreview.model_validate(case)
    try:
        preview.recipient_count = len(case.recipients)
    except Exception:
        preview.recipient_count = 0
    return preview


@router.patch("/{case_id}", response_model=schemas.AwardCaseRead)
def update_case(case_id: str, payload: schemas.AwardCaseUpdate, db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    data = payload.model_dump(exclude_unset=True)
    # seal_applied 변경 시 도장 날짜 기록/해제 (현지조사 확인서 날짜로 사용)
    if "seal_applied" in data:
        if data["seal_applied"] and not case.seal_applied:
            case.seal_applied_at = datetime.utcnow()
        elif not data["seal_applied"]:
            case.seal_applied_at = None
    for k, v in data.items():
        setattr(case, k, v)
    # 추천의원이 바뀌면 공적조서 추천관(full_title)도 재생성 (예: 의원→위원장 이전)
    if "recommender_name" in data:
        setting = db.query(models.AppSetting).first()
        agency = (setting.agency_name if setting else None) or "경기도의회"
        committee = (
            case.recommender_department
            or (setting.committee_name if setting else None)
            or "보건복지위원회"
        )
        case.recommender_full_title = (
            f"{agency} {committee} 의원   {case.recommender_name or ''}"
        )
    db.commit()
    db.refresh(case)
    return _to_read(case)


@router.delete("/{case_id}")
def delete_case(case_id: str, db: Session = Depends(get_db)):
    """삭제 → 휴지통으로 이동(soft delete)."""
    case = get_case_or_404(db, case_id)
    case.deleted_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/{case_id}/restore")
def restore_case(case_id: str, db: Session = Depends(get_db)):
    """휴지통 → 관리로 복구."""
    case = get_case_or_404(db, case_id)
    case.deleted_at = None
    db.commit()
    return {"ok": True}


@router.delete("/{case_id}/permanent")
def permanent_delete_case(case_id: str, db: Session = Depends(get_db)):
    """완전 삭제 — 표창건·대상자·문서를 DB에서 영구 제거."""
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


# --- 관리 링크 자격(아이디/비밀번호) — 담당자(관리자)용 조회·재설정 ---
# 대표가 관리 링크 자격을 잊으면 담당자에게 문의하므로, 관리자가 평문으로 확인하고 재설정할 수 있다.
@router.get("/{case_id}/manage-credentials", response_model=schemas.ManageCredentialsRead)
def get_manage_credentials(case_id: str, db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    return schemas.ManageCredentialsRead(
        protected=bool(case.manage_password),
        username=case.manage_username or "",
        password=case.manage_password or "",
    )


@router.put("/{case_id}/manage-credentials", response_model=schemas.ManageCredentialsRead)
def set_manage_credentials(
    case_id: str, payload: schemas.ManageCredentialsUpdate, db: Session = Depends(get_db)
):
    from .applications import _apply_manage_credentials

    case = get_case_or_404(db, case_id)
    _apply_manage_credentials(case, payload)
    db.commit()
    db.refresh(case)
    return schemas.ManageCredentialsRead(
        protected=bool(case.manage_password),
        username=case.manage_username or "",
        password=case.manage_password or "",
    )
