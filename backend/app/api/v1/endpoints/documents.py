import uuid
import shutil
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.config import settings
from backend.app.core.security import (
    get_current_user, get_current_user_optional, decode_access_token,
    generate_document_access_token, verify_document_access_token
)
from backend.app.core.masking import mask_dict_fields
from backend.app.models.models import (
    User, Application, Document, DocumentForensics, ExtractedEntities, ExtractedField, ApplicationAuditEvent
)
from backend.app.schemas.schemas import (
    DocumentResponse, DocumentForensicsResponse, ExtractedEntitiesResponse, ExtractedFieldResponse,
    DocumentAccessTokenResponse, ExtractedFieldCorrectionRequest, DocumentStatusResponse
)
from backend.app.services.forensic_service import ForensicService
from backend.app.services.authenticity import AuthenticityScreeningService
from backend.app.services.ocr_service import OCRService
from backend.app.services.extractor_service import ExtractorService
from backend.app.api.v1.endpoints.audit import compute_event_hash

router = APIRouter(prefix="/documents", tags=["Documents"])

MAGIC_BYTES = {
    ".pdf": b"%PDF-",
    ".png": b"\x89PNG\r\n\x1a\n",
    ".jpg": b"\xff\xd8\xff",
    ".jpeg": b"\xff\xd8\xff"
}

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB

@router.post("/upload/{application_id}", response_model=DocumentResponse)
async def upload_document(
    application_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in MAGIC_BYTES:
        raise HTTPException(status_code=400, detail="Invalid file type. Supported: PDF, PNG, JPG.")

    # Read header to verify magic bytes
    header = await file.read(16)
    expected_magic = MAGIC_BYTES[file_ext]
    if not header.startswith(expected_magic[:4]):
        raise HTTPException(status_code=400, detail=f"File content signature does not match '{file_ext}' extension.")
    await file.seek(0)

    # Save to private isolated directory with safe generated filename
    app_storage_dir = settings.UPLOAD_DIR / application_id
    app_storage_dir.mkdir(parents=True, exist_ok=True)
    safe_uuid = uuid.uuid4().hex[:12]
    safe_disk_filename = f"{safe_uuid}_{document_type.upper()}{file_ext}"
    target_path = app_storage_dir / safe_disk_filename

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = target_path.stat().st_size
    if file_size > MAX_FILE_SIZE_BYTES:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=413, detail=f"File exceeds maximum allowed size of 25MB.")

    # 1. Run Hybrid OCR & Extraction
    ocr_result = OCRService.extract_document_text(target_path)
    extracted = ExtractorService.extract_entities_with_provenance(
        document_type,
        ocr_result.get("full_text", ""),
        pages_data=ocr_result.get("pages", []),
        ocr_engine=ocr_result.get("engine", "PYMUPDF")
    )

    # 2. Persist Document Record
    doc = Document(
        application_id=application_id,
        document_type=document_type.upper(),
        file_name=file.filename,
        storage_path=str(target_path),
        sha256_hash="",  # Populated by screening service below
        file_size_bytes=file_size,
        mime_type=file.content_type or "application/pdf",
        extraction_status="SUCCESS" if ocr_result["success"] else "FAILED"
    )
    db.add(doc)
    db.flush()

    # 3. Run Authenticity Screening Service (All 7 Checks + Heatmap Generation)
    screening_data = AuthenticityScreeningService.screen_document(
        file_path=target_path,
        document_id=doc.id,
        db=db
    )

    # Persist Extracted Entities (Document Level)
    doc_entities = ExtractedEntities(
        document_id=doc.id,
        structured_fields=extracted["structured_fields"],
        confidence_score=extracted["confidence_score"],
        ocr_engine=ocr_result.get("engine", "PYMUPDF"),
        raw_text=ocr_result.get("full_text", "")[:4000]
    )
    db.add(doc_entities)

    # Persist Normalized Extracted Fields with Provenance (Page number, bbox, state)
    for f_item in extracted["atomic_fields"]:
        field_row = ExtractedField(
            document_id=doc.id,
            field_key=f_item["field_key"],
            label=f_item["label"],
            field_value_normalized=f_item["field_value_normalized"],
            field_value_raw=f_item["field_value_raw"],
            data_type=f_item["data_type"],
            confidence_score=f_item["confidence_score"],
            page_number=f_item["page_number"],
            bounding_box=f_item["bounding_box"],
            ocr_engine=f_item["ocr_engine"],
            state=f_item["state"],
            is_manually_corrected=False,
            is_pii=f_item["is_pii"]
        )
        db.add(field_row)

    # Audit log with chained hash
    last_event = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == application_id
    ).order_by(ApplicationAuditEvent.timestamp.desc()).first()
    prev_hash = last_event.event_hash if last_event else None

    audit_log = ApplicationAuditEvent(
        application_id=application_id,
        actor_id=current_user.id,
        actor_role=current_user.role,
        action="DOCUMENT_UPLOAD",
        ip_address="127.0.0.1",
        diff_payload={"document_type": document_type, "file_name": file.filename, "sha256": screening_data.get("sha256_hash", "")},
        previous_event_hash=prev_hash
    )
    db.add(audit_log)
    db.flush()
    audit_log.event_hash = compute_event_hash(
        audit_log.id, audit_log.application_id, audit_log.action, audit_log.actor_id,
        audit_log.timestamp.isoformat(), audit_log.previous_event_hash
    )

    db.commit()
    db.refresh(doc)
    return doc

@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
def get_document_status(document_id: str, db: Session = Depends(get_db)):
    """Retrieve processing status, total pages, and missing vs detected field counts."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    fields = db.query(ExtractedField).filter(ExtractedField.document_id == document_id).all()
    detected = sum(1 for f in fields if f.state in ("DETECTED", "MANUALLY_ENTERED"))
    missing = sum(1 for f in fields if f.state == "MISSING_IN_DOCUMENT")
    failed = sum(1 for f in fields if f.state == "EXTRACTION_FAILED")
    needs_review = missing > 0 or failed > 0 or any(f.confidence_score < 0.70 for f in fields)

    return {
        "document_id": doc.id,
        "status": "EXTRACTED" if doc.extraction_status == "SUCCESS" else "FAILED",
        "total_pages": max(1, max((f.page_number for f in fields), default=1)),
        "ocr_engine": fields[0].ocr_engine if fields else "PYMUPDF",
        "fields_extracted_count": detected,
        "fields_missing_count": missing,
        "fields_failed_count": failed,
        "needs_manual_review": needs_review,
        "updated_at": doc.created_at
    }

@router.patch("/{document_id}/fields/{field_id}", response_model=ExtractedFieldResponse)
def correct_extracted_field(
    document_id: str,
    field_id: str,
    correction: ExtractedFieldCorrectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Human-in-the-loop field correction endpoint.
    Updates the normalized field value, flags it as manually corrected,
    and logs the change to the immutable chained audit journal.
    """
    field = db.query(ExtractedField).filter(
        ExtractedField.id == field_id,
        ExtractedField.document_id == document_id
    ).first()
    if not field:
        raise HTTPException(status_code=404, detail="Extracted field not found.")

    old_val = field.field_value_normalized
    field.field_value_normalized = correction.corrected_value
    field.is_manually_corrected = True
    field.corrected_by_user_id = current_user.id
    field.correction_reason = correction.correction_reason
    field.state = "MANUALLY_ENTERED"

    # Also sync document-level structured_fields if present
    doc = field.document
    if doc and doc.extracted_entities and doc.extracted_entities.structured_fields:
        doc.extracted_entities.structured_fields[field.field_key] = correction.corrected_value

    # Chained Audit event
    app_id = doc.application_id if doc else "unknown"
    last_event = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == app_id
    ).order_by(ApplicationAuditEvent.timestamp.desc()).first()
    prev_hash = last_event.event_hash if last_event else None

    audit_log = ApplicationAuditEvent(
        application_id=app_id,
        actor_id=current_user.id,
        actor_role=current_user.role,
        action="FIELD_CORRECTION",
        ip_address="127.0.0.1",
        diff_payload={
            "document_id": document_id,
            "field_key": field.field_key,
            "old_value": old_val,
            "new_value": correction.corrected_value,
            "reason": correction.correction_reason
        },
        previous_event_hash=prev_hash
    )
    db.add(audit_log)
    db.flush()
    audit_log.event_hash = compute_event_hash(
        audit_log.id, audit_log.application_id, audit_log.action, audit_log.actor_id,
        audit_log.timestamp.isoformat(), audit_log.previous_event_hash
    )

    db.commit()
    db.refresh(field)
    return field


@router.post("/{document_id}/token", response_model=DocumentAccessTokenResponse)
def create_document_access_token(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates a short-lived (15 minutes) HMAC-signed access token for secure preview/download."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    token = generate_document_access_token(document_id, current_user.id, expires_in_seconds=900)
    return {
        "token": token,
        "document_id": document_id,
        "expires_in_seconds": 900,
        "download_url": f"/api/v1/documents/{document_id}/download?token={token}"
    }

@router.get("/{document_id}/forensics", response_model=DocumentForensicsResponse)
def get_document_forensics(document_id: str, db: Session = Depends(get_db)):
    forensics = db.query(DocumentForensics).filter(DocumentForensics.document_id == document_id).first()
    if not forensics:
        raise HTTPException(status_code=404, detail="Forensics report not found for document.")
    
    # If screening_results is missing (e.g. legacy seeded data), run screening dynamically to populate
    if not forensics.screening_results:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc and Path(doc.storage_path).exists():
            updated = AuthenticityScreeningService.screen_document(doc.storage_path, document_id, db)
            forensics.screening_results = updated["screening_results"]
            forensics.heatmap_generated = updated["heatmap_generated"]
            forensics.heatmap_path = updated["heatmap_path"]

    heatmap_url = f"/api/v1/documents/{document_id}/heatmap" if forensics.heatmap_generated else None

    return {
        "id": forensics.id,
        "ela_anomaly_score": forensics.ela_anomaly_score,
        "metadata_mismatch_flag": forensics.metadata_mismatch_flag,
        "metadata_dump": forensics.metadata_dump or {},
        "qr_detected": forensics.qr_detected,
        "qr_payload": forensics.qr_payload,
        "digital_signature_present": forensics.digital_signature_present,
        "signature_valid": forensics.signature_valid,
        "signer_identity": forensics.signer_identity,
        "risk_level": forensics.risk_level,
        "remarks": forensics.remarks,
        "screening_results": forensics.screening_results or [],
        "heatmap_generated": forensics.heatmap_generated,
        "heatmap_path": forensics.heatmap_path,
        "heatmap_url": heatmap_url,
        "disclaimer": (
            "Forensic integrity screening identifies technical anomalies, compression residuals, "
            "and software authoring tags. These findings serve as evidentiary indicators for human "
            "regulatory officers and do not independently constitute definitive legal proof of document tampering or fraud."
        ),
        "evaluated_at": forensics.evaluated_at
    }


def resolve_document_user(
    document_id: str,
    token: Optional[str],
    current_user: Optional[User],
    db: Session
) -> User:
    """
    Resolves the authenticated User from either:
    1. HTTP Bearer authorization header (current_user from get_current_user_optional)
    2. Query parameter 'token':
       - HMAC document access token (scoped to document_id)
       - Standard JWT access token
    """
    user = current_user
    if not user and token:
        # Check HMAC document token first
        doc_payload = verify_document_access_token(token, document_id)
        if doc_payload and doc_payload.get("sub"):
            user = db.query(User).filter(User.id == doc_payload["sub"]).first()
        else:
            # Check standard JWT access token
            jwt_payload = decode_access_token(token)
            if jwt_payload and jwt_payload.get("sub"):
                user = db.query(User).filter(User.email == jwt_payload["sub"]).first()

    if not user:
        if token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or invalid document access token. Please re-authenticate."
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication or valid access token required."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact an administrator."
        )

    if getattr(user, "approval_status", "APPROVED") != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is pending administrator approval or rejected."
        )

    return user


def authorize_document_access(
    document_id: str,
    user: User,
    db: Session
) -> tuple[Document, Path, str]:
    """
    Finds the document, validates multi-tenant permissions, ensures file exists on disk,
    and determines accurate Content-Type.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document record not found.")

    # Multi-tenant and Role permissions:
    # Reviewers, Admins, and Auditors have statutory authority across institutional applications.
    # Applicants are strictly restricted to their own institution's documents (or public benchmark cases).
    if user.role == "APPLICANT":
        app = doc.application
        is_demo_case = app and app.application_number.startswith("APP-2026-CASE-")
        if app and app.applicant_id != user.id and not is_demo_case:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to view documents for another institution."
            )

    file_path = Path(doc.storage_path).resolve()
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found on server.")

    # Determine Content-Type accurately based on file extension
    ext = file_path.suffix.lower()
    mime_map = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }
    content_type = mime_map.get(ext, doc.mime_type or "application/octet-stream")

    return doc, file_path, content_type


@router.get("/{document_id}/heatmap")
def get_document_heatmap(
    document_id: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Returns the genuine suspicious-region heatmap image (PNG) for a document.
    Returns 404 if no heatmap was generated because no mathematical anomaly was detected.
    """
    user = resolve_document_user(document_id, token, current_user, db)
    doc, _, _ = authorize_document_access(document_id, user, db)

    forensics = db.query(DocumentForensics).filter(DocumentForensics.document_id == document_id).first()
    if not forensics or not forensics.heatmap_generated or not forensics.heatmap_path:
        raise HTTPException(
            status_code=404,
            detail="No heatmap available: document compression and sensor characteristics are uniform (no mathematical anomaly detected)."
        )

    heatmap_file = Path(forensics.heatmap_path).resolve()
    if not heatmap_file.exists() or not heatmap_file.is_file():
        raise HTTPException(status_code=404, detail="Heatmap artifact file not found on disk.")

    return FileResponse(
        str(heatmap_file),
        media_type="image/png",
        filename=f"forensic_heatmap_{document_id}.png",
        headers={
            "Content-Disposition": f'inline; filename="forensic_heatmap_{document_id}.png"',
            "X-Content-Type-Options": "nosniff"
        }
    )


@router.get("/{document_id}/entities", response_model=ExtractedEntitiesResponse)
def get_document_entities(document_id: str, unmask: bool = False, db: Session = Depends(get_db)):
    entities = db.query(ExtractedEntities).filter(ExtractedEntities.document_id == document_id).first()
    if not entities:
        raise HTTPException(status_code=404, detail="Extracted entities not found for document.")

    masked_fields = mask_dict_fields(entities.structured_fields, unmask=unmask)
    return {
        "id": entities.id,
        "structured_fields": masked_fields,
        "confidence_score": entities.confidence_score,
        "ocr_engine": entities.ocr_engine,
        "raw_text": mask_dict_fields(entities.raw_text, unmask=unmask) if entities.raw_text else None
    }

@router.get("/{document_id}/fields", response_model=list[ExtractedFieldResponse])
def get_extracted_fields(document_id: str, db: Session = Depends(get_db)):
    """Retrieve normalized extracted fields for a document."""
    fields = db.query(ExtractedField).filter(ExtractedField.document_id == document_id).all()
    return fields

@router.get("/{document_id}/preview")
def preview_document(
    document_id: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Secure preview endpoint returning raw PDF or image bytes with Content-Disposition inline.
    Accepts Bearer authentication header or ?token= query parameter.
    """
    user = resolve_document_user(document_id, token, current_user, db)
    doc, file_path, content_type = authorize_document_access(document_id, user, db)

    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        filename=doc.file_name,
        headers={
            "Content-Disposition": f'inline; filename="{doc.file_name}"',
            "X-Content-Type-Options": "nosniff"
        }
    )

@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Secure download endpoint with Content-Disposition attachment header.
    Accepts Bearer authentication header or ?token= query parameter.
    """
    user = resolve_document_user(document_id, token, current_user, db)
    doc, file_path, content_type = authorize_document_access(document_id, user, db)

    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        filename=doc.file_name,
        headers={
            "Content-Disposition": f'attachment; filename="{doc.file_name}"',
            "X-Content-Type-Options": "nosniff"
        }
    )

