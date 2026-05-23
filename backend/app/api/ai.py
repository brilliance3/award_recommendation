"""AI 보조 API - OpenAI 기반 문장 다듬기/요약/핑

기존 merit_contents API의 generate-merit 와는 독립.
의원/추천대상자가 폼에서 사용하는 "AI 다듬기/요약" 버튼용.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..services import openai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


class PolishRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)
    target_style: Optional[str] = "행정문서"


class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)
    max_chars: int = Field(default=50, ge=20, le=200)


class AIResponse(BaseModel):
    ok: bool
    text: str = ""
    model: Optional[str] = None
    error: Optional[str] = None


@router.get("/ping", response_model=AIResponse)
def ai_ping():
    """OpenAI API Key 동작 확인."""
    r = openai_service.ping()
    return AIResponse(ok=r.ok, text=r.text, model=r.model, error=r.error)


@router.post("/polish", response_model=AIResponse)
def ai_polish(payload: PolishRequest):
    r = openai_service.polish_text(payload.text, payload.target_style or "행정문서")
    return AIResponse(ok=r.ok, text=r.text, model=r.model, error=r.error)


@router.post("/summarize", response_model=AIResponse)
def ai_summarize(payload: SummarizeRequest):
    r = openai_service.summarize_merit(payload.text, payload.max_chars)
    return AIResponse(ok=r.ok, text=r.text, model=r.model, error=r.error)
