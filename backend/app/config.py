"""애플리케이션 설정"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
GENERATED_DIR = STORAGE_DIR / "generated"
UPLOAD_DIR = STORAGE_DIR / "uploads"
TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"

for d in (STORAGE_DIR, GENERATED_DIR, UPLOAD_DIR):
    d.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/storage/app.db")

# LLM (선택) - 환경변수가 있을 때만 호출
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# PDF 엔진 선택: "playwright" 또는 "weasyprint"
PDF_ENGINE = os.getenv("PDF_ENGINE", "weasyprint")

# 조사자 기본값 (검정색 = 상수, 변경 가능)
DEFAULT_INVESTIGATOR = {
    "department": "경기도의회 보건복지전문위원실",
    "position": "수석전문위원",
    "rank": "지방서기관",
    "name": "이호준",
}

# 추천관 기본값
DEFAULT_RECOMMENDER_AGENCY = "경기도의회"

# CORS
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
).split(",")
