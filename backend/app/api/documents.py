"""문서 생성 / 다운로드 API"""
from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import GENERATED_DIR
from ..database import get_db
from ..services import pdf_generator, xlsx_generator, zip_packager
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
    "/api/award-cases/{case_id}/generate-zip",
    response_model=schemas.GeneratedFileInfo,
)
def generate_zip(case_id: str, db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    if not case.recipients:
        raise HTTPException(status_code=400, detail="대상자가 없습니다")

    files = []
    files.append(xlsx_generator.generate_merit_overview_xlsx(case))
    files.append(xlsx_generator.generate_recipient_list_xlsx(case))
    for r in case.recipients:
        files.append(pdf_generator.generate_pdf(case, r))

    zip_name = f"표창추천_{case.title}.zip"
    zip_path = zip_packager.package_files(zip_name, files)
    _register_document(db, case.id, None, "zip", zip_path)
    return schemas.GeneratedFileInfo(
        type="zip", file_name=zip_path.name, download_url=_download_url(zip_path.name)
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
    else:
        media = "application/octet-stream"

    return FileResponse(path=str(fp), media_type=media, filename=file_name)


@router.post("/api/extract-from-url", response_model=schemas.URLExtractResponse)
def extract_from_url_api(payload: schemas.URLExtractRequest):
    return extract_from_url(payload.url)
