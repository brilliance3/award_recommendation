"""로그인 세션 API — 자체 로그인 화면용.

POST /api/auth/login  : 아이디/비밀번호 검증 후 세션 쿠키 발급
POST /api/auth/logout : 세션 쿠키 삭제
GET  /api/auth/me     : 현재 인증 상태 (SPA 가 로그인 화면 표시 여부 판단)
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from .. import auth

router = APIRouter(tags=["auth"])

COOKIE_NAME = "award_session"


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/api/auth/login")
def login(payload: LoginIn, response: Response):
    if not auth.verify(payload.username, payload.password):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")
    token = auth.make_session_token(payload.username)
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=auth.SESSION_TTL,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return {"username": payload.username}


@router.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/api/auth/me")
def me(request: Request):
    """인증 상태. auth_required=False 면 게이트 자체가 꺼진 상태."""
    if not auth.is_enabled():
        return {
            "authenticated": True,
            "auth_required": False,
            "username": auth.current_username(),
        }
    token = request.cookies.get(COOKIE_NAME, "")
    authed = bool(token) and auth.verify_session(token)
    return {
        "authenticated": authed,
        "auth_required": True,
        "username": auth.current_username() if authed else None,
    }
