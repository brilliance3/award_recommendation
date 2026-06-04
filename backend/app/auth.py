"""사이트 접근 자격(HTTP Basic) — 인메모리 캐시.

우선순위: DB(AppSetting.site_*) 가 설정돼 있으면 그것을, 없으면 환경변수(SITE_*) 폴백.
미들웨어가 매 요청마다 DB를 읽지 않도록 단일 프로세스 인메모리 캐시를 둔다.
- 앱 시작 시 load_from_db() 로 DB 값을 캐시에 반영
- 설정 화면에서 변경하면 set_cache() 로 즉시 갱신
"""
from __future__ import annotations

import secrets

from .config import SITE_PASSWORD as ENV_PASSWORD
from .config import SITE_USERNAME as ENV_USERNAME

# 현재 유효 자격 (캐시). 기본값은 환경변수.
_username: str = ENV_USERNAME
_password: str = ENV_PASSWORD


def set_cache(username: str | None, password: str | None) -> None:
    """캐시 갱신. 값이 비면 환경변수 폴백."""
    global _username, _password
    _username = username or ENV_USERNAME
    _password = password or ENV_PASSWORD


def load_from_db() -> None:
    """앱 시작 시 DB의 저장된 자격을 캐시에 로드. 저장값 없으면 환경변수 유지."""
    from . import models
    from .database import SessionLocal

    db = SessionLocal()
    try:
        s = db.query(models.AppSetting).first()
        if s and s.site_password:
            set_cache(s.site_username, s.site_password)
    except Exception:
        # 마이그레이션 전 등 예외 시 환경변수 폴백 유지 (게이트는 계속 동작)
        pass
    finally:
        db.close()


def is_enabled() -> bool:
    """비밀번호가 설정돼 있으면 게이트 활성."""
    return bool(_password)


def verify(username: str, password: str) -> bool:
    """타이밍 공격 방지 상수시간 비교. 비밀번호 미설정 시 항상 통과."""
    if not _password:
        return True
    ok_user = secrets.compare_digest(username.encode("utf-8"), _username.encode("utf-8"))
    ok_pw = secrets.compare_digest(password.encode("utf-8"), _password.encode("utf-8"))
    return ok_user and ok_pw


def current_username() -> str:
    return _username
