"""공적 내용 / 경력 / 과거표창 / AI 생성 API"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from .. import ratelimit
from ..database import get_db
from ..services import merit_generator
from .deps import get_recipient_or_404

router = APIRouter(tags=["merit-contents"])


def _ensure_merit_content(recipient: models.Recipient, db: Session) -> models.MeritContent:
    if recipient.merit_content is None:
        mc = models.MeritContent(recipient_id=recipient.id)
        db.add(mc)
        db.flush()
        recipient.merit_content = mc
    return recipient.merit_content


@router.put(
    "/api/recipients/{recipient_id}/merit-content",
    response_model=schemas.MeritContentRead,
)
def upsert_merit_content(
    recipient_id: str,
    payload: schemas.MeritContentUpdate,
    db: Session = Depends(get_db),
):
    r = get_recipient_or_404(db, recipient_id)
    mc = _ensure_merit_content(r, db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(mc, k, v)
    db.commit()
    db.refresh(mc)
    return schemas.MeritContentRead.model_validate(mc)


@router.post(
    "/api/recipients/{recipient_id}/generate-merit",
    response_model=schemas.MeritContentRead,
)
def generate_merit(
    recipient_id: str,
    payload: schemas.MeritGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    # AI 생성 남용/비용 방지 — IP별 슬라이딩 윈도(분당 10회). 초과 시 429.
    ratelimit.enforce(request, "generate-merit", limit=10, window_sec=60)
    r = get_recipient_or_404(db, recipient_id)
    mc = _ensure_merit_content(r, db)

    # 단일테넌트: 부서별 키 없음 → 전역 GEMINI_API_KEY 폴백(gkey=None).
    gkey = None

    # 실제 제출된 경력·과거표창을 AI 프롬프트의 사실 근거로 전달
    career_lines = [
        f"{(c.record_date or '').strip()} {(c.description or '').strip()}".strip()
        for c in (r.career_records or [])
        if (c.description or "").strip()
    ]
    prev_award_lines = [
        f"{(p.award_date or '').strip()} {(p.description or '').strip()}".strip()
        for p in (r.previous_awards or [])
        if (p.description or "").strip()
    ]

    mode = payload.mode

    if payload.generate_full_text:
        mc.full_merit_text = merit_generator.generate_merit_full_text(
            r,
            payload.keywords,
            payload.activity_summary,
            gemini_api_key=gkey,
            mode=mode,
            existing_text=payload.existing_full_text,
            career_lines=career_lines,
            prev_award_lines=prev_award_lines,
        )
    if payload.generate_summary:
        mc.merit_short_summary = merit_generator.generate_merit_short_summary(
            r,
            gemini_api_key=gkey,
            mode=mode,
            existing_text=payload.existing_summary,
            career_lines=career_lines,
            prev_award_lines=prev_award_lines,
            activity_summary=payload.activity_summary,
        )
    if payload.generate_reason:
        mc.recommendation_reason = merit_generator.generate_recommendation_reason(
            r,
            gemini_api_key=gkey,
            mode=mode,
            existing_text=payload.existing_reason,
            career_lines=career_lines,
            prev_award_lines=prev_award_lines,
            activity_summary=payload.activity_summary,
        )

    db.commit()
    db.refresh(mc)
    return schemas.MeritContentRead.model_validate(mc)


@router.post(
    "/api/recipients/{recipient_id}/career-records",
    response_model=schemas.CareerRecordRead,
)
def add_career(recipient_id: str, payload: schemas.CareerRecordCreate, db: Session = Depends(get_db)):
    r = get_recipient_or_404(db, recipient_id)
    record = models.CareerRecord(recipient_id=r.id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return schemas.CareerRecordRead.model_validate(record)


@router.delete("/api/career-records/{record_id}")
def delete_career(record_id: str, db: Session = Depends(get_db)):
    rec = db.query(models.CareerRecord).filter(models.CareerRecord.id == record_id).first()
    if rec:
        db.delete(rec)
        db.commit()
    return {"ok": True}


@router.post(
    "/api/recipients/{recipient_id}/previous-awards",
    response_model=schemas.PreviousAwardRead,
)
def add_previous_award(
    recipient_id: str,
    payload: schemas.PreviousAwardCreate,
    db: Session = Depends(get_db),
):
    r = get_recipient_or_404(db, recipient_id)
    rec = models.PreviousAward(recipient_id=r.id, **payload.model_dump())
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return schemas.PreviousAwardRead.model_validate(rec)


@router.delete("/api/previous-awards/{record_id}")
def delete_previous_award(record_id: str, db: Session = Depends(get_db)):
    rec = db.query(models.PreviousAward).filter(models.PreviousAward.id == record_id).first()
    if rec:
        db.delete(rec)
        db.commit()
    return {"ok": True}
