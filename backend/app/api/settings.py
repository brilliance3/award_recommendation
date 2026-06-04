"""설정 + 의원 명단 CRUD API.

- AppSetting 단일 행 조회/수정 (기관·부서·조사자 정보)
- Legislator 명단 CRUD + 도장 업로드 (의원/조사자)
"""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from .. import auth, models
from ..config import SEAL_DIR
from ..database import get_db

router = APIRouter(tags=["settings"])

_ALLOWED_SEAL_EXT = {".jpg", ".jpeg", ".png"}


# ---------- 스키마 ----------
class AppSettingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    agency_name: Optional[str] = None
    committee_name: Optional[str] = None
    department_name: Optional[str] = None
    award_grade: Optional[str] = None
    recommender_position: Optional[str] = None
    quota_per_legislator: Optional[int] = None
    investigator_department: Optional[str] = None
    investigator_position: Optional[str] = None
    investigator_rank: Optional[str] = None
    investigator_name: Optional[str] = None
    investigator_seal_filename: Optional[str] = None


class AppSettingUpdate(BaseModel):
    agency_name: Optional[str] = None
    committee_name: Optional[str] = None
    department_name: Optional[str] = None
    award_grade: Optional[str] = None
    recommender_position: Optional[str] = None
    quota_per_legislator: Optional[int] = None
    investigator_department: Optional[str] = None
    investigator_position: Optional[str] = None
    investigator_rank: Optional[str] = None
    investigator_name: Optional[str] = None


class LegislatorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    party: Optional[str] = None
    is_chair: bool = False
    staff: Optional[str] = None
    seal_filename: Optional[str] = None
    sort_order: int = 0


class LegislatorCreate(BaseModel):
    name: str
    party: Optional[str] = ""
    is_chair: bool = False
    staff: Optional[str] = None
    sort_order: Optional[int] = None


class LegislatorUpdate(BaseModel):
    name: Optional[str] = None
    party: Optional[str] = None
    is_chair: Optional[bool] = None
    staff: Optional[str] = None
    sort_order: Optional[int] = None


# ---------- 헬퍼 ----------
def _get_or_create_setting(db: Session) -> models.AppSetting:
    s = db.query(models.AppSetting).first()
    if s is None:
        s = models.AppSetting(id="singleton")
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _save_seal_file(upload: UploadFile, prefix: str) -> str:
    ext = Path(upload.filename or "").suffix.lower()
    if ext not in _ALLOWED_SEAL_EXT:
        raise HTTPException(status_code=400, detail="jpg/png 이미지만 업로드 가능합니다")
    fname = f"{prefix}_{uuid.uuid4().hex[:8]}{ext}"
    dst = SEAL_DIR / fname
    with open(dst, "wb") as f:
        f.write(upload.file.read())
    return fname


# ---------- 설정 ----------
@router.get("/api/settings", response_model=AppSettingRead)
def get_settings(db: Session = Depends(get_db)):
    return _get_or_create_setting(db)


@router.patch("/api/settings", response_model=AppSettingRead)
def update_settings(payload: AppSettingUpdate, db: Session = Depends(get_db)):
    s = _get_or_create_setting(db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.post("/api/settings/reset")
def reset_all(db: Session = Depends(get_db)):
    """모든 설정 초기화 — 완전 기본 상태로 되돌림 (다른 부서 공유 전 정리).

    - 표창건 전부 영구 삭제 (대상자·문서 cascade, 휴지통 포함)
    - 의원 명단 전부 삭제
    - 등록된 도장 파일 삭제
    - AppSetting을 기본값으로 리셋
    """
    import os

    # 1) 표창건 전부 (휴지통 포함) — cascade 위해 개별 삭제
    for c in db.query(models.AwardCase).all():
        db.delete(c)
    # 2) 의원 명단 전부 + 도지사 표창 수동 체크 기록
    db.query(models.Legislator).delete(synchronize_session=False)
    db.query(models.GovernorAwardMark).delete(synchronize_session=False)
    # 3) AppSetting 기본값
    s = _get_or_create_setting(db)
    s.agency_name = "경기도의회"
    s.committee_name = "보건복지위원회"
    s.department_name = "보건복지전문위원실"
    s.award_grade = "경기도의회 의장 표창"
    s.recommender_position = "위원"
    s.quota_per_legislator = 100
    s.investigator_department = "경기도의회 보건복지전문위원실"
    s.investigator_position = "수석전문위원"
    s.investigator_rank = "지방서기관"
    s.investigator_name = ""
    s.investigator_seal_filename = None
    db.commit()
    # 4) 도장 파일 정리 (best-effort)
    try:
        for f in SEAL_DIR.glob("*"):
            if f.is_file():
                try:
                    os.remove(f)
                except Exception:
                    pass
    except Exception:
        pass
    return {"ok": True}


@router.post("/api/settings/investigator-seal", response_model=AppSettingRead)
def upload_investigator_seal(file: UploadFile = File(...), db: Session = Depends(get_db)):
    s = _get_or_create_setting(db)
    s.investigator_seal_filename = _save_seal_file(file, "investigator")
    db.commit()
    db.refresh(s)
    return s


# ---------- 사이트 접근 자격 (로그인 ID/PW) ----------
class SiteCredentialsRead(BaseModel):
    username: str
    has_password: bool


class SiteCredentialsUpdate(BaseModel):
    username: str
    password: str


@router.get("/api/settings/site-credentials", response_model=SiteCredentialsRead)
def get_site_credentials():
    """현재 로그인 아이디와 비밀번호 설정 여부 (비밀번호 값은 노출하지 않음)."""
    return SiteCredentialsRead(
        username=auth.current_username(), has_password=auth.is_enabled()
    )


@router.put("/api/settings/site-credentials", response_model=SiteCredentialsRead)
def update_site_credentials(payload: SiteCredentialsUpdate, db: Session = Depends(get_db)):
    """로그인 아이디/비밀번호 변경. DB 저장 + 인메모리 캐시 즉시 갱신."""
    username = payload.username.strip()
    password = payload.password
    if not username:
        raise HTTPException(status_code=400, detail="아이디를 입력하세요")
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="비밀번호는 4자 이상이어야 합니다")
    s = _get_or_create_setting(db)
    s.site_username = username
    s.site_password = password
    db.commit()
    auth.set_cache(username, password)
    return SiteCredentialsRead(username=username, has_password=True)


# ---------- 의원 명단 ----------
@router.get("/api/legislators", response_model=List[LegislatorRead])
def list_legislators(db: Session = Depends(get_db)):
    return (
        db.query(models.Legislator)
        .filter(models.Legislator.active == True)  # noqa: E712
        .order_by(models.Legislator.sort_order, models.Legislator.name)
        .all()
    )


@router.post("/api/legislators", response_model=LegislatorRead)
def create_legislator(payload: LegislatorCreate, db: Session = Depends(get_db)):
    order = payload.sort_order
    if order is None:
        max_order = (
            db.query(models.Legislator)
            .filter(models.Legislator.active == True)  # noqa: E712
            .count()
        )
        order = max_order
    leg = models.Legislator(
        name=payload.name,
        party=payload.party or "",
        is_chair=payload.is_chair,
        staff=payload.staff,
        sort_order=order,
        active=True,
    )
    db.add(leg)
    db.commit()
    db.refresh(leg)
    return leg


def _get_legislator_or_404(db: Session, leg_id: str) -> models.Legislator:
    leg = db.query(models.Legislator).filter(models.Legislator.id == leg_id).first()
    if not leg:
        raise HTTPException(status_code=404, detail="의원을 찾을 수 없습니다")
    return leg


@router.patch("/api/legislators/{leg_id}", response_model=LegislatorRead)
def update_legislator(leg_id: str, payload: LegislatorUpdate, db: Session = Depends(get_db)):
    leg = _get_legislator_or_404(db, leg_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(leg, k, v)
    db.commit()
    db.refresh(leg)
    return leg


@router.delete("/api/legislators/{leg_id}")
def delete_legislator(leg_id: str, db: Session = Depends(get_db)):
    leg = _get_legislator_or_404(db, leg_id)
    leg.active = False  # soft delete (기존 표창 건의 추천의원명 보존)
    db.commit()
    return {"ok": True}


@router.post("/api/legislators/{leg_id}/seal", response_model=LegislatorRead)
def upload_legislator_seal(
    leg_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    leg = _get_legislator_or_404(db, leg_id)
    leg.seal_filename = _save_seal_file(file, f"leg_{leg.name}")
    db.commit()
    db.refresh(leg)
    return leg
