"""문서 생성 / URL 추출 응답 스키마"""
from typing import List, Optional

from pydantic import BaseModel


class GeneratedFileInfo(BaseModel):
    type: str  # merit_overview | merit_report | recipient_list
    file_name: str
    download_url: str


class GenerateDocumentResponse(BaseModel):
    files: List[GeneratedFileInfo]


class URLExtractRequest(BaseModel):
    url: str


class URLExtractResponse(BaseModel):
    recipient_name: Optional[str] = None
    organization_name: Optional[str] = None
    position: Optional[str] = None
    merit_keywords: List[str] = []
    raw_text: Optional[str] = None
    # 진단용 — 프론트에서 사용자에게 명확한 피드백을 주기 위해 추가
    status: str = "ok"  # ok | fetch_failed | parse_empty
    status_message: Optional[str] = None
    page_title: Optional[str] = None
    text_length: int = 0
