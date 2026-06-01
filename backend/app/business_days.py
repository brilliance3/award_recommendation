"""영업일 계산 유틸 (한국 공휴일 + 주말 제외)."""
from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache
from typing import Optional

import holidays


@lru_cache(maxsize=8)
def _kr_holidays(year: int):
    """해당 연도와 인접 연도 1개씩 포함한 한국 공휴일 캐시."""
    return holidays.KR(years=[year - 1, year, year + 1])


def is_business_day(d: date) -> bool:
    """주말(토·일) 아니고 한국 공휴일도 아니면 True."""
    if d.weekday() >= 5:  # 토(5), 일(6)
        return False
    if d in _kr_holidays(d.year):
        return False
    return True


def business_days_before(target: date, days: int) -> date:
    """target 으로부터 영업일 N일 전 날짜.

    예) target=2025-09-13(토), days=3 → 2025-09-10(수)
    target 자체는 카운트 안 함. target 직전 영업일부터 1, 2, 3 ... 으로 셈.
    """
    if days <= 0:
        return target
    cur = target
    counted = 0
    while counted < days:
        cur -= timedelta(days=1)
        if is_business_day(cur):
            counted += 1
    return cur


def compute_target_issue_date(award_date: Optional[date]) -> Optional[date]:
    """표창일자로부터 영업일 D-3일 전(발급목표일)."""
    if not award_date:
        return None
    return business_days_before(award_date, 3)
