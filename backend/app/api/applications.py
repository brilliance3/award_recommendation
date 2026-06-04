"""공용 신청 폼 API — 민간인이 /apply에서 제출하면 AwardCase + Recipient(s) + ... 일괄 생성

기관 대표 신청은 공유 토큰(share_token)을 발급해, 외부 피추천자가 그 링크로 본인 정보를
한 명씩 직접 추가할 수 있다(공개 GET/POST by-token)."""
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services.xlsx_generator import _extract_region_from_address
from .deps import get_case_by_share_token_or_404, get_case_by_manage_token_or_404

router = APIRouter(tags=["applications"])


def _share_authorized(case: models.AwardCase, request: Request) -> bool:
    """공유 링크 자격 검사. 자격 미설정이면 항상 통과.
    설정 시 요청 헤더 X-Share-Id / X-Share-Pw 가 일치해야 함(상수시간 비교)."""
    if not case.share_password:
        return True
    uid = request.headers.get("x-share-id", "")
    pw = request.headers.get("x-share-pw", "")
    ok_u = secrets.compare_digest(uid.encode("utf-8"), (case.share_username or "").encode("utf-8"))
    ok_p = secrets.compare_digest(pw.encode("utf-8"), case.share_password.encode("utf-8"))
    return ok_u and ok_p

# 공유 링크 유효기간(일) — 만료되면 자가추가 차단(담당자가 회수/갱신 가능)
SHARE_TOKEN_TTL_DAYS = 30


def build_case_title(org_name, recipient_names) -> str:
    """표창 건명 생성: "기관명_대표자 외 N명".

    - 기관명(applicant_organization)이 있으면 "{기관명}_{대표자} 외 {N-1}명".
    - 기관명이 없으면(개인 신청) "{대표자} 외 {N-1}명".
    - 대상자 1명이면 "외 N명" 없이 "{기관명}_{대표자}" / "{대표자}".
    Part 2(대상자 URL 자가추가)로 인원이 늘면 이 함수로 제목을 다시 계산한다.
    """
    names = [n for n in (recipient_names or []) if n]
    first = names[0] if names else "대상자"
    suffix = f" 외 {len(names) - 1}명" if len(names) > 1 else ""
    org = (org_name or "").strip()
    return f"{org}_{first}{suffix}" if org else f"{first}{suffix}"


def _create_recipient_from_payload(
    db: Session,
    case: models.AwardCase,
    r_payload: "schemas.ApplicationRecipient",
    idx: int,
    submitter_ip: str,
    now: datetime,
) -> str:
    """ApplicationRecipient 1건 → Recipient + Checklist + MeritContent + 경력 + 과거표창 생성.

    submit_application(일괄)과 add_recipient_by_token(자가추가) 양쪽에서 공용. recipient.id 반환."""
    recipient = models.Recipient(
        award_case_id=case.id,
        sequence_no=idx,
        recipient_name=r_payload.recipient_name,
        chinese_name=r_payload.chinese_name,
        birth_date=r_payload.birth_date,
        gender=r_payload.gender,
        address=r_payload.address,
        region=r_payload.region or _extract_region_from_address(r_payload.address) or None,
        occupation=r_payload.occupation,
        organization_name=r_payload.organization_name,
        recipient_position_title=r_payload.recipient_position_title,
        rank_grade=r_payload.rank_grade,
        external_title=r_payload.external_title,
        merit_category=r_payload.merit_category,
        merit_period=r_payload.merit_period,
        recommendation_rank="1순위",
        # 희망표창일을 각 대상자 초기값으로 복제(이후 담당자가 개인별 수정 가능)
        award_date=case.award_date,
    )
    db.add(recipient)
    db.flush()

    cl_payload = r_payload.checklist
    checklist = models.Checklist(
        recipient_id=recipient.id,
        item_service_period=cl_payload.item_service_period,
        item_service_period_note=cl_payload.item_service_period_note,
        item_prior_award=cl_payload.item_prior_award,
        item_prior_award_note=cl_payload.item_prior_award_note,
        item_discipline=cl_payload.item_discipline,
        item_discipline_note=cl_payload.item_discipline_note,
        item_investigation=cl_payload.item_investigation,
        item_investigation_note=cl_payload.item_investigation_note,
        item_criminal=cl_payload.item_criminal,
        item_criminal_note=cl_payload.item_criminal_note,
        item_arrears=cl_payload.item_arrears,
        item_arrears_note=cl_payload.item_arrears_note,
        item_misconduct=cl_payload.item_misconduct,
        item_misconduct_note=cl_payload.item_misconduct_note,
        item_award_revoked=cl_payload.item_award_revoked,
        item_award_revoked_note=cl_payload.item_award_revoked_note,
        self_confirm_name=cl_payload.self_confirm_name,
        self_confirm_birth=cl_payload.self_confirm_birth,
        submitted_at=now,
        submitter_ip=submitter_ip,
    )
    db.add(checklist)

    mc_payload = r_payload.merit_content
    if any(
        getattr(mc_payload, f) for f in
        (
            "merit_short_summary",
            "recommendation_reason",
            "merit_overview_1",
            "merit_overview_2",
            "merit_overview_3",
            "merit_overview_4",
            "full_merit_text",
        )
    ):
        db.add(models.MeritContent(
            recipient_id=recipient.id,
            merit_short_summary=mc_payload.merit_short_summary,
            recommendation_reason=mc_payload.recommendation_reason,
            merit_overview_1=mc_payload.merit_overview_1,
            merit_overview_2=mc_payload.merit_overview_2,
            merit_overview_3=mc_payload.merit_overview_3,
            merit_overview_4=mc_payload.merit_overview_4,
            full_merit_text=mc_payload.full_merit_text,
        ))

    for i, c in enumerate(r_payload.careers, start=1):
        if not (c.record_date or c.description):
            continue
        db.add(models.CareerRecord(
            recipient_id=recipient.id,
            record_date=(c.record_date or "").strip() or None,
            description=(c.description or "").strip() or None,
            sort_order=i,
        ))

    for i, p in enumerate(r_payload.previous_awards, start=1):
        if not (p.award_date or p.description):
            continue
        db.add(models.PreviousAward(
            recipient_id=recipient.id,
            award_date=(p.award_date or "").strip() or None,
            description=(p.description or "").strip() or None,
            sort_order=i,
        ))

    return recipient.id


@router.post(
    "/api/applications/submit",
    response_model=schemas.ApplicationSubmitResponse,
)
def submit_application(
    payload: schemas.ApplicationSubmit,
    request: Request,
    db: Session = Depends(get_db),
):
    """공용 신청 — AwardCase 자동 생성, 대상자/체크리스트/공적사항도 함께 생성"""
    # 희망 표창일 필수 (담당자가 이후 관리자 화면에서 수정 가능). 모델/DB는 nullable 유지
    # — 기존 레코드·관리자 편집 호환을 위해 제출 시점에만 강제.
    if not payload.award_date:
        raise HTTPException(status_code=400, detail="희망 표창일을 입력해 주세요.")
    # 희망 등기수령 주소: 개인·기관 공통 필수 / 연락처: 기관 대표 신청 필수
    if not (payload.applicant_delivery_address or "").strip():
        raise HTTPException(status_code=400, detail="희망 등기수령 주소를 입력해 주세요.")
    if payload.applicant_role == "organization" and not (payload.applicant_contact or "").strip():
        raise HTTPException(
            status_code=400, detail="기관 대표 신청은 연락처가 필요합니다."
        )
    # 개인 신청은 본인(대상자) 1명 이상 필수. 기관 대표 신청은 0명 허용(공유 URL로 자가추가).
    if payload.applicant_role == "individual" and len(payload.recipients) < 1:
        raise HTTPException(status_code=400, detail="추천대상자를 1명 이상 입력해 주세요.")
    today = datetime.utcnow().date()
    # 설정(기관/부서/등급/직위) — 담당자가 설정 탭에서 수정한 값을 사용
    setting = db.query(models.AppSetting).first()
    agency = (setting.agency_name if setting else None) or "경기도의회"
    committee = (setting.committee_name if setting else None) or "보건복지위원회"
    rec_position = (setting.recommender_position if setting else None) or "위원"
    # 훈격: 경기도의회 의장 표창 단일(도지사 표창 기능 제거됨)
    award_grade = (setting.award_grade if setting else None) or f"{agency} 의장 표창"

    # 표창건 제목: "기관명_대표자 외 N명" (기관명 없으면 "대표자 외 N명")
    title = build_case_title(
        payload.applicant_organization,
        [r.recipient_name for r in payload.recipients],
    )

    # 추천자(추천의원) — 입력받은 의원 성명을 그대로 저장. 소속(기관·위원회)은 설정값,
    # 호칭은 의원 추천 특성상 "의원" 고정 (recommender_position '위원'과는 별개 용도).
    recommender_name = payload.recommender_name.strip()
    recommender_full_title = f"{agency} {committee} 의원   {recommender_name}"

    case = models.AwardCase(
        title=title,
        award_grade=award_grade,
        recommender_department=committee,
        recommender_position=rec_position,
        recommender_name=recommender_name,
        recommender_full_title=recommender_full_title,
        recommendation_date=today,
        award_date=payload.award_date,
        # 신청자(applicant) 정보 — 추천의원과 별개. 민간인이 본인 정보로 작성한 부분.
        applicant_role=payload.applicant_role,
        applicant_name=payload.applicant_name.strip(),
        applicant_organization=payload.applicant_organization,
        applicant_contact=payload.applicant_contact,
        applicant_delivery_address=payload.applicant_delivery_address,
        # 기관 대표 신청만 공유 토큰 발급(개인은 None). 만료일=발급+TTL, 회수는 share_enabled.
        share_token=(
            uuid.uuid4().hex if payload.applicant_role == "organization" else None
        ),
        share_expires_at=(
            datetime.utcnow() + timedelta(days=SHARE_TOKEN_TTL_DAYS)
            if payload.applicant_role == "organization"
            else None
        ),
        # 기관 대표 전용 관리 토큰 + '최종 제출 전' 상태(담당자 목록에서 숨김).
        # 개인/일반은 manage_token 없음 + applicant_submitted=True(즉시 노출).
        manage_token=(
            uuid.uuid4().hex if payload.applicant_role == "organization" else None
        ),
        applicant_submitted=(payload.applicant_role != "organization"),
    )
    db.add(case)
    db.flush()

    client_host = request.client.host if request.client else ""
    submitter_ip = (request.headers.get("x-forwarded-for") or client_host)[:64]
    now = datetime.utcnow()

    recipient_ids = [
        _create_recipient_from_payload(db, case, r_payload, idx, submitter_ip, now)
        for idx, r_payload in enumerate(payload.recipients, start=1)
    ]

    db.commit()
    return schemas.ApplicationSubmitResponse(
        award_case_id=case.id,
        recipient_ids=recipient_ids,
        share_token=case.share_token,
        manage_token=case.manage_token,
    )


# 공유 링크 1건당 최대 자가추가 인원(스팸/오남용 방지 — 최후 방어선)
SHARE_MAX_RECIPIENTS = 100


@router.get(
    "/api/applications/by-token/{token}",
    response_model=schemas.ShareCaseInfo,
)
def get_share_case_info(token: str, request: Request, db: Session = Depends(get_db)):
    """공유 토큰으로 보는 신청 요약(공개). PII 최소 — 대상자 명단·생년월일·주소 미노출.
    자격이 설정된 링크는 헤더 자격이 맞아야 정보를 반환(틀리면 protected/authorized만)."""
    case = get_case_by_share_token_or_404(db, token)
    protected = bool(case.share_password)
    authorized = _share_authorized(case, request)
    if protected and not authorized:
        return schemas.ShareCaseInfo(protected=True, authorized=False)
    return schemas.ShareCaseInfo(
        organization=case.applicant_organization,
        recommender_name=case.recommender_name,
        award_grade=case.award_grade,
        award_date=case.award_date,
        recipient_count=len(case.recipients),
        protected=protected,
        authorized=True,
    )


@router.post(
    "/api/applications/by-token/{token}/recipients",
    response_model=schemas.ShareRecipientAddResponse,
)
def add_recipient_by_token(
    token: str,
    payload: schemas.ApplicationRecipient,
    request: Request,
    db: Session = Depends(get_db),
):
    """공유 토큰으로 외부 피추천자가 본인 정보를 1명 추가(공개).

    강한 본인확인: 체크리스트 본인확인 성명·생년월일이 입력한 기본정보와 일치해야 한다.
    중복(성명+생년월일) 차단, case별 인원 상한, 제목 자동 갱신."""
    case = get_case_by_share_token_or_404(db, token)

    # 공유 링크 자격(설정 시) — 헤더 자격 불일치면 차단
    if not _share_authorized(case, request):
        raise HTTPException(status_code=401, detail="공유 링크 자격(아이디/비밀번호)이 필요합니다.")

    # 강한 본인확인 — 체크리스트 self_confirm 이 기본정보(성명·생년월일)와 일치해야 함
    if (payload.checklist.self_confirm_name or "").strip() != (payload.recipient_name or "").strip():
        raise HTTPException(
            status_code=400,
            detail="본인확인 성명이 입력하신 대상자 성명과 일치하지 않습니다.",
        )
    if (payload.checklist.self_confirm_birth or "").strip() != payload.birth_date.isoformat():
        raise HTTPException(
            status_code=400,
            detail="본인확인 생년월일이 입력하신 생년월일과 일치하지 않습니다.",
        )

    # 중복 추가 차단 — 동일 성명+생년월일이 이미 있으면 409
    for r in case.recipients:
        if (r.recipient_name or "").strip() == (payload.recipient_name or "").strip() and r.birth_date == payload.birth_date:
            raise HTTPException(
                status_code=409,
                detail="이미 추가된 대상자입니다(동일 성명·생년월일).",
            )

    # 인원 상한(오남용 방지)
    if len(case.recipients) >= SHARE_MAX_RECIPIENTS:
        raise HTTPException(
            status_code=400,
            detail="이 신청에 추가 가능한 인원을 초과했습니다. 담당자에게 문의해 주세요.",
        )

    client_host = request.client.host if request.client else ""
    submitter_ip = (request.headers.get("x-forwarded-for") or client_host)[:64]
    now = datetime.utcnow()
    idx = len(case.recipients) + 1
    rid = _create_recipient_from_payload(db, case, payload, idx, submitter_ip, now)
    db.flush()

    # 제목 자동 갱신 — "기관명_대표자 외 N명" (인원 증가 반영)
    db.refresh(case)
    case.title = build_case_title(
        case.applicant_organization,
        [r.recipient_name for r in case.recipients],
    )
    db.commit()
    db.refresh(case)
    return schemas.ShareRecipientAddResponse(
        recipient_id=rid,
        recipient_count=len(case.recipients),
    )


@router.get(
    "/api/applications/manage/{manage_token}",
    response_model=schemas.ManageCaseInfo,
)
def get_manage_info(manage_token: str, db: Session = Depends(get_db)):
    """기관 대표 전용 — 모인 대상자 검토 화면 데이터. 대표만 보유한 관리 토큰으로 접근."""
    case = get_case_by_manage_token_or_404(db, manage_token)
    return schemas.ManageCaseInfo(
        organization=case.applicant_organization,
        recommender_name=case.recommender_name,
        award_grade=case.award_grade,
        award_date=case.award_date,
        share_token=case.share_token,
        submitted=bool(case.applicant_submitted),
        recipient_count=len(case.recipients),
        recipients=[
            schemas.ManageRecipientItem(
                recipient_name=r.recipient_name,
                organization_name=r.organization_name,
                recipient_position_title=r.recipient_position_title,
                merit_category=r.merit_category,
            )
            for r in case.recipients
        ],
        share_protected=bool(case.share_password),
        share_username=case.share_username or "",
    )


@router.put(
    "/api/applications/manage/{manage_token}/share-credentials",
    response_model=schemas.ShareCredentialsRead,
)
def set_share_credentials_by_manage(
    manage_token: str,
    payload: schemas.ShareCredentialsUpdate,
    db: Session = Depends(get_db),
):
    """기관 대표가 관리 화면에서 공유 링크 자격을 설정/변경/해제.
    password 가 비면 자격 해제(공개). 설정 시 아이디·비밀번호 모두 필요."""
    case = get_case_by_manage_token_or_404(db, manage_token)
    _apply_share_credentials(case, payload)
    db.commit()
    db.refresh(case)
    return schemas.ShareCredentialsRead(
        protected=bool(case.share_password),
        username=case.share_username or "",
        password=case.share_password or "",
    )


def _apply_share_credentials(
    case: models.AwardCase, payload: schemas.ShareCredentialsUpdate
) -> None:
    """공유 자격 적용 — 비밀번호 비면 해제, 있으면 아이디(기본 share)+비밀번호 설정."""
    pw = (payload.password or "").strip()
    if not pw:
        case.share_username = None
        case.share_password = None
        return
    if len(pw) < 4:
        raise HTTPException(status_code=400, detail="비밀번호는 4자 이상이어야 합니다")
    case.share_username = (payload.username or "").strip() or "share"
    case.share_password = pw


@router.post(
    "/api/applications/manage/{manage_token}/submit",
    response_model=schemas.ManageSubmitResponse,
)
def submit_manage(manage_token: str, db: Session = Depends(get_db)):
    """기관 대표가 검토를 마치고 최종 제출 — 이때부터 담당자 시스템(표창 관리)에 노출된다.

    대상자 추가 링크는 그대로 열려 있어, 이후 추가분은 담당자에게 바로 보인다."""
    case = get_case_by_manage_token_or_404(db, manage_token)
    if len(case.recipients) < 1:
        raise HTTPException(
            status_code=400,
            detail="추가된 추천대상자가 없습니다. 대상자가 1명 이상 추가된 뒤 제출해 주세요.",
        )
    case.applicant_submitted = True
    db.commit()
    db.refresh(case)
    return schemas.ManageSubmitResponse(
        submitted=True,
        recipient_count=len(case.recipients),
    )
