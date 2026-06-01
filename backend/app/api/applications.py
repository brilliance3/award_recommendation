"""공용 신청 폼 API — 민간인이 /apply에서 제출하면 AwardCase + Recipient(s) + ... 일괄 생성"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services.xlsx_generator import _extract_region_from_address

router = APIRouter(tags=["applications"])


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
    today = datetime.utcnow().date()
    # 설정(기관/부서/등급/직위) — 담당자가 설정 탭에서 수정한 값을 사용
    setting = db.query(models.AppSetting).first()
    agency = (setting.agency_name if setting else None) or "경기도의회"
    committee = (setting.committee_name if setting else None) or "보건복지위원회"
    rec_position = (setting.recommender_position if setting else None) or "위원"
    # 훈격 선택 (경기도의회 의장 / 경기도지사)
    if payload.award_kind == "governor":
        award_grade = (setting.governor_award_grade if setting else None) or "경기도지사 표창"
        grade_label = "도지사"
    else:
        award_grade = (setting.award_grade if setting else None) or f"{agency} 의장 표창"
        grade_label = "의장"

    # 표창건 제목 자동 생성
    rep_target = payload.recipients[0].recipient_name if payload.recipients else "추천대상자"
    n = len(payload.recipients)
    suffix = f" 외 {n - 1}인" if n > 1 else ""
    title = f"{today.year}년 {grade_label} 표창 신청 — {rep_target}{suffix}"

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
    )
    db.add(case)
    db.flush()

    client_host = request.client.host if request.client else ""
    submitter_ip = (request.headers.get("x-forwarded-for") or client_host)[:64]
    now = datetime.utcnow()

    recipient_ids = []
    for idx, r_payload in enumerate(payload.recipients, start=1):
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
        )
        db.add(recipient)
        db.flush()

        # 체크리스트
        cl_payload = r_payload.checklist
        # 본인 확인은 신청 폼이라 클라이언트가 보낸 값 그대로 사용
        # (신청 폼에서는 본인이 직접 작성한다고 전제)
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

        # 공적사항
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
            mc = models.MeritContent(
                recipient_id=recipient.id,
                merit_short_summary=mc_payload.merit_short_summary,
                recommendation_reason=mc_payload.recommendation_reason,
                merit_overview_1=mc_payload.merit_overview_1,
                merit_overview_2=mc_payload.merit_overview_2,
                merit_overview_3=mc_payload.merit_overview_3,
                merit_overview_4=mc_payload.merit_overview_4,
                full_merit_text=mc_payload.full_merit_text,
            )
            db.add(mc)

        # 주요 경력 (빈 줄 제외)
        for i, c in enumerate(r_payload.careers, start=1):
            if not (c.record_date or c.description):
                continue
            db.add(models.CareerRecord(
                recipient_id=recipient.id,
                record_date=(c.record_date or "").strip() or None,
                description=(c.description or "").strip() or None,
                sort_order=i,
            ))

        # 과거 표창수여 (빈 줄 제외)
        for i, p in enumerate(r_payload.previous_awards, start=1):
            if not (p.award_date or p.description):
                continue
            db.add(models.PreviousAward(
                recipient_id=recipient.id,
                award_date=(p.award_date or "").strip() or None,
                description=(p.description or "").strip() or None,
                sort_order=i,
            ))

        recipient_ids.append(recipient.id)

    db.commit()
    return schemas.ApplicationSubmitResponse(
        award_case_id=case.id,
        recipient_ids=recipient_ids,
    )
