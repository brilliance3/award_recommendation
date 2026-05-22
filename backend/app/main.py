"""FastAPI 앱 엔트리포인트"""
import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import award_cases, documents, merit_contents, recipients
from .config import ALLOWED_ORIGINS
from .database import init_db

logger = logging.getLogger("award")
logging.basicConfig(level=logging.INFO)


def create_app() -> FastAPI:
    app = FastAPI(
        title="공적조서 자동 생성 시스템",
        description="표창 추천 업무를 위한 공적 데이터 관리 + 행정문서 자동 생성 시스템",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def _startup() -> None:
        init_db()

    @app.exception_handler(Exception)
    async def _all_exception_handler(request: Request, exc: Exception):
        """예외 traceback을 콘솔에 출력하고, 응답에도 일부 포함."""
        tb = traceback.format_exc()
        logger.error("Unhandled error on %s %s\n%s", request.method, request.url.path, tb)
        return JSONResponse(
            status_code=500,
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

    return app


app = create_app()
