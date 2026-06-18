"""아주 가벼운 인메모리 레이트리밋(브루트포스·공개 엔드포인트 오남용 완화).

외부 의존성 없이 단일 프로세스 메모리에 IP별 호출 시각을 슬라이딩 윈도로 보관한다.
Fly.io에서 머신 1대 상시 가동(min_machines_running=1) 전제라 프로세스 메모리로 충분하다.
머신이 여러 대로 늘면 머신별로 카운트되므로(느슨해짐) 그때는 Redis 등 공유 저장소가 필요하다.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_lock = threading.Lock()
_hits: "defaultdict[str, deque]" = defaultdict(deque)

# 키 누적 방지 — _hits 키 수가 이 임계를 초과하면 만료 키를 정리한다.
_SWEEP_THRESHOLD = 10_000


def client_ip(request: Request) -> str:
    """Fly 신뢰 헤더(fly-client-ip)를 우선 사용해 X-Forwarded-For 위조로부터 보호.

    fly-client-ip: Fly.io가 직접 설정하는 헤더로 클라이언트가 위조 불가.
    없으면 WSGI transport 단의 request.client.host(Fly 내부 프록시) 사용.
    """
    fly_ip = (request.headers.get("fly-client-ip") or "").strip()
    if fly_ip:
        return fly_ip[:64]
    return (request.client.host if request.client else "unknown")[:64]


def check(key: str, limit: int, window_sec: int) -> bool:
    """key에 대해 window_sec 동안 limit회 이내면 True(허용)·기록, 초과면 False."""
    now = time.time()
    with _lock:
        # 키 누적 방지 — 임계 초과 시 만료 키 sweep
        if len(_hits) > _SWEEP_THRESHOLD:
            cutoff_sweep = now - window_sec
            dead = [k for k, dq in _hits.items() if not dq or dq[-1] <= cutoff_sweep]
            for k in dead:
                del _hits[k]

        dq = _hits[key]
        cutoff = now - window_sec
        while dq and dq[0] <= cutoff:
            dq.popleft()
        if len(dq) >= limit:
            return False
        dq.append(now)
        return True


def clear(name: str, request: Request) -> None:
    """로그인 성공 등 정상 인증 후 해당 키 버킷을 초기화.

    공용 NAT 환경에서 한 명이 실패를 많이 내도 성공 시 잠금이 풀리게 한다.
    키가 없으면 조용히 무시한다.
    """
    ip = client_ip(request)
    key = f"{name}:{ip}"
    with _lock:
        if key in _hits:
            del _hits[key]


def enforce(request: Request, name: str, limit: int, window_sec: int) -> None:
    """초과 시 429 발생. name은 엔드포인트 구분용 prefix."""
    ip = client_ip(request)
    if not check(f"{name}:{ip}", limit, window_sec):
        raise HTTPException(
            status_code=429,
            detail="요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        )
