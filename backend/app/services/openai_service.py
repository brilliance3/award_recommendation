"""OpenAI API 통합 서비스

- generate(): 일반 LLM 호출 (공적조서 생성)
- polish(): 입력 문장 다듬기 (어조/문체 교정)
- summarize(): 50자 내외 공적요지 생성
- ping(): API Key 동작 확인
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import httpx

from ..config import OPENAI_API_KEY


OPENAI_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4o-mini"


@dataclass
class LLMResult:
    ok: bool
    text: str = ""
    model: Optional[str] = None
    error: Optional[str] = None


def _call(
    prompt: str,
    *,
    system: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.4,
    max_tokens: int = 1500,
) -> LLMResult:
    if not OPENAI_API_KEY:
        return LLMResult(ok=False, error="OPENAI_API_KEY 가 설정되어 있지 않습니다.")

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
        resp.raise_for_status()
        data = resp.json()
        return LLMResult(
            ok=True,
            text=data["choices"][0]["message"]["content"].strip(),
            model=data.get("model"),
        )
    except httpx.HTTPStatusError as exc:
        return LLMResult(ok=False, error=f"HTTP {exc.response.status_code}: {exc.response.text[:200]}")
    except Exception as exc:  # noqa: BLE001
        return LLMResult(ok=False, error=f"{type(exc).__name__}: {exc}")


SYSTEM_PROMPT_KOREAN_ADMIN = (
    "당신은 한국 공공기관 행정문서 전문가입니다. "
    "공적조서·표창 추천서 작성에 능숙하며, '-함', '-였음', '-임' 등의 행정 문체를 사용합니다. "
    "허위사실 추가 금지. 입력된 사실만 자연스럽게 확장하세요. "
    "과장된 미사여구는 피하고, 구체적·계량적 표현을 우선합니다."
)


def generate_merit(prompt: str) -> LLMResult:
    return _call(prompt, system=SYSTEM_PROMPT_KOREAN_ADMIN, max_tokens=2000)


def polish_text(text: str, target_style: str = "행정문서") -> LLMResult:
    """입력 문장을 행정문서 문체로 다듬기."""
    prompt = (
        f"다음 글을 {target_style} 문체로 다듬어 주세요. "
        f"의미와 사실은 유지하고, 어색한 표현·구어체·중복을 정리하세요. "
        f"분량은 원문과 비슷하게 유지하세요.\n\n---\n{text}\n---\n\n"
        f"다듬은 결과만 출력하세요."
    )
    return _call(prompt, system=SYSTEM_PROMPT_KOREAN_ADMIN, temperature=0.3)


def summarize_merit(text: str, max_chars: int = 50) -> LLMResult:
    """공적요지를 정해진 글자수 내외로 요약."""
    prompt = (
        f"다음 공적 내용을 {max_chars}자 내외 한 문장으로 요약하세요. "
        f"행정문서 문체로 '상기인은 ~ 공로가 큼.' 으로 마무리.\n\n---\n{text}\n---\n\n"
        f"요약 문장만 출력하세요."
    )
    return _call(prompt, system=SYSTEM_PROMPT_KOREAN_ADMIN, temperature=0.3, max_tokens=200)


def ping() -> LLMResult:
    """OPENAI_API_KEY 동작 확인 — 매우 짧은 핑."""
    return _call("Korean test: 답변으로 '연결 정상' 만 출력", max_tokens=20, temperature=0.0)
