"""URL → 후보자 정보 추출 서비스

임의 URL을 입력받아 본문 텍스트에서 이름/소속/직위/활동 키워드 추정.
규칙 기반 1차, 추후 LLM으로 확장 가능.

지방자치단체·협회·뉴스 기사 등 다양한 페이지를 지원하도록 패턴을 확장.
실패 시 status / status_message 필드로 명확한 사유를 돌려준다.
"""
from __future__ import annotations

import logging
import re
from typing import List, Optional, Tuple

import httpx
from bs4 import BeautifulSoup

from ..schemas.documents import URLExtractResponse

logger = logging.getLogger("award.url_extractor")


# ── 직위 키워드 (긴 것 먼저 매칭 — '부회장' 이 '회장'보다 우선되도록 정렬) ──
_POSITION_KEYWORDS: List[str] = sorted(
    [
        # 의회 / 의원
        "의원", "부의장", "의장", "위원장", "부위원장", "간사",
        # 단체 임원
        "회장", "부회장", "협회장", "이사장", "부이사장", "이사", "감사",
        # 대표
        "대표이사", "대표", "원장", "부원장", "소장", "센터장",
        # 행정 일반
        "사무총장", "사무국장", "총무", "사무처장",
        "단장", "부단장", "팀장", "실장", "부장", "차장", "과장", "계장",
        # 학교/병원/기업
        "교장", "교감", "원감", "총장", "부총장", "학장", "주임",
    ],
    key=len,
    reverse=True,
)

# ── 기관/조직 접미사 ──
_ORG_SUFFIXES: List[str] = sorted(
    [
        # 행정
        "도청", "시청", "군청", "구청",
        "도의회", "시의회", "군의회", "구의회", "의회",
        "위원회", "위원실",
        # 단체
        "협회", "재단", "법인", "단체", "협의회", "협동조합",
        "후원회", "동호회", "연구원", "연구소",
        # 시설
        "센터", "지부", "지회", "지원단", "복지관", "보건소",
        # 학교/병원/기업
        "학교", "대학교", "대학", "병원", "의원", "주식회사", "(주)",
    ],
    key=len,
    reverse=True,
)

# ── 인명 + 직위 패턴 ──
_POSITION_REGEX = "|".join(re.escape(p) for p in _POSITION_KEYWORDS)
# 한글 2~4자 성명 + (공백 0~2자) + 직위
_NAME_BEFORE_POSITION = re.compile(
    rf"([가-힣]{{2,4}})\s{{0,2}}(?:{_POSITION_REGEX})"
)
_NAME_LABELED = re.compile(
    r"(?:성\s*명|이\s*름|대상자\s*명?|수상자\s*명?)\s*[:：\-]?\s*([가-힣]{2,4})"
)
# 큰따옴표/소괄호 안 인용 — "○○○ 씨는", "(○○○)"
_NAME_QUOTED = re.compile(r"[\"\(（“]([가-힣]{2,4})[\"\)）”]")
_NAME_WITH_AGE = re.compile(r"([가-힣]{2,4})\s*\(?\s*(?:만\s*)?\d{1,3}\s*(?:세|살|·)")

_NAME_PATTERNS = [
    _NAME_LABELED,
    _NAME_BEFORE_POSITION,
    _NAME_QUOTED,
    _NAME_WITH_AGE,
]

# 한글 인명에서 일반 명사·조사 오인식을 줄이기 위한 블랙리스트
_NAME_BLACKLIST = {
    "오늘", "내일", "어제", "지난", "올해", "작년", "내년",
    "오전", "오후", "이번", "다음", "이런", "저런",
    "여러", "모든", "각종", "최근", "당시",
    "기자", "취재", "보도", "사진", "영상", "관련",
    "위원", "단원", "회원", "당원", "주민",  # '○○위원' 으로 잘리는 경우 방지
}


def _looks_like_name(name: str) -> bool:
    if name in _NAME_BLACKLIST:
        return False
    # 길이는 2~4자
    if len(name) < 2 or len(name) > 4:
        return False
    return True


def _extract_text_and_title(html: str) -> Tuple[str, Optional[str], Optional[str]]:
    """HTML → 본문 텍스트, <title>, og:title 추출."""
    soup = BeautifulSoup(html, "html.parser")

    # 노이즈 제거
    for tag in soup(["script", "style", "noscript", "iframe", "svg", "header", "footer", "nav"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title and soup.title.string else None
    og = soup.find("meta", attrs={"property": "og:title"})
    og_title = og["content"].strip() if og and og.get("content") else None

    text = soup.get_text("\n")
    text = re.sub(r"\n+", "\n", text)
    text = re.sub(r"[ \t ]+", " ", text)
    return text.strip(), title, og_title


def _find_name(*texts: str) -> Optional[str]:
    """여러 텍스트 소스에서 가장 그럴듯한 한글 인명을 찾는다."""
    for text in texts:
        if not text:
            continue
        for pat in _NAME_PATTERNS:
            for m in pat.finditer(text):
                candidate = m.group(1)
                if _looks_like_name(candidate):
                    return candidate
    return None


def _find_position(*texts: str) -> Optional[str]:
    for text in texts:
        if not text:
            continue
        for kw in _POSITION_KEYWORDS:
            if kw in text:
                return kw
    return None


def _find_organization(*texts: str) -> Optional[str]:
    """접미사 기반 매칭. 모든 후보 중 가장 길고 빈도 높은 것을 선택."""
    candidates: dict[str, int] = {}
    for text in texts:
        if not text:
            continue
        for suf in _ORG_SUFFIXES:
            # ○○○ 협회, ○○ 시의회 등 — 한글/영문/숫자/공백 1~30자 + 접미사
            for m in re.finditer(rf"([가-힣A-Za-z0-9·\(\)]{{1,30}}?\s?{re.escape(suf)})", text):
                org = m.group(1).strip()
                # 접미사 단독 매칭은 제외 ('의회' 한 글자만)
                if len(org) <= len(suf):
                    continue
                candidates[org] = candidates.get(org, 0) + 1
    if not candidates:
        return None
    # 빈도 우선, 동률이면 더 긴 것
    return sorted(candidates.items(), key=lambda x: (-x[1], -len(x[0])))[0][0]


_ACTIVITY_KEYWORDS_POOL = [
    "봉사", "지원", "기부", "후원", "헌신", "기여", "참여", "활동",
    "복지", "취약계층", "어려운 이웃", "지역사회", "주민화합", "나눔",
    "청렴", "성실", "정직", "솔선수범",
    "교육", "의료", "환경", "방역", "재난", "구호",
]


def _find_keywords(text: str) -> List[str]:
    return [kw for kw in _ACTIVITY_KEYWORDS_POOL if kw in text][:8]


# 일부 사이트는 기본 User-Agent 로는 차단되므로 브라우저 UA 사용
_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
}


def extract_from_url(url: str) -> URLExtractResponse:
    url = (url or "").strip()
    if not url:
        return URLExtractResponse(
            status="fetch_failed",
            status_message="URL이 비어 있습니다.",
        )
    if not re.match(r"^https?://", url):
        return URLExtractResponse(
            status="fetch_failed",
            status_message="http:// 또는 https:// 로 시작하는 URL을 입력해 주세요.",
        )

    try:
        with httpx.Client(
            timeout=12.0,
            follow_redirects=True,
            headers=_DEFAULT_HEADERS,
        ) as client:
            resp = client.get(url)
        if resp.status_code >= 400:
            return URLExtractResponse(
                status="fetch_failed",
                status_message=f"페이지를 불러오지 못했습니다 (HTTP {resp.status_code}). "
                f"접근 권한이 필요한 페이지이거나 차단되었을 수 있습니다.",
            )
        html = resp.text
    except httpx.TimeoutException:
        return URLExtractResponse(
            status="fetch_failed",
            status_message="요청 시간 초과 (12초). 사이트 응답이 느리거나 차단되었습니다.",
        )
    except httpx.RequestError as e:
        logger.warning("URL fetch failed: %s — %s", url, e)
        return URLExtractResponse(
            status="fetch_failed",
            status_message=f"네트워크 오류: {type(e).__name__}",
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Unexpected URL fetch error")
        return URLExtractResponse(
            status="fetch_failed",
            status_message=f"알 수 없는 오류: {type(e).__name__}: {e}",
        )

    try:
        text, title, og_title = _extract_text_and_title(html)
    except Exception as e:  # noqa: BLE001
        logger.exception("HTML parse failed")
        return URLExtractResponse(
            status="fetch_failed",
            status_message=f"HTML 파싱 실패: {type(e).__name__}",
        )

    if not text or len(text) < 30:
        return URLExtractResponse(
            page_title=title or og_title,
            text_length=len(text),
            status="parse_empty",
            status_message=(
                "본문 텍스트를 찾지 못했습니다. JavaScript로 렌더링되는 페이지일 수 있습니다. "
                "주요 정보를 수동으로 입력해 주세요."
            ),
            raw_text=text[:2000] if text else None,
        )

    name = _find_name(title or "", og_title or "", text)
    position = _find_position(title or "", og_title or "", text)
    organization = _find_organization(title or "", og_title or "", text)
    keywords = _find_keywords(text)

    extracted_any = any([name, position, organization, keywords])
    status = "ok" if extracted_any else "parse_empty"
    status_message = None if extracted_any else (
        "페이지는 정상적으로 가져왔지만 인명·소속·직위 정보를 찾지 못했습니다. "
        "수동으로 입력해 주세요."
    )

    return URLExtractResponse(
        recipient_name=name,
        organization_name=organization,
        position=position,
        merit_keywords=keywords,
        raw_text=text[:4000],
        page_title=title or og_title,
        text_length=len(text),
        status=status,
        status_message=status_message,
    )
