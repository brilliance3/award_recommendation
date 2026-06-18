"""사이트 접근 자격 + 세션 토큰 — 인메모리 캐시.

우선순위: DB(AppSetting.site_*) 가 설정돼 있으면 그것을, 없으면 환경변수(SITE_*) 폴백.
미들웨어가 매 요청마다 DB를 읽지 않도록 단일 프로세스 인메모리 캐시를 둔다.
- 앱 시작 시 load_from_db() 로 DB 값을 캐시에 반영
- 설정 화면에서 변경하면 set_cache() 로 즉시 갱신

세션: 로그인 성공 시 HMAC 서명 토큰을 쿠키로 발급. 서명 키는 현재 비밀번호에서
파생하므로 비밀번호/아이디가 바뀌면 기존 세션이 자동 무효화된다(재로그인 강제).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time

from .config import SITE_PASSWORD as ENV_PASSWORD
from .config import SITE_USERNAME as ENV_USERNAME

# 세션 유효시간 (초). 12시간.
SESSION_TTL = 60 * 60 * 12

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


# ---------- 비밀번호 해시 (PBKDF2-HMAC-SHA256, stdlib) ----------
# 저장 형식: "pbkdf2$<반복수>$<salt_hex>$<hash_hex>". 이 접두어가 없으면 레거시 평문으로 간주.
# 외부 의존성 없이 표준 라이브러리만 사용.
_PBKDF2_ITER = 200_000


def hash_password(password: str) -> str:
    """평문 비밀번호 → 솔트 적용 PBKDF2 해시 문자열."""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITER)
    return f"pbkdf2${_PBKDF2_ITER}${salt.hex()}${dk.hex()}"


def is_hashed(stored: str) -> bool:
    return bool(stored) and stored.startswith("pbkdf2$")


def _verify_against(stored: str, password: str) -> bool:
    """저장값(해시 또는 레거시 평문) 대비 비밀번호 검증 — 상수시간 비교."""
    if not stored:
        return False
    if is_hashed(stored):
        try:
            _, iter_s, salt_hex, hash_hex = stored.split("$", 3)
            dk = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iter_s)
            )
            return hmac.compare_digest(dk, bytes.fromhex(hash_hex))
        except Exception:
            return False
    # 레거시 평문(환경변수 SITE_PASSWORD 또는 해시화 이전 DB 값) — 하위호환.
    return secrets.compare_digest(password.encode("utf-8"), stored.encode("utf-8"))


def verify(username: str, password: str) -> bool:
    """타이밍 공격 방지 상수시간 비교. 비밀번호 미설정 시 항상 통과."""
    if not _password:
        return True
    ok_user = secrets.compare_digest(username.encode("utf-8"), _username.encode("utf-8"))
    ok_pw = _verify_against(_password, password)
    return ok_user and ok_pw


def current_username() -> str:
    return _username


def verify_password(password: str) -> bool:
    """현재 비밀번호 일치 여부(아이디 무관). 게이트 비활성 시 항상 통과."""
    if not _password:
        return True
    return _verify_against(_password, password)


# ---------- 세션 토큰 (HMAC 서명) ----------
def _secret() -> bytes:
    """서명 키 — 현재 비밀번호에서 파생. 비밀번호 변경 시 기존 세션 무효화."""
    return hashlib.sha256(("award-session-v1::" + _password).encode("utf-8")).digest()


def make_session_token(username: str) -> str:
    """로그인 성공 후 발급할 세션 토큰."""
    payload = f"{username}:{int(time.time()) + SESSION_TTL}"
    sig = hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}:{sig}".encode("utf-8")).decode("ascii")


def verify_session(token: str) -> bool:
    """세션 토큰 검증 — 서명·만료·현재 아이디 일치."""
    try:
        raw = base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8")
        username, exp_s, sig = raw.rsplit(":", 2)
        exp = int(exp_s)
    except Exception:
        return False
    if exp < int(time.time()):
        return False
    payload = f"{username}:{exp}"
    expected = hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return False
    return hmac.compare_digest(username.encode("utf-8"), _username.encode("utf-8"))
