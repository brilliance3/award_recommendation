"""API 공통 의존성"""
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models


def get_case_by_share_token_or_404(db: Session, share_token: str) -> models.AwardCase:
    """공유 토큰 → 유효한(자가추가 가능한) AwardCase 조회.

    유효 조건: 토큰 일치 + 미삭제 + 공유 활성(enabled) + 미만료 + 상태가 완료/취소 아님.
    어떤 실패든 동일한 404로 응답(존재 여부 오라클 방지)."""
    not_found = HTTPException(status_code=404, detail="유효하지 않거나 만료된 링크입니다.")
    token = (share_token or "").strip()
    if not token:
        raise not_found
    case = (
        db.query(models.AwardCase)
        .filter(
            models.AwardCase.share_token == token,
            models.AwardCase.deleted_at.is_(None),
        )
        .first()
    )
    if not case or not case.share_enabled:
        raise not_found
    if case.share_expires_at and case.share_expires_at < datetime.utcnow():
        raise not_found
    if (case.status or "") in ("완료", "취소"):
        raise not_found
    return case


def get_case_by_manage_token_or_404(db: Session, manage_token: str) -> models.AwardCase:
    """기관 대표 전용 관리 토큰 → AwardCase 조회(검토·최종제출용).

    토큰 일치 + 미삭제면 통과. 만료/회수 개념은 없다(대표는 언제든 검토·제출 가능).
    실패 시 동일 404."""
    not_found = HTTPException(status_code=404, detail="유효하지 않은 관리 링크입니다.")
    token = (manage_token or "").strip()
    if not token:
        raise not_found
    case = (
        db.query(models.AwardCase)
        .filter(
            models.AwardCase.manage_token == token,
            models.AwardCase.deleted_at.is_(None),
        )
        .first()
    )
    if not case:
        raise not_found
    return case


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
