"""FastAPI 앱 엔트리포인트"""
import logging
import re
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import ai, award_cases, council, documents, merit_contents, recipients
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

    @app.on_event("startup")
    def _startup() -> None:
        init_db()

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

    app.include_router(award_cases.router)
    app.include_router(recipients.router)
    app.include_router(merit_contents.router)
    app.include_router(documents.router)
    app.include_router(council.router)
    app.include_router(ai.router)

    return app


app = create_app()
