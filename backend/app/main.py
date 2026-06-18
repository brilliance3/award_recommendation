"""FastAPI 앱 엔트리포인트"""
import logging
import os
import re
import traceback
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .api import (
    applications,
    award_cases,
    checklist,
    dashboards,
    documents,
    merit_contents,
    recipients,
    session,
    settings,
)
from . import auth
from .api.session import COOKIE_NAME
from .config import ALLOWED_ORIGINS
from .database import init_db

logger = logging.getLogger("award")
logging.basicConfig(level=logging.INFO)


def _origin_allowed(origin: str) -> bool:
    """예외응답에 자격증명(credentials) CORS 헤더를 붙여도 되는 출처인지 — 정확 매칭만 허용.

    bare '*'(모든 출처)는 자격증명과 함께 반영하면 임의 사이트가 쿠키 포함 응답을 읽을 수 있어
    위험하므로, 여기서는 정확히 일치하는 출처에만 반영한다(와일드카드는 의도적으로 제외).
    """
    if not origin:
        return False
    return origin in ALLOWED_ORIGINS


def _cors_headers_for(request: Request) -> dict:
    """예외 응답에 수동으로 붙일 CORS 헤더 계산."""
    origin = request.headers.get("origin", "")
    if not _origin_allowed(origin):
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }


def create_app() -> FastAPI:
    # API 자동 문서(/docs·/redoc·/openapi.json)는 기본 비공개.
    # 개인정보 취급 시스템이라 API 구조 외부 노출을 막는다. 로컬 개발 등에서 필요하면
    # 환경변수 ENABLE_DOCS=1 로 명시적으로 켠다.
    expose_docs = os.getenv("ENABLE_DOCS", "").lower() in ("1", "true", "yes")
    app = FastAPI(
        title="공적조서 자동 생성 시스템",
        description="표창 추천 업무를 위한 공적 데이터 관리 + 행정문서 자동 생성 시스템",
        version="0.1.0",
        docs_url="/docs" if expose_docs else None,
        redoc_url="/redoc" if expose_docs else None,
        openapi_url="/openapi.json" if expose_docs else None,
    )

    # 와일드카드 패턴(예: https://award-recommendation-*.vercel.app) 지원 위해 정규식 사용 가능
    allow_origin_regex = None
    if any("*" in o and o != "*" for o in ALLOWED_ORIGINS):
        # ALLOWED_ORIGINS 에 '*' 가 포함된 패턴이 있으면 regex 로 변환
        patterns = []
        for o in ALLOWED_ORIGINS:
            if "*" in o:
                patterns.append(re.escape(o).replace(r"\*", ".*"))
        allow_origin_regex = "|".join(patterns) if patterns else None

    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_origin_regex=allow_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 로그인 없이 접근 가능한 경로 (로그인 화면 렌더·인증 처리에 필요)
    _PUBLIC_PATHS = {
        "/api/health",
        "/api/auth/login",
        "/api/auth/logout",
        "/api/auth/me",
    }

    def _is_public_api(path: str, method: str) -> bool:
        """로그인 없이 허용하는 /api 경로.
        - 인증/헬스 API
        - 민간인 공개 신청 흐름(/api/applications/*): 신청·공유토큰·관리토큰 접근
        - 추천의원 드롭다운용 의원 목록 조회(GET만; 편집은 보호)
        """
        if path in _PUBLIC_PATHS:
            return True
        if path.startswith("/api/applications/"):
            return True
        if path == "/api/legislators" and method == "GET":
            return True
        return False

    @app.middleware("http")
    async def _session_gate(request: Request, call_next):
        """외부 노출 차단 — 세션 쿠키 인증. 자격은 auth 모듈(DB 우선·env 폴백).
        - 게이트 비활성(비밀번호 미설정) 시 통과
        - 공개 API(_is_public_api)·CORS 프리플라이트(OPTIONS) 통과
        - 프론트 정적 셸(비-/api 경로)은 공개 → SPA 가 로그인/공개 페이지를 렌더
        - 그 외 모든 /api/* 데이터 요청은 유효한 세션 쿠키 필요
        """
        if not auth.is_enabled():
            return await call_next(request)
        path = request.url.path
        if request.method == "OPTIONS" or _is_public_api(path, request.method):
            return await call_next(request)
        if not path.startswith("/api/"):
            return await call_next(request)  # 정적 셸/SPA 라우팅
        token = request.cookies.get(COOKIE_NAME, "")
        if token and auth.verify_session(token):
            return await call_next(request)
        return JSONResponse(status_code=401, content={"detail": "로그인이 필요합니다"})

    @app.middleware("http")
    async def _security_headers(request: Request, call_next):
        """기본 보안 응답 헤더 부착(클릭재킹·MIME 스니핑·레퍼러 유출·평문 HTTP 방지).
        CSP는 SPA 인라인 스타일/스크립트와 충돌 위험이 있어 의도적으로 넣지 않는다."""
        resp = await call_next(request)
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "no-referrer")
        resp.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
        return resp

    @app.on_event("startup")
    def _startup() -> None:
        init_db()
        auth.load_from_db()
        # 최초 설치 fail-open 가드 — 운영 환경에서 비밀번호 없이 기동하면 즉시 실패.
        # 로컬 개발은 FLY_APP_NAME 없고 REQUIRE_SITE_PASSWORD 미설정이라 통과(DX 보존).
        if not auth.is_enabled() and (
            os.getenv("FLY_APP_NAME")
            or os.getenv("REQUIRE_SITE_PASSWORD", "").lower() in ("1", "true", "yes")
        ):
            raise RuntimeError(
                "운영 환경에 SITE_PASSWORD(로그인 비밀번호)가 설정되지 않았습니다. "
                "fly secrets set SITE_PASSWORD=... 후 재배포하세요."
            )
        # PDF 브라우저 풀을 백그라운드로 미리 워밍(첫 동의서 생성이 콜드가 되지 않게).
        # 시작을 막지 않도록 별도 스레드에서.
        import threading

        from .services import browser_pool

        threading.Thread(target=browser_pool.prewarm, daemon=True, name="pdf-prewarm").start()

    @app.exception_handler(Exception)
    async def _all_exception_handler(request: Request, exc: Exception):
        """예외 traceback은 서버 로그에만 남기고, 응답에는 일반 메시지만 반환.
        (예외 타입·메시지·스택·내부 경로 등 내부정보를 클라이언트에 노출하지 않는다.)"""
        logger.error(
            "Unhandled error on %s %s\n%s",
            request.method,
            request.url.path,
            traceback.format_exc(),
        )
        return JSONResponse(
            status_code=500,
            headers=_cors_headers_for(request),
            content={"detail": "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."},
        )

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}


    app.include_router(award_cases.router)
    app.include_router(recipients.router)
    app.include_router(merit_contents.router)
    app.include_router(documents.router)
    app.include_router(checklist.router)
    app.include_router(applications.router)
    app.include_router(dashboards.router)
    app.include_router(settings.router)
    app.include_router(session.router)

    # --- 프론트엔드(SPA) 정적 서빙 ---
    # 회사 인트라넷이 vercel.app은 막고 fly.dev는 통과시키므로, 백엔드(fly.dev)가
    # 빌드된 프론트(frontend/dist → /app/frontend_dist)까지 서빙해 단일 도메인으로 제공한다.
    # 모든 API는 /api/ 로 시작하므로 그 외 경로만 프론트로 보낸다(SPA 라우팅 fallback).
    frontend_dir = Path(__file__).resolve().parent.parent / "frontend_dist"
    if frontend_dir.is_dir():
        assets_dir = frontend_dir / "assets"
        if assets_dir.is_dir():
            app.mount(
                "/assets", StaticFiles(directory=str(assets_dir)), name="assets"
            )

        _frontend_base = frontend_dir.resolve()

        @app.get("/{full_path:path}")
        def _spa(full_path: str):
            # /api/* 는 위 라우터가 이미 처리. 여기 오는 건 프론트 경로.
            index = _frontend_base / "index.html"
            if full_path:
                # 경로 탈출 차단(중요): URL 인코딩된 ../(%2e%2e%2f) 등으로 frontend_dist
                # 바깥의 소스코드·DB(app.db) 등을 미인증 다운로드하는 것을 막는다.
                # resolve() 후 반드시 frontend_dist 내부의 실제 파일이어야만 직접 서빙한다.
                candidate = (_frontend_base / full_path).resolve()
                if candidate.is_file() and _frontend_base in candidate.parents:
                    return FileResponse(str(candidate))  # favicon, ci 이미지 등 실제 파일
            return FileResponse(str(index))  # SPA 라우팅

    return app


app = create_app()
