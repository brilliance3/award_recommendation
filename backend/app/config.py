"""애플리케이션 설정"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# STORAGE_DIR을 환경변수로 오버라이드 가능 (Fly.io 볼륨 마운트 등)
STORAGE_DIR = Path(os.getenv("STORAGE_DIR", str(BASE_DIR / "storage")))
GENERATED_DIR = STORAGE_DIR / "generated"
UPLOAD_DIR = STORAGE_DIR / "uploads"
# 도장 이미지 — 담당자가 업로드/교체 가능하므로 정적(frontend) 대신 런타임 저장소에 보관
SEAL_DIR = STORAGE_DIR / "seals"
TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"

for d in (STORAGE_DIR, GENERATED_DIR, UPLOAD_DIR, SEAL_DIR):
    d.mkdir(parents=True, exist_ok=True)

# DB URL - SQLite(로컬) 또는 Postgres(운영)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{STORAGE_DIR}/app.db")
# Heroku/Supabase legacy 형식 보정
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+psycopg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

# LLM (선택) - 환경변수가 있을 때만 호출
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# PDF 엔진 선택: "playwright" 또는 "weasyprint" (운영기본=playwright)
PDF_ENGINE = os.getenv("PDF_ENGINE", "playwright")

# 조사자 기본값 (검정색 = 상수, 변경 가능)
DEFAULT_INVESTIGATOR = {
    "department": os.getenv("INV_DEPARTMENT", "경기도의회 보건복지전문위원실"),
    "position": os.getenv("INV_POSITION", "수석전문위원"),
    "rank": os.getenv("INV_RANK", "지방서기관"),
    "name": os.getenv("INV_NAME", ""),
}

DEFAULT_RECOMMENDER_AGENCY = os.getenv("RECOMMENDER_AGENCY", "경기도의회")

# CORS - 콤마 구분, "*" 면 모두 허용
_origins_raw = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
)
ALLOWED_ORIGINS = [o.strip() for o in _origins_raw.split(",") if o.strip()]
