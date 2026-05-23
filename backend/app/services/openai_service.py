"""OpenAI API 통합 서비스 (gpt-5.5-mini 기본)

- generate(): 일반 LLM 호출
- polish(): 입력 문장 다듬기 (행정문서 문체)
- summarize(): N자 내외 공적요지 생성
- ab_variants(): 같은 입력으로 2가지 안 생성 (A/B 비교)
- ping(): API Key 동작 확인

마크다운 금지 — 시스템 프롬프트 + 응답 후처리(_strip_markdown)로 ##, **, *, ``` 제거.
모델 폴백 — 첫 모델이 404/4xx면 다음 모델로 자동 재시도.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

import httpx

from ..config import OPENAI_API_KEY, OPENAI_FALLBACK_MODELS, OPENAI_MODEL


OPENAI_URL = "https://api.openai.com/v1/chat/completions"


@dataclass
class LLMResult:
    ok: bool
    text: str = ""
    model: Optional[str] = None
    error: Optional[str] = None


# 마크다운 제거 (헤더/볼드/이탤릭/리스트 마커/코드블록/링크)
_MD_BOLD = re.compile(r"\*\*([^*]+)\*\*")
_MD_ITALIC = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)")
_MD_HEADER = re.compile(r"^#{1,6}\s+", re.MULTILINE)
_MD_LIST = re.compile(r"^[\-\*\+]\s+", re.MULTILINE)
_MD_CODE_BLOCK = re.compile(r"```[a-zA-Z]*\n?(.*?)\n?```", re.DOTALL)
_MD_INLINE_CODE = re.compile(r"`([^`]+)`")
_MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_MD_HR = re.compile(r"^---+$", re.MULTILINE)
_MD_BLOCKQUOTE = re.compile(r"^>\s?", re.MULTILINE)


def _strip_markdown(text: str) -> str:
    if not text:
        return text
    s = text
    s = _MD_CODE_BLOCK.sub(r"\1", s)
    s = _MD_BOLD.sub(r"\1", s)
    s = _MD_ITALIC.sub(r"\1", s)
    s = _MD_HEADER.sub("", s)
    s = _MD_LIST.sub("", s)
    s = _MD_INLINE_CODE.sub(r"\1", s)
    s = _MD_LINK.sub(r"\1", s)
    s = _MD_HR.sub("", s)
    s = _MD_BLOCKQUOTE.sub("", s)
    # 잔여 #/* 제거
    s = re.sub(r"^\s*#+\s*", "", s, flags=re.MULTILINE)
    return s.strip()


SYSTEM_PROMPT_KOREAN_ADMIN = (
    "당신은 한국 공공기관 행정문서 전문가입니다. "
    "공적조서·표창 추천서 작성에 능숙하며, '-함', '-였음', '-임' 등의 행정 문체를 사용합니다. "
    "허위사실 추가 금지. 입력된 사실만 자연스럽게 확장하세요. "
    "과장된 미사여구는 피하고, 구체적·계량적 표현을 우선합니다.\n\n"
    "출력 규칙(매우 중요):\n"
    "- 마크다운 사용 절대 금지: #, ##, **, *, ` (백틱), 리스트 - 등을 쓰지 말 것.\n"
    "- 결과는 평문(plain text)만 출력. 한글 문장 부호와 줄바꿈만 사용.\n"
    "- 별도 설명·머리말·꼬리말 없이 본문만 출력."
)


def _call_once(
    prompt: str,
    *,
    model: str,
    system: Optional[str] = None,
    temperature: float = 0.4,
    max_tokens: int = 1500,
) -> tuple[Optional[dict], Optional[str]]:
    """단일 모델로 호출. 성공시 (response_json, None), 실패시 (None, error_str)."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    try:
        resp = httpx.post(
            OPENAI_URL,
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
            timeout=60.0,
        )
        if resp.status_code in (400, 404):
            # 모델이 없거나 잘못된 경우 — 폴백 가능
            return None, f"model_unavailable: HTTP {resp.status_code} {resp.text[:200]}"
        resp.raise_for_status()
        return resp.json(), None
    except httpx.HTTPStatusError as exc:
        return None, f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
    except Exception as exc:  # noqa: BLE001
        return None, f"{type(exc).__name__}: {exc}"


def _call(
    prompt: str,
    *,
    system: Optional[str] = None,
    temperature: float = 0.4,
    max_tokens: int = 1500,
    model_override: Optional[str] = None,
) -> LLMResult:
    if not OPENAI_API_KEY:
        return LLMResult(ok=False, error="OPENAI_API_KEY 가 설정되어 있지 않습니다.")

    models_to_try = [model_override or OPENAI_MODEL, *OPENAI_FALLBACK_MODELS]
    seen = set()
    errors = []
    for m in models_to_try:
        if m in seen:
            continue
        seen.add(m)
        data, err = _call_once(prompt, model=m, system=system,
                              temperature=temperature, max_tokens=max_tokens)
        if data:
            raw = data["choices"][0]["message"]["content"].strip()
            return LLMResult(ok=True, text=_strip_markdown(raw), model=data.get("model"))
        # model_unavailable 만 폴백
        errors.append(f"{m}: {err}")
        if err and not err.startswith("model_unavailable"):
            break
    return LLMResult(ok=False, error="; ".join(errors))


def generate_merit(prompt: str) -> LLMResult:
    return _call(prompt, system=SYSTEM_PROMPT_KOREAN_ADMIN, max_tokens=2000)


def polish_text(text: str, target_style: str = "행정문서") -> LLMResult:
    prompt = (
        f"다음 글을 {target_style} 문체로 다듬어 주세요. "
        f"의미와 사실은 유지하고, 어색한 표현·구어체·중복을 정리하세요. "
        f"분량은 원문과 비슷하게 유지하세요.\n\n---\n{text}\n---\n\n"
        f"다듬은 결과만 출력하세요. 마크다운 금지."
    )
    return _call(prompt, system=SYSTEM_PROMPT_KOREAN_ADMIN, temperature=0.3)


def summarize_merit(text: str, max_chars: int = 50) -> LLMResult:
    prompt = (
        f"다음 공적 내용을 {max_chars}자 내외 한 문장으로 요약하세요. "
        f"행정문서 문체로 '상기인은 ~ 공로가 큼.' 으로 마무리.\n\n---\n{text}\n---\n\n"
        f"요약 문장만 출력하세요. 마크다운 금지."
    )
    return _call(prompt, system=SYSTEM_PROMPT_KOREAN_ADMIN, temperature=0.3, max_tokens=200)


def ab_variants(prompt: str, *, system: Optional[str] = None) -> list[LLMResult]:
    """같은 프롬프트로 서로 다른 2가지 안을 생성 (다른 temperature)."""
    sys_p = system or SYSTEM_PROMPT_KOREAN_ADMIN
    a = _call(prompt, system=sys_p, temperature=0.2, max_tokens=1500)
    b = _call(prompt, system=sys_p, temperature=0.7, max_tokens=1500)
    return [a, b]


def ping() -> LLMResult:
    return _call("Korean test: 답변으로 '연결 정상' 만 출력 (마크다운 금지)",
                 max_tokens=20, temperature=0.0)
