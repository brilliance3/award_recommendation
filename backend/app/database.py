"""SQLAlchemy DB 세션 설정"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    pool_pre_ping=True,   # 운영 Postgres에서 끊긴 커넥션 자동 재연결
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # 모든 모델을 import 해야 메타데이터에 등록됨
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # 경기도의회 의원 / 상임위 시드 (없으면 추가)
    try:
        from .services.council_seeder import seed_all
        db = SessionLocal()
        try:
            seed_all(db)
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        import logging
        logging.getLogger("award").warning("Council seed skipped: %s", exc)
