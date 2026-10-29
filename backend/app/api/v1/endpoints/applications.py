import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.core.masking import mask_dict_fields
from backend.app.models.models import User, Application, Document, ComplianceFinding, AssessmentSummary, ApplicationAuditEvent
from backend.app.schemas.schemas import ApplicationCreate, ApplicationResponse, ApplicationDetailResponse
from backend.app.api.v1.endpoints.audit import compute_event_hash

router = APIRouter(prefix="/applications", tags=["Applications"])

@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(
    app_in: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app_num = f"APP-2026-{uuid.uuid4().hex[:6].upper()}"
    app = Application(
        applicant_id=current_user.id,
        application_number=app_num,
        institution_name=app_in.institution_name,
        program_name=app_in.program_name,
        institution_type=app_in.institution_type,
        state=app_in.state,
        district=app_in.district,
        academic_year=app_in.academic_year,
        status="DRAFT"
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app

@router.get("", response_model=list[ApplicationResponse])
def list_applications(
    status: Optional[str] = Query(None, description="Filter by status (e.g. APPROVED, DEFICIENT, FLAGGED)"),
    search: Optional[str] = Query(None, description="Search by application number or institution name"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Reviewers & Auditors see all applications; Applicants see their own
    query = db.query(Application)
    if current_user.role not in ("REVIEWER", "AUDITOR", "ADMIN"):
        query = query.filter(Application.applicant_id == current_user.id)

    if status and status.upper() != "ALL":
        query = query.filter(Application.status == status.upper())

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Application.application_number.ilike(search_filter)) |
            (Application.institution_name.ilike(search_filter))
        )

    apps = query.order_by(Application.created_at.desc()).offset(offset).limit(limit).all()
    return apps

@router.get("/{application_id}", response_model=ApplicationDetailResponse)
def get_application_detail(
    application_id: str,
    unmask: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    # Only allow unmask if reviewer or auditor
    if unmask and current_user.role not in ("REVIEWER", "AUDITOR", "ADMIN"):
        unmask = False

    return app

@router.post("/{application_id}/submit", response_model=ApplicationResponse)
def submit_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    app.status = "SUBMITTED"
    app.submitted_at = datetime.now(timezone.utc)
    
    # Chained Audit event
    last_event = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == application_id
    ).order_by(ApplicationAuditEvent.timestamp.desc()).first()
    prev_hash = last_event.event_hash if last_event else None

    audit_log = ApplicationAuditEvent(
        application_id=app.id,
        actor_id=current_user.id,
        actor_role=current_user.role,
        action="APPLICATION_SUBMIT",
        ip_address="127.0.0.1",
        diff_payload={"status": "SUBMITTED"},
        previous_event_hash=prev_hash
    )
    db.add(audit_log)
    db.flush()
    audit_log.event_hash = compute_event_hash(
        audit_log.id, audit_log.application_id, audit_log.action, audit_log.actor_id,
        audit_log.timestamp.isoformat(), audit_log.previous_event_hash
    )

    db.commit()
    db.refresh(app)
    return app

