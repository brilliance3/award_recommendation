"""문서 생성 / 다운로드 API"""
from __future__ import annotations

from contextlib import contextmanager
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import GENERATED_DIR, SEAL_DIR, UPLOAD_DIR
from ..database import get_db
from ..services import (
    consent_generator,
    hwpx_generator,
    pdf_generator,
    pdf_preview,
    pdf_seal,
    xlsx_generator,
    zip_packager,
)
from ..services.url_extractor import extract_from_url
from .deps import get_case_or_404, get_recipient_or_404

router = APIRouter(tags=["documents"])


def _register_document(
    db: Session,
    case_id: str,
    recipient_id: str | None,
    doc_type: str,
    file_path,
) -> models.GeneratedDocument:
    doc = models.GeneratedDocument(
        award_case_id=case_id,
        recipient_id=recipient_id,
        document_type=doc_type,
        file_name=file_path.name,
        file_path=str(file_path),
    )
    db.add(doc)
    db.commit()
    return doc


def _download_url(file_name: str) -> str:
    return f"/api/files/{quote(file_name)}"


@router.post(
    "/api/recipients/{recipient_id}/generate-pdf",
    response_model=schemas.GenerateDocumentResponse,
)
def generate_pdf(recipient_id: str, db: Session = Depends(get_db)):
    r = get_recipient_or_404(db, recipient_id)
    if not r.award_case:
        raise HTTPException(status_code=400, detail="표창 건 정보가 없습니다")
    path = pdf_generator.generate_pdf(r.award_case, r)
    _register_document(db, r.award_case_id, r.id, "merit_report", path)
    return schemas.GenerateDocumentResponse(
        files=[
            schemas.GeneratedFileInfo(
                type="merit_report",
                file_name=path.name,
                download_url=_download_url(path.name),
            )
        ]
    )


@router.post(
    "/api/recipients/{recipient_id}/generate-consent-pdf",
    response_model=schemas.GenerateDocumentResponse,
)
def generate_consent_pdf(recipient_id: str, db: Session = Depends(get_db)):
    """개인정보 동의서 PDF 생성 — 성명·날짜·동의 체크 채움 + 자필 서명 합성."""
    r = get_recipient_or_404(db, recipient_id)
    if not r.award_case:
        raise HTTPException(status_code=400, detail="표창 건 정보가 없습니다")
    path = consent_generator.generate_consent_pdf(r)
    _register_document(db, r.award_case_id, r.id, "consent_pdf", path)
    return schemas.GenerateDocumentResponse(
        files=[
            schemas.GeneratedFileInfo(
                type="consent_pdf",
                file_name=path.name,
                download_url=_download_url(path.name),
            )
        ]
    )


@router.post(
    "/api/award-cases/{case_id}/generate-xlsx",
    response_model=schemas.GenerateDocumentResponse,
)
def generate_xlsx(case_id: str, db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    overview_path = xlsx_generator.generate_merit_overview_xlsx(case)
    list_path = xlsx_generator.generate_recipient_list_xlsx(case)
    _register_document(db, case.id, None, "merit_overview", overview_path)
    _register_document(db, case.id, None, "recipient_list", list_path)
    return schemas.GenerateDocumentResponse(
        files=[
            schemas.GeneratedFileInfo(
                type="merit_overview",
                file_name=overview_path.name,
                download_url=_download_url(overview_path.name),
            ),
            schemas.GeneratedFileInfo(
                type="recipient_list",
                file_name=list_path.name,
                download_url=_download_url(list_path.name),
            ),
        ]
    )


@router.post(
    "/api/award-cases/{case_id}/generate-all",
    response_model=schemas.GenerateDocumentResponse,
)
def generate_all(case_id: str, db: Session = Depends(get_db)):
    """전체 파일(01 공적개요서 + 02 공적조서 N개 + 03 표창대상자) 일괄 생성"""
    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")

    files: list = []
    overview_path = xlsx_generator.generate_merit_overview_xlsx(case)
    list_path = xlsx_generator.generate_recipient_list_xlsx(case)
    _register_document(db, case.id, None, "merit_overview", overview_path)
    _register_document(db, case.id, None, "recipient_list", list_path)
    files.append(("merit_overview", overview_path))
    files.append(("recipient_list", list_path))

    for r in case.recipients:
        pdf_path = pdf_generator.generate_pdf(case, r)
        _register_document(db, case.id, r.id, "merit_report", pdf_path)
        files.append(("merit_report", pdf_path))

    return schemas.GenerateDocumentResponse(
        files=[
            schemas.GeneratedFileInfo(type=t, file_name=p.name, download_url=_download_url(p.name))
            for (t, p) in files
        ]
    )


@router.post(
    "/api/award-cases/{case_id}/generate-overview-hwpx",
    response_model=schemas.GenerateDocumentResponse,
)
def generate_overview_hwpx(case_id: str, db: Session = Depends(get_db)):
    """01. 공적개요서.hwpx 생성 (한글 양식 그대로)"""
    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")
    with _chair_override_ctx(case, db):
        path = hwpx_generator.generate_merit_overview_hwpx(case)
    _register_document(db, case.id, None, "merit_overview_hwpx", path)
    return schemas.GenerateDocumentResponse(
        files=[
            schemas.GeneratedFileInfo(
                type="merit_overview_hwpx",
                file_name=path.name,
                download_url=_download_url(path.name),
            )
        ]
    )


@router.post(
    "/api/award-cases/{case_id}/generate-report-hwpx",
    response_model=schemas.GenerateDocumentResponse,
)
def generate_report_hwpx(case_id: str, db: Session = Depends(get_db)):
    """02. 공적조서.hwpx 생성 (case 1건당 1파일 — 다중 대상자 포함)"""
    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")

    # chair_sign이면 문서 추천관·추천자만 위원장 명의로 출력(통계는 원래 의원 유지).
    # ZIP·PDF 경로와 동일하게 override를 적용한다.
    with _chair_override_ctx(case, db):
        path = hwpx_generator.generate_merit_report_hwpx(
            case, investigator=_investigator_dict(db)
        )
    _register_document(db, case.id, None, "merit_report_hwpx", path)

    return schemas.GenerateDocumentResponse(
        files=[
            schemas.GeneratedFileInfo(
                type="merit_report_hwpx",
                file_name=path.name,
                download_url=_download_url(path.name),
            )
        ]
    )


def _apply_settings_recommender(case: models.AwardCase, db: Session):
    """문서 생성 직전, 위원회명(committee_name)/기관명(agency_name)을 설정값으로 실시간 갱신.

    공적조서 서식1의 '○ 추천기관', '추천(의뢰)자', 추천관 signoff는 case.recommender_department /
    case.recommender_full_title 스냅샷에서 채워지는데, 이 스냅샷은 신청 시점 설정값이라 이후 설정
    변경이 반영되지 않았다. 여기서 생성 직전에만 설정값으로 인메모리 갱신한다(DB commit 없음 →
    통계·스냅샷 보존). award_grade(훈격)는 case별 의장/도지사 토글이라 절대 건드리지 않는다.
    recommender_name은 case 스냅샷 유지(이후 chair override가 위원장으로 갈아끼움).
    원복용 (recommender_department, recommender_full_title) 튜플 반환.
    """
    setting = db.query(models.AppSetting).first()
    agency = ((setting.agency_name if setting else None) or "").strip()
    committee = ((setting.committee_name if setting else None) or "").strip()
    if not agency and not committee:
        return None  # 폴백 가드: 둘 다 비면 기존 case 스냅샷 유지(설정 공란이 case를 덮는 사고 차단)
    orig = (case.recommender_department, case.recommender_full_title)
    eff_committee = committee or case.recommender_department or ""
    eff_agency = agency or "경기도의회"
    if committee:
        case.recommender_department = committee
    name = case.recommender_name or ""
    # applications.py와 동일 포맷(공백 3칸·호칭 '의원'). name 없으면 trailing 공백만 정리.
    case.recommender_full_title = f"{eff_agency} {eff_committee} 의원   {name}".rstrip()
    return orig


def _restore_settings_recommender(case: models.AwardCase, orig):
    if orig:
        case.recommender_department, case.recommender_full_title = orig


def _apply_chair_override(case: models.AwardCase, db: Session):
    """chair_sign이면 문서용 추천 필드(추천관·추천자)를 위원장 명의로 임시 변경.

    통계(쿼터)는 원래 recommender_name 기준이므로 DB는 commit하지 않고, 문서 생성 후
    _restore_recommender로 원복한다. 원복용 원래 값을 반환.
    """
    if not case.chair_sign:
        return None
    chair = (
        db.query(models.Legislator)
        .filter(
            models.Legislator.is_chair == True,  # noqa: E712
            models.Legislator.active == True,  # noqa: E712
        )
        .first()
    )
    if not chair:
        return None
    setting = db.query(models.AppSetting).first()
    agency = (setting.agency_name if setting else None) or "경기도의회"
    committee = (
        case.recommender_department
        or (setting.committee_name if setting else None)
        or ""
    )
    orig = (case.recommender_name, case.recommender_full_title)
    case.recommender_name = chair.name
    case.recommender_full_title = f"{agency} {committee} 의원   {chair.name}"
    return orig


def _restore_recommender(case: models.AwardCase, orig):
    if orig:
        case.recommender_name, case.recommender_full_title = orig


@contextmanager
def _chair_override_ctx(case: models.AwardCase, db: Session):
    """문서 생성 동안만 (1)위원회명/기관명을 설정값으로 실시간 반영, (2)chair_sign이면 추천관을
    위원장 명의로 치환. 끝나면 역순 원복(통계·스냅샷 보존, DB commit 없음)."""
    settings_orig = _apply_settings_recommender(case, db)  # 1) 위원회명/기관명 먼저 갱신
    chair_orig = _apply_chair_override(case, db)            # 2) chair_sign이면 위원장 명의 덮어쓰기
    try:
        yield
    finally:
        _restore_recommender(case, chair_orig)              # chair override 원복(역순)
        _restore_settings_recommender(case, settings_orig)  # settings 반영 원복


def _investigator_dict(db: Session):
    """설정의 현지조사자 정보를 02 공적조서 생성기에 넘길 dict로 변환."""
    s = db.query(models.AppSetting).first()
    if not s:
        return None
    return {
        "department": s.investigator_department,  # 본문표 소속 (기관+부서)
        "position": s.investigator_position,
        "rank": s.investigator_rank,
        "name": s.investigator_name,
        "dept_short": s.department_name,  # 현지조사 소속 (부서명만)
    }


def _generate_report_pdf(case: models.AwardCase, stamped: bool, db: Session):
    """02 공적조서 HWPX 생성 → PDF 변환 → (stamped) 도장 오버레이. 결과 경로 반환.

    chair_sign이면 문서 추천관만 위원장 명의로 출력(통계는 원래 의원 유지).
    도장 파일명·조사자 이름은 DB(Legislator/AppSetting)에서 조회해 pdf_seal로 전달.
    """
    with _chair_override_ctx(case, db):
        hwpx_path = hwpx_generator.generate_merit_report_hwpx(
            case, investigator=_investigator_dict(db)
        )
        try:
            if not stamped:
                pdf_path = pdf_preview.convert_to_pdf_cached(hwpx_path, engine="rhwp")
            else:
                pdf_path = pdf_preview.convert_to_pdf_rhwp(hwpx_path)
        except Exception as _rhwp_err:
            import logging
            import traceback

            logging.getLogger("award").error(
                "rhwp 렌더 실패 → soffice 폴백: %s\n%s",
                _rhwp_err,
                traceback.format_exc(),
            )
            pdf_path = pdf_preview.convert_to_pdf(hwpx_path)
            pdf_preview.strip_blank_pages(pdf_path)
        if not stamped:
            return pdf_path

        # 추천관 도장: 현재 case.recommender_name(override 시 위원장) 기준으로 조회
        legislator = (
            db.query(models.Legislator)
            .filter(
                models.Legislator.name == (case.recommender_name or ""),
                models.Legislator.active == True,  # noqa: E712
            )
            .first()
        )
        setting = db.query(models.AppSetting).first()
        stamped_path = pdf_path.with_name(pdf_path.stem + "_도장.pdf")
        out, _applied = pdf_seal.stamp_pdf(
            pdf_path,
            stamped_path,
            case.recommender_name,
            recommender_seal_filename=legislator.seal_filename if legislator else None,
            investigator_seal_filename=setting.investigator_seal_filename if setting else None,
            investigator_name=setting.investigator_name if setting else "",
        )
        return out


def _build_preview_pdf(kind: str, case, db: Session):
    """미리보기 PDF 1개 생성 후 경로 반환. kind: overview|report|recipients.
    페이지 이미지 엔드포인트와 PDF 엔드포인트가 공유한다."""
    with _chair_override_ctx(case, db):
        if kind == "overview":
            hwpx_path = hwpx_generator.generate_merit_overview_hwpx(case)
            try:
                return pdf_preview.convert_to_pdf_cached(hwpx_path, engine="rhwp")
            except Exception:
                return pdf_preview.convert_to_pdf_cached(hwpx_path, engine="soffice")
        if kind == "recipients":
            xlsx_path = xlsx_generator.generate_recipient_list_xlsx(case)
            return pdf_preview.convert_to_pdf_cached(xlsx_path, engine="soffice")
        # report (02 공적조서) — 도장 토글 반영
        return _generate_report_pdf(case, stamped=bool(case.seal_applied), db=db)


@router.get("/api/award-cases/{case_id}/preview-pages")
def preview_page_count(case_id: str, kind: str = "report", db: Session = Depends(get_db)):
    """미리보기 PDF의 페이지 수 반환 — 가로 넘김 뷰어가 화살표 범위를 정할 때 사용."""
    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")
    try:
        pdf = _build_preview_pdf(kind, case, db)
        return {"pages": pdf_preview.pdf_page_count(pdf)}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/award-cases/{case_id}/preview-page-image")
def preview_page_image(
    case_id: str, page: int = 0, kind: str = "report", db: Session = Depends(get_db)
):
    """미리보기 PDF의 한 페이지를 PNG로 반환 — '페이지 이미지 + 좌우 화살표' 뷰어용.
    react-pdf(worker) 의존 없이 모든 환경에서 동작."""
    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")
    try:
        pdf = _build_preview_pdf(kind, case, db)
        png = pdf_preview.pdf_page_png(pdf, page)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    from fastapi.responses import Response

    return Response(content=png, media_type="image/png")


@router.get("/api/award-cases/{case_id}/preview-html")
def preview_html(
    case_id: str,
    kind: str = "report",
    recipient_index: int = 0,
    db: Session = Depends(get_db),
):
    """02 공적조서 HTML 미리보기 — HWPX→PDF 변환 없이 즉시 렌더(경기천년 웹폰트 임베드).

    화면 확인용이며, 실제 다운로드되는 한글/PDF와 줄바꿈·페이지 분할이 다를 수 있다.
    다인 case는 recipient_index로 대상자별 미리보기, 대상자 수는 X-Recipient-Count 헤더로 전달.
    """
    from fastapi.responses import HTMLResponse

    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")
    recipients = list(case.recipients)
    idx = max(0, min(recipient_index, len(recipients) - 1))
    with _chair_override_ctx(case, db):
        html = pdf_generator.render_html_for_preview(
            case, recipients[idx], investigator=_investigator_dict(db)
        )
    return HTMLResponse(
        content=html, headers={"X-Recipient-Count": str(len(recipients))}
    )


@router.get("/api/fonts/{filename}")
def serve_font(filename: str):
    """경기천년체 OTF 정적 서빙 — HTML 미리보기 @font-face가 참조(장기 캐시)."""
    from fastapi.responses import FileResponse
    from ..services.pdf_preview import _FONTS_DIR

    base = _FONTS_DIR.resolve()
    fp = (base / filename).resolve()
    # 경로 탈출 차단: 반드시 폰트 디렉토리 직속의 .otf 파일이어야 함
    if fp.parent != base or not fp.is_file() or fp.suffix.lower() != ".otf":
        raise HTTPException(status_code=404, detail="font not found")
    return FileResponse(
        fp,
        media_type="font/otf",
        headers={"Cache-Control": "public, max-age=31536000"},
    )


@router.get("/api/award-cases/{case_id}/preview-overview-pdf")
def preview_overview_pdf(case_id: str, db: Session = Depends(get_db)):
    """01 공적개요서 미리보기 PDF — HWPX 재생성 + PDF 변환 (inline)."""
    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")
    try:
        out_pdf = _build_preview_pdf("overview", case, db)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return FileResponse(
        out_pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{quote(out_pdf.name)}"'},
    )


@router.get("/api/award-cases/{case_id}/preview-recipient-list-pdf")
def preview_recipient_list_pdf(case_id: str, db: Session = Depends(get_db)):
    """03 표창대상자 미리보기 PDF — XLSX 재생성 + PDF 변환 (inline)."""
    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")
    try:
        with _chair_override_ctx(case, db):
            xlsx_path = xlsx_generator.generate_recipient_list_xlsx(case)
            # 03 표창대상자는 XLSX → soffice 변환(전용 프로파일) + 내용 해시 캐시.
            out_pdf = pdf_preview.convert_to_pdf_cached(xlsx_path, engine="soffice")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return FileResponse(
        out_pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{quote(out_pdf.name)}"'},
    )


@router.get("/api/award-cases/{case_id}/preview-report-pdf")
def preview_report_pdf(case_id: str, db: Session = Depends(get_db)):
    """02 공적조서 미리보기 PDF — HWPX 재생성 + PDF 변환.

    case.seal_applied=true이면 추천관·조사자 도장 오버레이 적용.
    """
    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")

    try:
        out_pdf = _generate_report_pdf(case, stamped=bool(case.seal_applied), db=db)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return FileResponse(
        out_pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{quote(out_pdf.name)}"'},
    )


@router.post(
    "/api/award-cases/{case_id}/generate-report-pdf",
    response_model=schemas.GenerateDocumentResponse,
)
def generate_report_pdf(case_id: str, db: Session = Depends(get_db)):
    """02 공적조서 PDF 생성 + 다운로드 링크 반환.

    도장 적용 여부는 case.seal_applied 토글에 따름 (ON이면 추천관·조사자 도장 박힘).
    """
    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")

    stamped = bool(case.seal_applied)
    try:
        out_pdf = _generate_report_pdf(case, stamped=stamped, db=db)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # generated/preview/ 폴더 안의 파일을 generated/로 복사 (다운로드 endpoint가 GENERATED_DIR 기준)
    final_path = GENERATED_DIR / out_pdf.name
    if final_path.resolve() != out_pdf.resolve():
        final_path.write_bytes(out_pdf.read_bytes())

    _register_document(db, case.id, None, "merit_report_pdf", final_path)
    return schemas.GenerateDocumentResponse(
        files=[
            schemas.GeneratedFileInfo(
                type="merit_report_pdf",
                file_name=final_path.name,
                download_url=_download_url(final_path.name),
            )
        ]
    )


@router.post(
    "/api/award-cases/{case_id}/stamp-uploaded-pdf",
    response_model=schemas.GenerateDocumentResponse,
)
async def stamp_uploaded_pdf(
    case_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """사용자가 한컴에서 직접 export 한 PDF를 업로드하면 추천관·조사자 도장을 찍어 반환.

    한컴 자체 출력 PDF라 HWPX 서식과 100% 동일하고, 시스템은 도장((인) 자리)만
    오버레이한다. 도장 파일·조사자 이름은 case의 Legislator/AppSetting에서 조회.
    """
    import os as _os

    case = get_case_or_404(db, case_id)
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다")

    data = await file.read()
    # 업로드 검증: 크기 제한 + 실제 PDF 여부(매직바이트)
    if len(data) > 30 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF 파일이 너무 큽니다(최대 30MB)")
    if not data[:5].startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="유효한 PDF 파일이 아닙니다")
    # 파일명은 basename만(경로 조작 방지). 출력명은 case_id로 충돌 방지.
    safe_name = _os.path.basename(file.filename or "upload.pdf")
    src = UPLOAD_DIR / f"{case_id}_업로드본_{safe_name}"
    src.write_bytes(data)

    # 추천관 도장은 chair override(위원장 명의)까지 반영해 조회
    with _chair_override_ctx(case, db):
        legislator = (
            db.query(models.Legislator)
            .filter(
                models.Legislator.name == (case.recommender_name or ""),
                models.Legislator.active == True,  # noqa: E712
            )
            .first()
        )
        setting = db.query(models.AppSetting).first()
        rec_name = case.recommender_name or "추천자"
        out_name = f"02. 공적조서({rec_name}_의원)_도장_{case_id[:8]}.pdf"
        stamped_path = GENERATED_DIR / out_name
        try:
            _out, applied = pdf_seal.stamp_pdf(
                src,
                stamped_path,
                case.recommender_name,
                recommender_seal_filename=legislator.seal_filename if legislator else None,
                investigator_seal_filename=setting.investigator_seal_filename if setting else None,
                investigator_name=setting.investigator_name if setting else "",
            )
        except Exception as e:  # pdfplumber/reportlab 등 변환 오류
            raise HTTPException(status_code=500, detail=f"도장 처리 실패: {e}")

    # 도장이 한 개도 안 찍혔으면(= '(인)' 미검출 또는 도장 파일 미설정) 실패로 알림
    if applied == 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "도장을 찍을 위치를 찾지 못했습니다. 업로드한 PDF에 '(인)' 표시가 "
                "있는지(양식 그대로 출력), 설정에 추천관·조사자 도장 이미지가 등록돼 "
                "있는지 확인해 주세요."
            ),
        )

    _register_document(db, case.id, None, "stamped_uploaded_pdf", stamped_path)
    return schemas.GenerateDocumentResponse(
        files=[
            schemas.GeneratedFileInfo(
                type="stamped_uploaded_pdf",
                file_name=stamped_path.name,
                download_url=_download_url(stamped_path.name),
            )
        ]
    )


@router.post(
    "/api/award-cases/{case_id}/generate-checklist-hwpx",
    response_model=schemas.GenerateDocumentResponse,
)
def generate_checklist_hwpx(case_id: str, db: Session = Depends(get_db)):
    """서식8 체크리스트 HWPX 생성 — 체크리스트 작성된 대상자별 1개씩"""
    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")

    files: list = []
    skipped: list = []
    for r in case.recipients:
        if not r.checklist or not r.checklist.submitted_at:
            skipped.append(r.recipient_name or r.id)
            continue
        path = hwpx_generator.generate_checklist_hwpx(case, r)
        _register_document(db, case.id, r.id, "checklist_hwpx", path)
        files.append(path)

    if not files:
        raise HTTPException(
            status_code=400,
            detail=f"체크리스트가 작성된 대상자가 없습니다. 미작성: {', '.join(skipped)}",
        )

    return schemas.GenerateDocumentResponse(
        files=[
            schemas.GeneratedFileInfo(
                type="checklist_hwpx",
                file_name=p.name,
                download_url=_download_url(p.name),
            )
            for p in files
        ]
    )


@router.post(
    "/api/award-cases/{case_id}/generate-recipient-list-xlsx",
    response_model=schemas.GenerateDocumentResponse,
)
def generate_recipient_list_xlsx(case_id: str, db: Session = Depends(get_db)):
    """03. 표창대상자.xlsx 단독 생성"""
    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")
    with _chair_override_ctx(case, db):
        path = xlsx_generator.generate_recipient_list_xlsx(case)
    _register_document(db, case.id, None, "recipient_list", path)
    return schemas.GenerateDocumentResponse(
        files=[
            schemas.GeneratedFileInfo(
                type="recipient_list",
                file_name=path.name,
                download_url=_download_url(path.name),
            )
        ]
    )


@router.post(
    "/api/award-cases/{case_id}/generate-zip",
    response_model=schemas.GeneratedFileInfo,
)
def generate_zip(case_id: str, db: Session = Depends(get_db)):
    """ZIP 전체 다운로드: 01 HWPX + 02 공적조서 HWPX + 03 XLSX + 서식8 HWPX(체크리스트 작성된 대상자별).

    02 공적조서는 한글에서 열어 PDF로 저장·도장하는 워크플로우이므로 HWPX로 포함한다.
    (서버 측 도장 PDF 렌더는 사용하지 않는다.)"""
    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")

    files = []
    with _chair_override_ctx(case, db):  # chair_sign이면 문서 추천관을 위원장 명의로
        # 01 공적개요서 HWPX
        files.append(hwpx_generator.generate_merit_overview_hwpx(case))
        # 02 공적조서 HWPX (한글에서 PDF 저장·도장용)
        files.append(
            hwpx_generator.generate_merit_report_hwpx(
                case, investigator=_investigator_dict(db)
            )
        )
        # 03 표창대상자 XLSX
        files.append(xlsx_generator.generate_recipient_list_xlsx(case))
        # 서식8 체크리스트 HWPX (자가 체크리스트 제출된 대상자만)
        for r in case.recipients:
            if r.checklist and r.checklist.submitted_at:
                files.append(hwpx_generator.generate_checklist_hwpx(case, r))

    zip_name = f"표창추천_{case.title}.zip"
    zip_path = zip_packager.package_files(zip_name, files)
    _register_document(db, case.id, None, "zip", zip_path)
    return schemas.GeneratedFileInfo(
        type="zip", file_name=zip_path.name, download_url=_download_url(zip_path.name)
    )


@router.get("/api/recipient-xlsx-template")
def recipient_xlsx_template(db: Session = Depends(get_db)):
    """표창대상자 업로드용 빈 서식(XLSX) 다운로드 — 제목·헤더 + 빈 입력 행."""
    setting = db.query(models.AppSetting).first()
    grade = (setting.award_grade if setting else None) or "경기도의회 의장 표창"
    path = xlsx_generator.generate_recipient_list_template_xlsx(award_grade=grade)
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="표창대상자_업로드서식.xlsx",
    )


@router.get("/api/files/{file_name}")
def download_file(file_name: str):
    fp = GENERATED_DIR / file_name
    if not fp.exists():
        raise HTTPException(status_code=404, detail="파일이 존재하지 않습니다")

    if file_name.lower().endswith(".pdf"):
        media = "application/pdf"
    elif file_name.lower().endswith(".xlsx"):
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif file_name.lower().endswith(".zip"):
        media = "application/zip"
    elif file_name.lower().endswith(".hwpx"):
        media = "application/hwp+zip"
    else:
        media = "application/octet-stream"

    return FileResponse(path=str(fp), media_type=media, filename=file_name)


@router.get("/api/seals/{file_name}")
def get_seal(file_name: str):
    """도장 이미지 서빙 (설정 페이지 미리보기/표시용)."""
    fp = SEAL_DIR / file_name
    if not fp.exists():
        raise HTTPException(status_code=404, detail="도장 이미지가 없습니다")
    ext = file_name.lower().rsplit(".", 1)[-1]
    media = "image/png" if ext == "png" else "image/jpeg"
    return FileResponse(path=str(fp), media_type=media)


@router.post("/api/extract-from-url", response_model=schemas.URLExtractResponse)
def extract_from_url_api(payload: schemas.URLExtractRequest):
    return extract_from_url(payload.url)
