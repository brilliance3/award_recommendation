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
    _apply_lightweight_migrations()
    _seed_defaults()


def _seed_defaults() -> None:
    """최초 1회: AppSetting 기본값 + 의원 명단 시드 + 기존 도장 파일을 SEAL_DIR로 복사.

    legislators.py 정적 명단을 DB로 이전하기 위한 시드. 테이블이 비어 있을 때만 동작.
    """
    import shutil

    from . import models
    from .config import BASE_DIR, SEAL_DIR
    from .legislators import LEGISLATORS

    db = SessionLocal()
    try:
        # AppSetting 존재 = 최초 설치(또는 초기화 후 리셋) 완료 → 재시드/도장복사 스킵.
        # (설정 초기화로 의원 명단을 비운 뒤 재시작해도 다시 시드되지 않게 게이트)
        seeded = db.query(models.AppSetting).first() is not None
        if not seeded:
            db.add(
                models.AppSetting(
                    id="singleton",
                    investigator_name="이호준",
                    investigator_seal_filename="도장 (이호준 수석전문위원).jpg",
                )
            )
            for i, L in enumerate(LEGISLATORS):
                db.add(
                    models.Legislator(
                        name=L.name,
                        party=L.party,
                        is_chair=L.is_chair,
                        staff=L.staff,
                        seal_filename=L.seal_filename,
                        sort_order=i,
                        active=True,
                    )
                )
            db.commit()
    finally:
        db.close()

    if seeded:
        return
    # 최초 설치에만 — 기존 정적 도장(frontend/public/seals)을 런타임 저장소로 복사
    legacy_seals = BASE_DIR.parent / "frontend" / "public" / "seals"
    if legacy_seals.is_dir():
        for f in legacy_seals.iterdir():
            if f.is_file() and not (SEAL_DIR / f.name).exists():
                try:
                    shutil.copy2(f, SEAL_DIR / f.name)
                except Exception:
                    pass


def _apply_lightweight_migrations() -> None:
    """SQLite용 ADD COLUMN 마이그레이션 (이미 있으면 무시)."""
    if not DATABASE_URL.startswith("sqlite"):
        return
    additions = [
        ("recipients", "rank_grade", "VARCHAR(100)"),
        ("recipients", "gender", "VARCHAR(10)"),
        ("checklists", "admin_election_law_general", "VARCHAR(20)"),
        ("checklists", "admin_election_law_general_note", "TEXT"),
        ("checklists", "admin_election_law_basis", "VARCHAR(20)"),
        ("checklists", "admin_election_law_basis_note", "TEXT"),
        ("checklists", "admin_election_law_art112", "VARCHAR(20)"),
        ("checklists", "admin_election_law_art112_note", "TEXT"),
        ("checklists", "admin_reviewer_name", "VARCHAR(100)"),
        ("checklists", "admin_reviewed_at", "DATETIME"),
        ("award_cases", "applicant_role", "VARCHAR(20)"),
        ("award_cases", "applicant_name", "VARCHAR(255)"),
        ("award_cases", "applicant_organization", "VARCHAR(255)"),
        ("award_cases", "applicant_contact", "VARCHAR(255)"),
        ("award_cases", "applicant_delivery_address", "VARCHAR(500)"),
        ("award_cases", "status", "VARCHAR(20) DEFAULT '예정'"),
        ("award_cases", "seal_applied", "BOOLEAN DEFAULT 0 NOT NULL"),
        ("award_cases", "seal_applied_at", "DATETIME"),
        ("award_cases", "chair_sign", "BOOLEAN DEFAULT 0 NOT NULL"),
        ("award_cases", "deleted_at", "DATETIME"),
        ("app_settings", "governor_award_grade", "VARCHAR(255) DEFAULT '경기도지사 표창'"),
        ("app_settings", "governor_quota_per_year", "INTEGER DEFAULT 1"),
        ("app_settings", "department_name", "VARCHAR(255) DEFAULT '보건복지전문위원실'"),
    ]
    with engine.begin() as conn:
        for table, column, ddl in additions:
            try:
                conn.exec_driver_sql(
                    f'ALTER TABLE "{table}" ADD COLUMN "{column}" {ddl}'
                )
            except Exception:
                # 이미 컬럼이 있으면 SQLite가 에러 발생 → 무시
                pass
