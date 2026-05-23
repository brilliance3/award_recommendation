"""대상자 공개 입력 API — 인증 없이 토큰만으로 본인 인적사항 입력.

워크플로우:
  1. 사무처 직원이 표창 건 생성 → 빈 대상자 N명 추가
  2. POST /api/recipients/{id}/issue-invitation → invitation_token 발급
  3. /invite/{token} 공개 URL 을 대상자(또는 의원)에게 전달
  4. 대상자가 본인 정보(성명, 한자, 생년월일, 핸드폰, 주소 등)를 직접 입력
  5. POST /api/invite/{token}/submit → status="submitted_by_recipient"
  6. 사무처 직원이 검토 후 공적사항/추천사유 보완 → 최종 제출

토큰 기반 인증이라 일반 /api/recipients/{id} 와 분리.
대상자가 본인 정보(인적사항)만 수정 가능, 공적사항/조사자/추천자는 수정 불가.
"""
from __future__ import annotations

import secrets
from datetime import date, datetime
from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from .deps import get_recipient_or_404

router = APIRouter(tags=["invite"])


class PublicRecipientView(BaseModel):
    """대상자가 본인 정보 입력할 때 보는 정보 (제한된 필드만)."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    award_case_title: Optional[str] = None
    award_grade: Optional[str] = None
    recommender_name: Optional[str] = None
    status: Optional[str] = "draft"
    submitted_at: Optional[datetime] = None

    recipient_name: Optional[str] = None
    chinese_name: Optional[str] = None
    birth_date: Optional[Union[date, str]] = None
    phone_number: Optional[str] = None
    address_zipcode: Optional[str] = None
    address: Optional[str] = None
    registered_address: Optional[str] = None
    nationality: Optional[str] = "대한민국"
    occupation: Optional[str] = None
    organization_name: Optional[str] = None
    recipient_position_title: Optional[str] = None
    external_title: Optional[str] = None


class PublicRecipientUpdate(BaseModel):
    """대상자가 본인이 직접 채울 수 있는 필드만."""
    recipient_name: Optional[str] = Field(None, max_length=100)
    chinese_name: Optional[str] = Field(None, max_length=100)
    birth_date: Optional[Union[date, str]] = None
    phone_number: Optional[str] = Field(None, max_length=30)
    address_zipcode: Optional[str] = Field(None, max_length=10)
    address: Optional[str] = Field(None, max_length=500)
    registered_address: Optional[str] = Field(None, max_length=500)
    nationality: Optional[str] = "대한민국"
    occupation: Optional[str] = Field(None, max_length=255)
    organization_name: Optional[str] = Field(None, max_length=255)
    recipient_position_title: Optional[str] = Field(None, max_length=255)
    external_title: Optional[str] = Field(None, max_length=255)


def _generate_token() -> str:
    return secrets.token_urlsafe(24)  # 약 32자


@router.post("/api/award-cases/{case_id}/bulk-invite")
def bulk_invite(case_id: str, db: Session = Depends(get_db)):
    """표창 건의 모든 대상자에게 일괄로 토큰 발급.

    표창건 공유 시 추천자(의원)가 대상자 목록을 보고
    각각의 입력 링크를 한 번에 받을 수 있음.
    """
    from .deps import get_case_or_404
    case = get_case_or_404(db, case_id)
    results = []
    for r in case.recipients:
        if not r.invitation_token:
            r.invitation_token = _generate_token()
            r.invited_at = datetime.utcnow()
            if r.status == "draft":
                r.status = "invited"
        results.append({
            "recipient_id": r.id,
            "recipient_name": r.recipient_name,
            "invitation_token": r.invitation_token,
            "public_url": f"/invite/{r.invitation_token}",
            "status": r.status,
        })
    db.commit()
    return {"case_id": case_id, "total": len(results), "links": results}


@router.post("/api/recipients/{recipient_id}/issue-invitation")
def issue_invitation(recipient_id: str, db: Session = Depends(get_db)):
    """대상자에게 보낼 공개 입력 토큰 발급/재발급."""
    r = get_recipient_or_404(db, recipient_id)
    r.invitation_token = _generate_token()
    r.invited_at = datetime.utcnow()
    if r.status == "draft":
        r.status = "invited"
    db.commit()
    return {
        "recipient_id": r.id,
        "invitation_token": r.invitation_token,
        "public_url": f"/invite/{r.invitation_token}",
        "issued_at": r.invited_at.isoformat() if r.invited_at else None,
    }


@router.post("/api/recipients/{recipient_id}/revoke-invitation")
def revoke_invitation(recipient_id: str, db: Session = Depends(get_db)):
    """토큰 폐기 — 더 이상 공개 URL 로 접근 불가."""
    r = get_recipient_or_404(db, recipient_id)
    r.invitation_token = None
    db.commit()
    return {"ok": True}


def _lookup_by_token(db: Session, token: str) -> models.Recipient:
    r = db.query(models.Recipient).filter_by(invitation_token=token).one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="유효하지 않은 링크입니다.")
    return r


@router.get("/api/invite/{token}", response_model=PublicRecipientView)
def get_by_token(token: str, db: Session = Depends(get_db)):
    """공개 토큰으로 본인 정보 조회 (대상자가 본인 입력 페이지 진입 시)."""
    r = _lookup_by_token(db, token)
    view = PublicRecipientView.model_validate(r)
    view.award_case_title = r.award_case.title if r.award_case else None
    view.award_grade = r.award_case.award_grade if r.award_case else None
    view.recommender_name = r.award_case.recommender_name if r.award_case else None
    view.birth_date = r.birth_date.isoformat() if r.birth_date else None
    return view


@router.patch("/api/invite/{token}", response_model=PublicRecipientView)
def update_by_token(token: str, payload: PublicRecipientUpdate, db: Session = Depends(get_db)):
    """공개 토큰으로 본인 정보 저장 (저장 버튼). 제출 전까지 여러 번 가능."""
    r = _lookup_by_token(db, token)
    data = payload.model_dump(exclude_unset=True)
    # birth_date 가 문자열로 들어오면 date 로 변환
    if "birth_date" in data and data["birth_date"]:
        from datetime import date
        try:
            data["birth_date"] = date.fromisoformat(data["birth_date"])
        except ValueError:
            del data["birth_date"]
    for k, v in data.items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)

    view = PublicRecipientView.model_validate(r)
    view.award_case_title = r.award_case.title if r.award_case else None
    view.award_grade = r.award_case.award_grade if r.award_case else None
    view.recommender_name = r.award_case.recommender_name if r.award_case else None
    view.birth_date = r.birth_date.isoformat() if r.birth_date else None
    return view


@router.post("/api/invite/{token}/submit", response_model=PublicRecipientView)
def submit_by_token(token: str, db: Session = Depends(get_db)):
    """대상자가 '제출' 버튼 누름 → status 변경 + submitted_at 기록."""
    r = _lookup_by_token(db, token)
    if not r.recipient_name or not r.phone_number:
        raise HTTPException(status_code=400, detail="성명과 핸드폰 번호는 필수입니다.")
    r.status = "submitted_by_recipient"
    r.submitted_at = datetime.utcnow()
    db.commit()
    db.refresh(r)

    view = PublicRecipientView.model_validate(r)
    view.award_case_title = r.award_case.title if r.award_case else None
    view.award_grade = r.award_case.award_grade if r.award_case else None
    view.recommender_name = r.award_case.recommender_name if r.award_case else None
    view.birth_date = r.birth_date.isoformat() if r.birth_date else None
    return view
