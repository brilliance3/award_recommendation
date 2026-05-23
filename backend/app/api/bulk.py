"""표창건 단위 일괄 작업 API.

- 일괄 AI 초안 생성: 표창건의 모든 대상자에게 한 번에 공적사항 초안 생성
- 일괄 HWPX 생성: 모든 대상자 HWPX 한 번에 생성

대량 처리 시 시간이 오래 걸리므로 결과만 단순 집계해 반환.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..services import hwpx_generator, merit_generator
from .deps import get_case_or_404

router = APIRouter(prefix="/api/award-cases", tags=["bulk"])


class BulkAIRequest(BaseModel):
    keywords: list[str] = []
    overwrite: bool = False


class BulkAIResultItem(BaseModel):
    recipient_id: str
    recipient_name: str
    ok: bool
    skipped: bool = False
    error: str | None = None


class BulkAIResponse(BaseModel):
    total: int
    success: int
    skipped: int
    failed: int
    items: list[BulkAIResultItem]


@router.post("/{case_id}/bulk-ai-merit", response_model=BulkAIResponse)
def bulk_ai_merit(
    case_id: str,
    payload: BulkAIRequest,
    db: Session = Depends(get_db),
):
    """모든 대상자에 대해 AI 공적초안 일괄 생성. 기존 본문이 있으면 기본 skip."""
    case = get_case_or_404(db, case_id)
    items: list[BulkAIResultItem] = []
    success = skipped = failed = 0

    for r in case.recipients:
        try:
            existing = r.merit_content
            if existing and existing.full_merit_text and not payload.overwrite:
                items.append(BulkAIResultItem(
                    recipient_id=r.id, recipient_name=r.recipient_name,
                    ok=True, skipped=True,
                ))
                skipped += 1
                continue

            full_text = merit_generator.generate_merit_full_text(
                r, payload.keywords or ["봉사", "헌신", "지역사회 화합"], None,
            )
            short = merit_generator.generate_merit_short_summary(r)
            reason = merit_generator.generate_recommendation_reason(r)

            if not existing:
                existing = models.MeritContent(recipient_id=r.id)
                db.add(existing)
            existing.full_merit_text = full_text
            existing.merit_short_summary = short
            existing.recommendation_reason = reason

            success += 1
            items.append(BulkAIResultItem(
                recipient_id=r.id, recipient_name=r.recipient_name, ok=True,
            ))
        except Exception as exc:  # noqa: BLE001
            failed += 1
            items.append(BulkAIResultItem(
                recipient_id=r.id, recipient_name=r.recipient_name,
                ok=False, error=f"{type(exc).__name__}: {exc}",
            ))

    db.commit()
    return BulkAIResponse(
        total=len(items), success=success, skipped=skipped, failed=failed,
        items=items,
    )


class BulkHwpxResultItem(BaseModel):
    recipient_id: str
    recipient_name: str
    ok: bool
    file_name: str | None = None
    download_url: str | None = None
    error: str | None = None


class BulkHwpxResponse(BaseModel):
    total: int
    success: int
    failed: int
    items: list[BulkHwpxResultItem]


@router.post("/{case_id}/bulk-hwpx", response_model=BulkHwpxResponse)
def bulk_hwpx(case_id: str, db: Session = Depends(get_db)):
    """표창건 모든 대상자의 HWPX 일괄 생성."""
    case = get_case_or_404(db, case_id)
    items: list[BulkHwpxResultItem] = []
    success = failed = 0

    for r in case.recipients:
        try:
            path = hwpx_generator.generate_hwpx(case, r)
            from urllib.parse import quote
            items.append(BulkHwpxResultItem(
                recipient_id=r.id, recipient_name=r.recipient_name,
                ok=True, file_name=path.name,
                download_url=f"/api/files/{quote(path.name)}",
            ))
            success += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            items.append(BulkHwpxResultItem(
                recipient_id=r.id, recipient_name=r.recipient_name,
                ok=False, error=f"{type(exc).__name__}: {exc}",
            ))

    return BulkHwpxResponse(total=len(items), success=success, failed=failed, items=items)
