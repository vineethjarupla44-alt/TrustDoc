import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.config import settings
from backend.app.models.models import (
    User, Application, ComplianceFinding, AssessmentSummary, ApplicationAuditEvent,
    ReportMetadata, Document, ExtractedField, AuthenticityFinding, ReviewerDecision,
    RegulatorySource
)
from backend.app.schemas.schemas import ReportMetadataResponse, ReportAccessTokenResponse
from backend.app.core.security import (
    get_current_user, get_current_user_optional, decode_access_token,
    generate_report_access_token, verify_report_access_token
)
from backend.app.services.pdf_report import PDFReportGenerator
from backend.app.api.v1.endpoints.audit import compute_event_hash

router = APIRouter(prefix="/reports", tags=["Reports & Export"])


def find_application_or_404(application_id: str, db: Session) -> Application:
    """Finds an application by either its UUID or unique application_number."""
    app = db.query(Application).filter(
        (Application.id == application_id) | (Application.application_number == application_id)
    ).first()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application '{application_id}' not found."
        )
    return app


def resolve_report_user(
    application_id: str,
    token: Optional[str],
    current_user: Optional[User],
    db: Session,
    app_obj: Optional[Application] = None
) -> User:
    """
    Resolves the authenticated User from either:
    1. HTTP Bearer authorization header (current_user from get_current_user_optional)
    2. Query parameter 'token':
       - HMAC report access token (scoped to application_id with scope='report_access')
       - Standard JWT access token (Bearer token passed in query parameter for direct browser preview)
    """
    user = current_user
    if not user and token:
        # Check HMAC report-scoped access token first
        app_candidates = [application_id]
        if app_obj:
            app_candidates.extend([app_obj.id, app_obj.application_number])
        
        for candidate_id in set(app_candidates):
            if candidate_id:
                rep_payload = verify_report_access_token(token, candidate_id)
                if rep_payload and rep_payload.get("sub"):
                    user = db.query(User).filter(User.id == rep_payload["sub"]).first()
                    if user:
                        break

        # If not HMAC report token, check standard JWT access token
        if not user:
            jwt_payload = decode_access_token(token)
            if jwt_payload and jwt_payload.get("sub"):
                sub_val = jwt_payload["sub"]
                user = db.query(User).filter((User.email == sub_val) | (User.id == sub_val)).first()

    if not user:
        if token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or invalid report access token. Please re-authenticate."
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication or valid access token required.",
            headers={"WWW-Authenticate": "Bearer"}
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


def authorize_report_access(app: Application, user: User) -> None:
    """
    Validates RBAC for application compliance dossier access.
    - Reviewer, Security Officer, Auditor, Admin: granted cross-institution access.
    - Applicant: granted access only to own institutional applications (or demo benchmark cases).
    """
    elevated_roles = {"REVIEWER", "SECURITY_OFFICER", "AUDITOR", "ADMIN"}
    if user.role in elevated_roles:
        return

    if user.role == "APPLICANT":
        is_demo_case = bool(app.application_number and app.application_number.startswith("APP-2026-CASE-"))
        if app.applicant_id != user.id and not is_demo_case:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to view official reports for another institution."
            )
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Access denied: Role '{user.role}' is not authorized to access compliance reports."
    )


@router.post("/{application_id}/generate", response_model=ReportMetadataResponse)
def generate_report_dossier(
    application_id: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Generates the official compliance PDF dossier and stores report metadata."""
    app = find_application_or_404(application_id, db)
    user = resolve_report_user(app.id, token, current_user, db, app_obj=app)
    authorize_report_access(app, user)
    app_id = app.id

    summary = app.summary

    # Assemble documents and forensics
    documents_list = []
    extracted_uncertainties = []
    for doc in app.documents:
        forensics_dict = {}
        if doc.forensics:
            forensics_dict = {
                "ela_anomaly_score": doc.forensics.ela_anomaly_score,
                "metadata_mismatch_flag": doc.forensics.metadata_mismatch_flag,
                "qr_detected": doc.forensics.qr_detected,
                "digital_signature_present": doc.forensics.digital_signature_present,
                "risk_level": doc.forensics.risk_level,
                "heatmap_generated": doc.forensics.heatmap_generated,
                "heatmap_path": doc.forensics.heatmap_path,
            }
        documents_list.append({
            "document_type": doc.document_type,
            "file_name": doc.file_name,
            "sha256_hash": doc.sha256_hash,
            "extraction_status": doc.extraction_status,
            "forensics": forensics_dict
        })

        for field in doc.extracted_fields:
            if (field.confidence_score is not None and field.confidence_score < 70.0) or field.state in ("EXTRACTION_FAILED", "NEEDS_MANUAL_REVIEW"):
                extracted_uncertainties.append({
                    "field_key": field.label or field.field_key,
                    "state": field.state,
                    "value": field.field_value_normalized or field.field_value_raw or "Unextracted",
                    "confidence": field.confidence_score or 0.0
                })

    # Assemble findings
    findings = [
        {
            "category": f.category,
            "severity": f.severity,
            "rule_code": f.rule_code,
            "title": f.title,
            "description": f.description,
            "evidence_quote": f.evidence_quote,
            "suggested_remediation": f.suggested_remediation,
            "status": f.status,
            "finding_status": f.finding_status,
            "source_field_ref": f.source_field_ref
        }
        for f in app.findings
    ]

    # Latest reviewer decision
    latest_decision = app.decisions[-1] if app.decisions else None
    decision_dict = {}
    if latest_decision:
        decision_dict = {
            "decision": latest_decision.decision,
            "statutory_notes": latest_decision.statutory_notes,
            "recorded_at": latest_decision.recorded_at.isoformat() if latest_decision.recorded_at else None,
            "ip_address": latest_decision.ip_address,
            "digital_seal_hash": latest_decision.digital_seal_hash
        }

    report_payload = {
        "application_number": app.application_number,
        "institution_name": app.applicant.institution_name if app.applicant and app.applicant.institution_name else app.institution_name,
        "program_name": app.program_name,
        "institution_type": app.institution_type,
        "state": app.state,
        "evaluation_date": datetime.now(timezone.utc).strftime("%d-%b-%Y %H:%M UTC"),
        "summary": {
            "authenticity_score": summary.authenticity_score if summary else 100.0,
            "completeness_score": summary.completeness_score if summary else 0.0,
            "compliance_score": summary.compliance_score if summary else 0.0,
            "composite_score": summary.composite_score if summary else 0.0,
            "recommendation": summary.recommendation if summary else "PROCESSING"
        },
        "documents": documents_list,
        "extracted_uncertainties": extracted_uncertainties,
        "findings": findings,
        "reviewer_decision": decision_dict
    }

    pdf_bytes = PDFReportGenerator.generate_application_report(report_payload)
    sha256 = hashlib.sha256(pdf_bytes).hexdigest()

    # Save PDF to disk
    report_dir = settings.UPLOAD_DIR / app_id
    report_dir.mkdir(parents=True, exist_ok=True)
    report_file_path = report_dir / f"Dossier_{app.application_number}.pdf"
    with open(report_file_path, "wb") as f:
        f.write(pdf_bytes)

    # Persist or update ReportMetadata
    meta = db.query(ReportMetadata).filter(ReportMetadata.application_id == app_id).first()
    if not meta:
        meta = ReportMetadata(
            application_id=app_id,
            report_type="PDF_SUMMARY",
            file_path=str(report_file_path),
            sha256_hash=sha256,
            file_size_bytes=len(pdf_bytes),
            generated_by_id=user.id if user else None,
            status="READY",
            download_count=1
        )
        db.add(meta)
    else:
        meta.sha256_hash = sha256
        meta.file_size_bytes = len(pdf_bytes)
        meta.file_path = str(report_file_path)
        meta.download_count += 1

    # Chained Audit event
    last_event = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == app_id
    ).order_by(ApplicationAuditEvent.timestamp.desc()).first()
    prev_hash = last_event.event_hash if last_event else None

    audit_log = ApplicationAuditEvent(
        application_id=app_id,
        actor_id=user.id if user else None,
        actor_role=user.role if user else "SYSTEM",
        action="REPORT_GENERATE",
        ip_address="127.0.0.1",
        diff_payload={"report_type": "PDF", "sha256": sha256, "file_size": len(pdf_bytes)},
        previous_event_hash=prev_hash
    )
    db.add(audit_log)
    db.flush()
    audit_log.event_hash = compute_event_hash(
        audit_log.id, audit_log.application_id, audit_log.action, audit_log.actor_id,
        audit_log.timestamp.isoformat(), audit_log.previous_event_hash
    )

    db.commit()
    db.refresh(meta)
    return meta


@router.post("/{application_id}/token", response_model=ReportAccessTokenResponse)
def create_report_token(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates a short-lived (15 minutes) HMAC-signed access token for secure report PDF preview/download."""
    app = find_application_or_404(application_id, db)
    authorize_report_access(app, current_user)
    token = generate_report_access_token(app.id, current_user.id, expires_in_seconds=900)
    return {
        "token": token,
        "application_id": app.id,
        "application_number": app.application_number,
        "expires_in_seconds": 900,
        "pdf_url": f"/api/v1/reports/{app.id}/pdf?token={token}&mode=inline",
        "download_url": f"/api/v1/reports/{app.id}/pdf?token={token}&mode=attachment"
    }


@router.get("/{application_id}/pdf")
def download_pdf_report(
    application_id: str,
    token: Optional[str] = Query(None),
    mode: str = Query("attachment", pattern="^(inline|attachment)$"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Returns the official statutory PDF dossier.
    Authenticates via either HTTP Bearer header or query parameter 'token' (HMAC or JWT).
    Enforces RBAC: Reviewers/Auditors/Admins can access any dossier; Applicants can access only their own.
    """
    app = find_application_or_404(application_id, db)
    user = resolve_report_user(app.id, token, current_user, db, app_obj=app)
    authorize_report_access(app, user)

    meta = db.query(ReportMetadata).filter(ReportMetadata.application_id == app.id).first()
    if not meta or not Path(meta.file_path).exists():
        meta = generate_report_dossier(app.id, token=token, db=db, current_user=user)
    else:
        meta.download_count += 1
        db.commit()

    if not Path(meta.file_path).exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Report dossier could not be generated on disk."
        )

    with open(meta.file_path, "rb") as f:
        pdf_bytes = f.read()

    filename = f"TrustDoc_Dossier_{app.application_number}.pdf"
    content_disposition = f'{mode}; filename="{filename}"'

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": content_disposition,
            "X-Report-SHA256": meta.sha256_hash or "",
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/{application_id}/metadata", response_model=ReportMetadataResponse)
def get_report_metadata(
    application_id: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    app = find_application_or_404(application_id, db)
    user = resolve_report_user(app.id, token, current_user, db, app_obj=app)
    authorize_report_access(app, user)
    meta = db.query(ReportMetadata).filter(ReportMetadata.application_id == app.id).first()
    if not meta:
        raise HTTPException(status_code=404, detail="No report generated yet for this application.")
    return meta
