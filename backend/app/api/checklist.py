"""대상자 자가 체크리스트 API"""
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .deps import get_recipient_or_404

router = APIRouter(tags=["checklist"])


def _mask_name(name: str) -> str:
    if not name:
        return ""
    if len(name) <= 1:
        return name + "*"
    return name[0] + "*" * (len(name) - 1)


@router.get(
    "/api/checklist/{recipient_id}/public-info",
    response_model=schemas.ChecklistPublicInfo,
)
def get_public_info(recipient_id: str, db: Session = Depends(get_db)):
    """대상자가 체크리스트 작성 페이지에서 확인할 수 있는 공개 정보 (이름 마스킹)"""
    r = get_recipient_or_404(db, recipient_id)
    return schemas.ChecklistPublicInfo(
        recipient_id=r.id,
        recipient_name_masked=_mask_name(r.recipient_name or ""),
        organization_name=r.organization_name,
        merit_category=r.merit_category,
        already_submitted=bool(r.checklist and r.checklist.submitted_at),
    )


@router.post(
    "/api/checklist/{recipient_id}/submit",
    response_model=schemas.ChecklistRead,
)
def submit_checklist(
    recipient_id: str,
    payload: schemas.ChecklistSubmit,
    request: Request,
    db: Session = Depends(get_db),
):
    """대상자 본인이 체크리스트 제출"""
    r = get_recipient_or_404(db, recipient_id)

    # 본인 확인: 입력한 이름이 등록된 이름과 일치하는지
    if (payload.self_confirm_name or "").strip() != (r.recipient_name or "").strip():
        raise HTTPException(
            status_code=400,
            detail="입력하신 이름이 등록된 추천대상자와 일치하지 않습니다.",
        )
    # 생년월일 확인 (있는 경우)
    if r.birth_date:
        try:
            entered = datetime.strptime(
                payload.self_confirm_birth.strip(), "%Y-%m-%d"
            ).date()
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="생년월일은 YYYY-MM-DD 형식이어야 합니다.",
            )
        if entered != r.birth_date:
            raise HTTPException(
                status_code=400,
                detail="입력하신 생년월일이 등록된 정보와 일치하지 않습니다.",
            )

    # 이미 제출되었으면 덮어쓰기 (필요 시 재작성 가능)
    cl = r.checklist or models.Checklist(recipient_id=r.id)

    for field in (
        "item_service_period",
        "item_service_period_note",
        "item_prior_award",
        "item_prior_award_note",
        "item_discipline",
        "item_discipline_note",
        "item_investigation",
        "item_investigation_note",
        "item_criminal",
        "item_criminal_note",
        "item_arrears",
        "item_arrears_note",
        "item_misconduct",
        "item_misconduct_note",
        "item_award_revoked",
        "item_award_revoked_note",
        "self_confirm_name",
        "self_confirm_birth",
    ):
        setattr(cl, field, getattr(payload, field))

    cl.submitted_at = datetime.utcnow()
    client_host = request.client.host if request.client else ""
    cl.submitter_ip = (request.headers.get("x-forwarded-for") or client_host)[:64]

    if cl.recipient_id and not r.checklist:
        db.add(cl)
    db.commit()
    db.refresh(cl)
    return cl


@router.get(
    "/api/recipients/{recipient_id}/checklist",
    response_model=schemas.ChecklistRead,
)
def get_checklist(recipient_id: str, db: Session = Depends(get_db)):
    """전문위원실용: 대상자의 체크리스트 조회"""
    r = get_recipient_or_404(db, recipient_id)
    if not r.checklist:
        raise HTTPException(status_code=404, detail="체크리스트가 아직 제출되지 않았습니다")
    return r.checklist


@router.patch(
    "/api/recipients/{recipient_id}/checklist/admin-review",
    response_model=schemas.ChecklistRead,
)
def submit_admin_review(
    recipient_id: str,
    payload: schemas.AdminReviewSubmit,
    db: Session = Depends(get_db),
):
    """관리자(전문위원실)가 공직선거법 검토 결과를 저장"""
    r = get_recipient_or_404(db, recipient_id)
    if not r.checklist:
        raise HTTPException(
            status_code=400,
            detail="대상자가 체크리스트를 먼저 제출해야 관리자 검토가 가능합니다",
        )
    cl = r.checklist
    cl.admin_election_law_general = payload.admin_election_law_general
    cl.admin_election_law_general_note = payload.admin_election_law_general_note
    cl.admin_election_law_basis = payload.admin_election_law_basis
    cl.admin_election_law_basis_note = payload.admin_election_law_basis_note
    cl.admin_election_law_art112 = payload.admin_election_law_art112
    cl.admin_election_law_art112_note = payload.admin_election_law_art112_note
    cl.admin_reviewer_name = payload.admin_reviewer_name
    cl.admin_reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(cl)
    return cl
