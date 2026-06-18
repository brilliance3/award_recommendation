"""SQLAlchemy DB 세션 설정"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    pool_pre_ping=True,   # 운영 Postgres에서 끊긴 커넥션 자동 재연결
)

# SQLite 동시성 강화 — FastAPI 스레드풀에서 동시 요청 시 'database is locked' 완화.
# WAL(읽기·쓰기 동시성 향상) + busy_timeout(잠금 시 즉시 실패 대신 대기) + synchronous=NORMAL(WAL과 안전).
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):  # noqa: ANN001
        cur = dbapi_conn.cursor()
        try:
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA busy_timeout=5000")
            cur.execute("PRAGMA synchronous=NORMAL")
        finally:
            cur.close()

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
    _migrate_plaintext_site_password()
    _seed_defaults()


def _migrate_plaintext_site_password() -> None:
    """기존 평문 site_password 를 1회 해시로 전환(이미 해시면 skip).

    해시 형식은 auth.hash_password() 의 'pbkdf2$...'. 그 접두사가 아니면 평문으로 보고
    해시로 덮어쓴다. verify 는 평문/해시 둘 다 허용(하위호환)하므로 멱등하다."""
    from . import models
    from .auth import hash_password, is_hashed

    db = SessionLocal()
    try:
        s = db.query(models.AppSetting).first()
        if s and s.site_password and not is_hashed(s.site_password):
            s.site_password = hash_password(s.site_password)
            db.commit()
    except Exception:
        # 마이그레이션 전(컬럼 부재 등) 예외는 무시 — 다음 기동에 재시도
        db.rollback()
    finally:
        db.close()


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


def _pg_ddl(ddl: str) -> str:
    """SQLite 전용 컬럼 타입을 Postgres 문법으로 보정.

    - DATETIME → TIMESTAMP
    - BOOLEAN DEFAULT 0/1 → BOOLEAN DEFAULT FALSE/TRUE
    문자열/날짜 등 나머지(VARCHAR, TEXT, DATE)는 양쪽 호환이라 그대로 둔다."""
    out = ddl.replace("DATETIME", "TIMESTAMP")
    out = out.replace("BOOLEAN DEFAULT 0", "BOOLEAN DEFAULT FALSE")
    out = out.replace("BOOLEAN DEFAULT 1", "BOOLEAN DEFAULT TRUE")
    return out


def _apply_lightweight_migrations() -> None:
    """ADD COLUMN 인플레이스 마이그레이션 (이미 있으면 무시).

    SQLite: IF NOT EXISTS 미지원 → try/except 로 중복 컬럼 에러 무시.
    Postgres: ADD COLUMN IF NOT EXISTS + 타입 보정(_pg_ddl)."""
    is_sqlite = DATABASE_URL.startswith("sqlite")
    additions = [
        ("recipients", "rank_grade", "VARCHAR(100)"),
        ("recipients", "gender", "VARCHAR(10)"),
        ("recipients", "award_date", "DATE"),
        ("recipients", "consent_at", "DATETIME"),
        ("recipients", "consent_version", "VARCHAR(20)"),
        ("recipients", "consent_path", "VARCHAR(30)"),
        ("recipients", "revocation_consent_at", "DATETIME"),
        ("recipients", "revocation_consent_version", "VARCHAR(20)"),
        ("recipients", "signature_path", "VARCHAR(500)"),
        ("recipients", "signed_at", "DATETIME"),
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
        ("award_cases", "share_token", "VARCHAR(36)"),
        ("award_cases", "share_code", "VARCHAR(12)"),
        ("award_cases", "share_enabled", "BOOLEAN DEFAULT 1 NOT NULL"),
        ("award_cases", "share_username", "VARCHAR(100)"),
        ("award_cases", "share_password", "VARCHAR(255)"),
        ("award_cases", "share_expires_at", "DATETIME"),
        ("award_cases", "manage_token", "VARCHAR(36)"),
        ("award_cases", "applicant_submitted", "BOOLEAN DEFAULT 1 NOT NULL"),
        ("award_cases", "deleted_at", "DATETIME"),
        ("app_settings", "department_name", "VARCHAR(255) DEFAULT '보건복지전문위원실'"),
        ("app_settings", "site_username", "VARCHAR(100)"),
        ("app_settings", "site_password", "VARCHAR(255)"),
    ]
    with engine.begin() as conn:
        for table, column, ddl in additions:
            if is_sqlite:
                try:
                    conn.exec_driver_sql(
                        f'ALTER TABLE "{table}" ADD COLUMN "{column}" {ddl}'
                    )
                except Exception:
                    # 이미 컬럼이 있으면 SQLite가 에러 발생 → 무시
                    pass
            else:
                # Postgres — IF NOT EXISTS 로 중복 안전, 타입은 PG 문법으로 보정
                conn.exec_driver_sql(
                    f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "{column}" {_pg_ddl(ddl)}'
                )
