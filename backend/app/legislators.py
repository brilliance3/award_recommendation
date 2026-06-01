"""경기도의회 보건복지위원회 의원 명단 (정적).

회기년도(7.1 ~ 익년 6.30) 단위로 의원당 100명까지 추천 가능.
위원장은 무제한 (max_quota=None).

명단이 바뀌면 이 파일만 수정.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import List, Optional, Tuple


@dataclass(frozen=True)
class Legislator:
    name: str
    party: str  # '민주' | '국힘'
    is_chair: bool = False  # 위원장 여부 — 무제한
    staff: Optional[str] = None  # 담당자 (참고용)
    seal_filename: Optional[str] = None  # frontend/public/seals/ 와 backend/app/assets/seals/ 공통 파일명

    @property
    def max_quota(self) -> Optional[int]:
        return None if self.is_chair else 100


LEGISLATORS: List[Legislator] = [
    # 위원장
    Legislator(name="이선구", party="민주", is_chair=True, staff="박중보", seal_filename="도장(이선구 위원장).jpg"),
    # 민주
    Legislator(name="김용성", party="민주", staff="박중보", seal_filename="도장(김용성 의원).jpg"),
    Legislator(name="최만식", party="민주", staff="박중보", seal_filename="도장(최만식 의원).jpg"),
    Legislator(name="박재용", party="민주", staff="박중보", seal_filename="도장(박재용 의원).jpg"),
    Legislator(name="황세주", party="민주", staff="박중보", seal_filename="도장(황세주 의원).jpg"),
    Legislator(name="김동규", party="민주", staff="박중보", seal_filename="도장(김동규 의원).jpg"),
    # 국힘
    Legislator(name="고준호", party="국힘", staff="홍서희", seal_filename="도장(고준호 의원).jpg"),
    Legislator(name="정경자", party="국힘", staff="홍서희", seal_filename="도장(정경자 의원).jpg"),
    Legislator(name="윤태길", party="국힘", staff="홍서희", seal_filename="도장(윤태길 의원).jpg"),
    Legislator(name="지미연", party="국힘", staff="홍서희", seal_filename="도장(지미연 의원).jpg"),
    Legislator(name="김완규", party="국힘", staff="홍서희", seal_filename="도장(김완규 의원).png"),
    Legislator(name="이병길", party="국힘", staff="홍서희", seal_filename="도장(이병길 의원).png"),
]


def find_legislator(name: str) -> Optional[Legislator]:
    """이름으로 의원 찾기 — 정확히 일치."""
    if not name:
        return None
    n = name.strip()
    for L in LEGISLATORS:
        if L.name == n:
            return L
    return None


def current_term_range(today: Optional[date] = None) -> Tuple[date, date]:
    """현재 회기년도 범위 반환 (7.1 ~ 익년 6.30).

    예) 2026-09-10 -> (2026-07-01, 2027-06-30)
        2026-04-15 -> (2025-07-01, 2026-06-30)
    """
    today = today or date.today()
    if today.month >= 7:
        start_year = today.year
    else:
        start_year = today.year - 1
    return (date(start_year, 7, 1), date(start_year + 1, 6, 30))


# 지방의원 임기 교체(지방선거) 기준 연도 — 2026년 7.1 12대 임기 시작, 4년 주기
TERM_CHANGE_BASE_YEAR = 2026


def current_calendar_range(today: Optional[date] = None) -> Tuple[date, date]:
    """경기도지사 표창 쿼터의 카운트 기간.

    원칙은 역년(1.1~12.31)이나, 의원 임기가 바뀌는 해(지방선거해, 2026 기준 4년 주기)에는
    6.30 임기 만료를 경계로 분할한다:
      - 상반기(1~6월): 1.1 ~ 6.30  (직전 대수 임기 말, 예: 11대)
      - 하반기(7~12월): 7.1 ~ 12.31 (새 대수 임기 초, 예: 12대)
    그 외 해는 1.1 ~ 12.31.
    """
    today = today or date.today()
    y = today.year
    is_term_change_year = (y - TERM_CHANGE_BASE_YEAR) % 4 == 0
    if is_term_change_year:
        if today.month <= 6:
            return (date(y, 1, 1), date(y, 6, 30))
        return (date(y, 7, 1), date(y, 12, 31))
    return (date(y, 1, 1), date(y, 12, 31))
