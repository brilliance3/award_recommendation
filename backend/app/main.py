"""FastAPI 앱 엔트리포인트"""
import logging
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
    """ALLOWED_ORIGINS 와 일치하는지 — 와일드카드와 정확 매칭 모두 지원."""
    if not origin:
        return False
    for allowed in ALLOWED_ORIGINS:
        if allowed == "*":
            return True
        if allowed == origin:
            return True
    return False


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
    app = FastAPI(
        title="공적조서 자동 생성 시스템",
        description="표창 추천 업무를 위한 공적 데이터 관리 + 행정문서 자동 생성 시스템",
        version="0.1.0",
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
        "/api/health/pdf-bench",
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

    @app.on_event("startup")
    def _startup() -> None:
        init_db()
        auth.load_from_db()
        # PDF 브라우저 풀을 백그라운드로 미리 워밍(첫 동의서 생성이 콜드가 되지 않게).
        # 시작을 막지 않도록 별도 스레드에서.
        import threading

        from .services import browser_pool

        threading.Thread(target=browser_pool.prewarm, daemon=True, name="pdf-prewarm").start()

    @app.exception_handler(Exception)
    async def _all_exception_handler(request: Request, exc: Exception):
        """예외 traceback을 콘솔에 출력하고, 응답에도 일부 포함. CORS 헤더 수동 부착."""
        tb = traceback.format_exc()
        logger.error("Unhandled error on %s %s\n%s", request.method, request.url.path, tb)
        return JSONResponse(
            status_code=500,
            headers=_cors_headers_for(request),
            content={
                "detail": f"{type(exc).__name__}: {exc}",
                "path": request.url.path,
                "trace_tail": tb.splitlines()[-6:],
            },
        )

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    @app.get("/api/health/pdf-bench")
    def pdf_bench() -> dict:
        """동의서 렌더 시간 실측(PII 없는 더미). 콜드/웜 진단용. 공개."""
        import time
        from types import SimpleNamespace

        from .services import consent_generator

        rec = SimpleNamespace(
            id="_bench", recipient_name="홍길동", signed_at=None, signature_path=None,
            award_case=None,
        )
        times = []
        for _ in range(2):
            t = time.time()
            try:
                consent_generator.generate_consent_pdf(rec)
            except Exception as e:
                return {"error": f"{type(e).__name__}: {e}"}
            times.append(round((time.time() - t) * 1000))
        return {"first_ms": times[0], "second_ms": times[1]}

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

        @app.get("/{full_path:path}")
        def _spa(full_path: str):
            # /api/* 는 위 라우터가 이미 처리. 여기 오는 건 프론트 경로.
            candidate = frontend_dir / full_path
            if full_path and candidate.is_file():
                return FileResponse(str(candidate))  # favicon, ci 이미지 등 실제 파일
            return FileResponse(str(frontend_dir / "index.html"))  # SPA 라우팅

    return app


app = create_app()
