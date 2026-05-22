"""공적사항 / 공적요지 / 추천사유 AI 자동작성 서비스

ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 가 있으면 LLM 호출, 없으면 규칙 기반 템플릿 생성.
허위사실 금지, 입력된 사실만 확장하는 보수적 프롬프트를 사용.
"""
from __future__ import annotations

from typing import List, Optional

from ..config import ANTHROPIC_API_KEY, OPENAI_API_KEY
from ..models import Recipient


SECTION_TITLES = [
    "공적 행사 및 봉사활동에 솔선수범",
    "청렴결백하고 겸손한 자세 실천",
    "어려운 이웃을 위한 선행 실천",
    "지역사회 화합과 나눔 문화 확산 기여",
]


def _intro_line(r: Recipient) -> str:
    org = r.organization_name or "지역사회"
    return (
        f"상기인은 {org}에서 활동하며 지역사회 발전과 따뜻한 공동체 형성을 위해 "
        f"헌신적으로 봉사해 왔으며, 그 주요 공적은 다음과 같음."
    )


def _build_prompt(r: Recipient, keywords: List[str], activity_summary: Optional[str]) -> str:
    return f"""
다음 표창 대상자 정보를 바탕으로 경기도의회 의장 표창 공적조서에 들어갈 공적사항을 작성해 주세요.

조건:
1. 행정문서 문체(존칭/평서/'-함', '-였음' 등)로 작성
2. 허위사실을 만들지 말 것 (입력된 사실만 자연스럽게 확장)
3. 4개 항목으로 구분하고 각 항목은 "번호. 소제목" + 본문 형식
4. 마지막 문단은 표창 추천 사유로 마무리
5. 과장된 수사·미사여구는 자제

대상자:
- 성명: {r.recipient_name or ''}
- 소속: {r.organization_name or ''}
- 직위: {r.recipient_position_title or ''}
- 공적분야: {r.merit_category or ''}
- 공적기간: {r.merit_period or ''}
- 주요 활동: {activity_summary or ''}
- 키워드: {', '.join(keywords)}
""".strip()


def _rule_based_full_text(r: Recipient, keywords: List[str], activity_summary: Optional[str]) -> str:
    org = r.organization_name or "지역사회"
    title = r.recipient_position_title or ""
    field = r.merit_category or "지역사회발전"

    bodies = [
        f"{org}에서 {title}로 활동하며 각종 공적 행사와 봉사활동에 빠짐없이 참여하고, "
        f"매사 적극적이고 책임감 있는 자세로 주민들과 함께하며 신뢰받는 지역 인물로 자리매김하였음.",

        "청렴결백한 품성과 예의 바른 언행으로 지역사회에 귀감이 되고 있으며, "
        "자신을 드러내기보다 묵묵히 맡은 바 소임을 다하는 자세로 주변의 존경을 받아왔음.",

        "본인 또한 어려운 환경에 처해 있음에도 더 어려운 이웃을 돌아보고 물심양면으로 지원하며, "
        "꾸준한 나눔으로 지역 주민들에게 큰 울림을 주고 있음.",

        f"크고 작은 봉사와 선행을 통해 지역 주민들에게 나눔과 배려의 문화를 확산시켰으며, "
        f"{field} 분야에서 따뜻한 사회를 만드는 모범적인 사례가 되고 있음.",
    ]

    sections = [f"{i+1}. {SECTION_TITLES[i]}\n  {bodies[i]}" for i in range(4)]
    closing = (
        f"\n위와 같이 상기인은 성실과 봉사, 청렴과 책임감을 바탕으로 "
        f"{field}과 이웃 사랑을 실천해 온 공로가 지대하므로, 표창 대상자로 추천함."
    )
    extra = ""
    if activity_summary:
        extra = f"\n\n[참고 활동내역]\n{activity_summary.strip()}"
    return _intro_line(r) + "\n\n" + "\n\n".join(sections) + closing + extra


def _rule_based_summary(r: Recipient) -> str:
    org = r.organization_name or "지역사회"
    field = r.merit_category or "지역사회발전"
    return (
        f"상기인은 {org}에서 봉사와 헌신을 실천하여 {field}에 기여한 공로가 큼."
    )


def _rule_based_reason(r: Recipient) -> str:
    return (
        "상기인은 매사 정직, 성실, 헌신하는 자로 어렵고 바쁜 중에도 마을의 어려운 이웃을 "
        "위해 봉사를 몸소 실천하며 봉사정신과 국가관이 강한 자로, 그간의 맡은 바 소임을 "
        "착실히 수행하여 지역주민 화합에 기여한 공로를 인정하여 수상 후보자로 추천함."
    )


def _try_anthropic(prompt: str) -> Optional[str]:
    if not ANTHROPIC_API_KEY:
        return None
    try:
        import httpx
        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-5",
                "max_tokens": 1500,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"]
    except Exception:
        return None


def _try_openai(prompt: str) -> Optional[str]:
    if not OPENAI_API_KEY:
        return None
    try:
        import httpx
        resp = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.4,
            },
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except Exception:
        return None


def generate_merit_full_text(
    recipient: Recipient,
    keywords: List[str],
    activity_summary: Optional[str] = None,
) -> str:
    prompt = _build_prompt(recipient, keywords, activity_summary)
    return _try_anthropic(prompt) or _try_openai(prompt) or _rule_based_full_text(
        recipient, keywords, activity_summary
    )


def generate_merit_short_summary(recipient: Recipient) -> str:
    """공적요지 50자 내외"""
    prompt = (
        f"다음 정보를 바탕으로 공적요지를 50자 내외 한 문장으로 작성하세요. "
        f"행정문서 문체 '상기인은 ~ 공로가 큼.' 으로 마무리.\n"
        f"이름: {recipient.recipient_name}\n"
        f"소속: {recipient.organization_name or ''}\n"
        f"공적분야: {recipient.merit_category or ''}\n"
        f"공적기간: {recipient.merit_period or ''}"
    )
    text = _try_anthropic(prompt) or _try_openai(prompt)
    return text.strip() if text else _rule_based_summary(recipient)


def generate_recommendation_reason(recipient: Recipient) -> str:
    prompt = (
        f"다음 정보로 표창 추천사유를 3~5문장 작성. 행정문서 문체. 과장 금지.\n"
        f"이름: {recipient.recipient_name}\n"
        f"소속: {recipient.organization_name or ''}\n"
        f"공적분야: {recipient.merit_category or ''}"
    )
    text = _try_anthropic(prompt) or _try_openai(prompt)
    return text.strip() if text else _rule_based_reason(recipient)
