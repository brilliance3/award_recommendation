"""URL → 후보자 정보 추출 서비스

2차 기능: 임의 URL을 입력받아 본문 텍스트에서 이름/소속/직위/활동 키워드 추정.
규칙 기반 1차, 추후 LLM으로 확장 가능.
"""
from __future__ import annotations

import re
from typing import List, Optional

import httpx
from bs4 import BeautifulSoup

from ..schemas.documents import URLExtractResponse


_NAME_PATTERNS = [
    re.compile(r"성\s*명[:：]\s*([가-힣]{2,4})"),
    re.compile(r"이\s*름[:：]\s*([가-힣]{2,4})"),
    re.compile(r"([가-힣]{2,4})\s*(?:회장|협회장|위원장|이사장|대표|단장|원장|소장|총무)"),
]
_POSITION_KEYWORDS = ["회장", "협회장", "위원장", "이사장", "대표", "단장", "원장", "소장", "총무", "사무국장"]
_ORG_SUFFIXES = ["협회", "재단", "단체", "위원회", "후원회", "센터", "지부", "협동조합", "법인"]
_ACTIVITY_KEYWORDS_POOL = [
    "봉사", "지원", "기부", "후원", "헌신", "기여", "참여", "활동",
    "복지", "취약계층", "어려운 이웃", "지역사회", "주민화합", "나눔",
    "청렴", "성실", "정직", "솔선수범",
]


def _extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text("\n")
    text = re.sub(r"\n+", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _find_name(text: str) -> Optional[str]:
    for pat in _NAME_PATTERNS:
        m = pat.search(text)
        if m:
            return m.group(1)
    return None


def _find_position(text: str) -> Optional[str]:
    for kw in _POSITION_KEYWORDS:
        if kw in text:
            return kw
    return None


def _find_organization(text: str) -> Optional[str]:
    for suf in _ORG_SUFFIXES:
        m = re.search(rf"([가-힣A-Za-z0-9·]+\s?{suf})", text)
        if m:
            return m.group(1).strip()
    return None


def _find_keywords(text: str) -> List[str]:
    return [kw for kw in _ACTIVITY_KEYWORDS_POOL if kw in text][:8]


def extract_from_url(url: str) -> URLExtractResponse:
    try:
        resp = httpx.get(url, timeout=10.0, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        text = _extract_text(resp.text)
    except Exception:
        return URLExtractResponse(raw_text="")

    return URLExtractResponse(
        recipient_name=_find_name(text),
        organization_name=_find_organization(text),
        position=_find_position(text),
        merit_keywords=_find_keywords(text),
        raw_text=text[:4000],
    )
