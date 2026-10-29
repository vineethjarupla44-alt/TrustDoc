from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import require_role
from backend.app.models.models import (
    User, Application, ComplianceFinding, AssessmentSummary, ApplicationAuditEvent, Document, ReviewerDecision,
    CorrectionRequest
)
from backend.app.schemas.schemas import (
    AuditLogResponse, ReviewerOverrideRequest, ReviewerDecisionRequest, UnmaskPIIRequest,
    PrioritizedQueueItem, ReviewerQueueResponse,
    CorrectionRequestCreate, CorrectionRequestResponse, CorrectionResolveRequest,
    ApplicationHistoryResponse, ApplicationHistoryItem
)
from backend.app.api.v1.endpoints.audit import compute_event_hash

router = APIRouter(prefix="/reviewer", tags=["Reviewer Operations & Governance"])

MANDATORY_DOC_TYPES = ["LAND_DEED", "BUILDING_PLAN", "FIRE_NOC", "FACULTY_LIST"]

@router.get("/dashboard")
def get_reviewer_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["REVIEWER", "AUDITOR", "ADMIN"]))
):
    total_apps = db.query(Application).count()
    approved_apps = db.query(Application).filter(Application.status == "APPROVED").count()
    deficient_apps = db.query(Application).filter(Application.status == "DEFICIENT").count()
    flagged_apps = db.query(Application).filter(Application.status == "FLAGGED").count()
    total_docs = db.query(Document).count()

    # Recent submissions
    recent_apps = db.query(Application).order_by(Application.created_at.desc()).limit(5).all()

    return {
        "total_applications": total_apps,
        "approved_count": approved_apps,
        "deficient_count": deficient_apps,
        "flagged_tamper_count": flagged_apps,
        "total_documents_screened": total_docs,
        "recent_applications": [
            {
                "id": a.id,
                "application_number": a.application_number,
                "institution_name": a.applicant.institution_name if a.applicant else a.institution_name,
                "status": a.status,
                "created_at": a.created_at
            }
            for a in recent_apps
        ]
    }


@router.get("/queue", response_model=ReviewerQueueResponse)
def get_prioritized_review_queue(
    tier: Optional[str] = Query(None, pattern="^(CRITICAL_HIGH|MODERATE_MEDIUM|ROUTINE_CLEARANCE|ALL)$"),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["REVIEWER", "AUDITOR", "ADMIN"]))
):
    """
    Returns prioritized review queue sorted using the composite triage formula:
    Composite Score = 0.35 * Authenticity + 0.30 * Completeness + 0.35 * Compliance
    Categorizes cases into:
    - CRITICAL_HIGH: Score < 70, status FLAGGED, or critical authenticity finding.
    - MODERATE_MEDIUM: Score 70-89, status DEFICIENT, or missing mandatory documents.
    - ROUTINE_CLEARANCE: Score >= 90 with clean filings.
    """
    query = db.query(Application)

    # If logged in as applicant, only filter to applicant's applications if they exist
    if current_user and current_user.role == "APPLICANT":
        user_apps_count = db.query(Application).filter(Application.applicant_id == current_user.id).count()
        if user_apps_count > 0:
            query = query.filter(Application.applicant_id == current_user.id)

    all_eligible_count = query.count()

    if status and status != "ALL":
        query = query.filter(Application.status == status)

    applications = query.order_by(Application.created_at.desc()).all()

    queue_items = []
    critical_cnt = 0
    moderate_cnt = 0
    routine_cnt = 0

    for app in applications:
        # Match text search
        inst_name = (
            (app.applicant.institution_name if app.applicant and app.applicant.institution_name else app.institution_name)
            or "Registered Institution"
        )
        if search:
            s_lower = search.lower()
            if (s_lower not in app.application_number.lower() and
                s_lower not in inst_name.lower() and
                s_lower not in (app.program_name or "").lower()):
                continue

        # Score retrieval with None safeguards
        auth_score = float(app.summary.authenticity_score) if (app.summary and app.summary.authenticity_score is not None) else 100.0
        comp_score = float(app.summary.completeness_score) if (app.summary and app.summary.completeness_score is not None) else 0.0
        reg_score = float(app.summary.compliance_score) if (app.summary and app.summary.compliance_score is not None) else 0.0
        composite_score = float(app.summary.composite_score) if (app.summary and app.summary.composite_score is not None) else (0.35 * auth_score + 0.30 * comp_score + 0.35 * reg_score)

        # Flag counting
        auth_flags = sum(1 for f in (app.findings or []) if f.category == "AUTHENTICITY" and f.finding_status in ("FAIL", "WARNING"))
        comp_flags = sum(1 for f in (app.findings or []) if f.category == "COMPLETENESS" and f.finding_status in ("FAIL", "WARNING"))
        reg_flags = sum(1 for f in (app.findings or []) if f.category == "REGULATORY" and f.finding_status in ("FAIL", "WARNING"))

        # Missing documents
        uploaded_doc_types = {d.document_type for d in (app.documents or [])}
        missing_docs = [m for m in MANDATORY_DOC_TYPES if m not in uploaded_doc_types]

        # Determine Priority Tier
        has_critical_auth = any(f.category == "AUTHENTICITY" and f.severity == "CRITICAL" and f.finding_status == "FAIL" for f in (app.findings or []))
        
        if app.status == "FLAGGED" or composite_score < 70.0 or has_critical_auth:
            item_tier = "CRITICAL_HIGH"
            critical_cnt += 1
        elif composite_score < 90.0 or app.status == "DEFICIENT" or len(missing_docs) > 0 or comp_flags > 0:
            item_tier = "MODERATE_MEDIUM"
            moderate_cnt += 1
        else:
            item_tier = "ROUTINE_CLEARANCE"
            routine_cnt += 1

        # Check latest correction request
        latest_correction = db.query(CorrectionRequest).filter(
            CorrectionRequest.application_id == app.id
        ).order_by(CorrectionRequest.created_at.desc()).first()
        corr_status = latest_correction.status if latest_correction else None

        item = PrioritizedQueueItem(
            application_id=app.id,
            application_number=app.application_number,
            institution_name=inst_name,
            program_name=app.program_name or "General Category",
            institution_type=app.institution_type or "Private / Self-Financed",
            status=app.status or "DRAFT",
            submitted_at=app.submitted_at,
            created_at=app.created_at or datetime.now(timezone.utc),
            composite_score=round(composite_score, 1),
            authenticity_score=round(auth_score, 1),
            completeness_score=round(comp_score, 1),
            compliance_score=round(reg_score, 1),
            priority_tier=item_tier,
            authenticity_flags_count=auth_flags,
            completeness_flags_count=comp_flags,
            regulatory_flags_count=reg_flags,
            documents_count=len(app.documents or []),
            missing_documents=missing_docs,
            correction_status=corr_status
        )

        if not tier or tier == "ALL" or tier == item_tier:
            queue_items.append(item)

    # Sort queue: CRITICAL_HIGH first, then MODERATE_MEDIUM, then ROUTINE_CLEARANCE; within tier by lowest composite score
    tier_order = {"CRITICAL_HIGH": 0, "MODERATE_MEDIUM": 1, "ROUTINE_CLEARANCE": 2}
    queue_items.sort(key=lambda x: (tier_order.get(x.priority_tier, 3), x.composite_score))

    return ReviewerQueueResponse(
        total_items=len(queue_items),
        critical_count=critical_cnt,
        moderate_count=moderate_cnt,
        routine_count=routine_cnt,
        all_eligible_count=all_eligible_count,
        queue=queue_items
    )


@router.post("/applications/{application_id}/request-correction", response_model=CorrectionRequestResponse)
def request_application_correction(
    application_id: str,
    payload: CorrectionRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["REVIEWER", "AUDITOR", "ADMIN"]))
):
    """
    Issues an official Correction Request / Deficiency Notice to the applicant.
    Transitions application status to DEFICIENT and appends an immutable chained audit event.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    acting_user = current_user
    if not acting_user:
        acting_user = db.query(User).filter(User.role == "REVIEWER").first() or db.query(User).first()

    old_status = app.status
    app.status = "DEFICIENT"
    if app.summary:
        app.summary.recommendation = "DEFICIENT"

    items_json = [item.model_dump() for item in payload.requested_items]
    correction_req = CorrectionRequest(
        application_id=application_id,
        reviewer_id=acting_user.id if acting_user else "reviewer-system",
        status="OPEN",
        requested_items=items_json,
        instructions=payload.instructions,
        deadline_days=payload.deadline_days
    )
    db.add(correction_req)

    # Chained Audit Log
    last_event = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == application_id
    ).order_by(ApplicationAuditEvent.timestamp.desc()).first()
    prev_hash = last_event.event_hash if last_event else None

    audit_log = ApplicationAuditEvent(
        application_id=application_id,
        actor_id=acting_user.id if acting_user else None,
        actor_role=acting_user.role if acting_user else "REVIEWER",
        action="CORRECTION_REQUESTED",
        ip_address="127.0.0.1",
        diff_payload={
            "old_status": old_status,
            "new_status": "DEFICIENT",
            "requested_items_count": len(items_json),
            "deadline_days": payload.deadline_days,
            "reviewer_name": acting_user.full_name if acting_user else "Senior Scrutiny Officer",
            "instructions": payload.instructions
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
    db.refresh(correction_req)

    return CorrectionRequestResponse(
        id=correction_req.id,
        application_id=correction_req.application_id,
        reviewer_id=correction_req.reviewer_id,
        reviewer_name=acting_user.full_name if acting_user else "Senior Scrutiny Officer",
        status=correction_req.status,
        requested_items=correction_req.requested_items,
        instructions=correction_req.instructions,
        deadline_days=correction_req.deadline_days,
        applicant_response_notes=correction_req.applicant_response_notes,
        created_at=correction_req.created_at,
        resolved_at=correction_req.resolved_at
    )


@router.post("/applications/{application_id}/resolve-correction")
def resolve_correction_request(
    application_id: str,
    payload: CorrectionResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["REVIEWER", "AUDITOR", "ADMIN"]))
):
    """
    Accepts or rejects an applicant's resubmitted remediation.
    """
    latest_req = db.query(CorrectionRequest).filter(
        CorrectionRequest.application_id == application_id
    ).order_by(CorrectionRequest.created_at.desc()).first()

    if not latest_req:
        raise HTTPException(status_code=404, detail="No active correction request found for this application.")

    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    acting_user = current_user
    if not acting_user:
        acting_user = db.query(User).filter(User.role == "REVIEWER").first() or db.query(User).first()

    if payload.action == "ACCEPT":
        latest_req.status = "ACCEPTED"
        latest_req.resolved_at = datetime.now(timezone.utc)
        app.status = "PROCESSING"
        audit_action = "CORRECTION_ACCEPTED"
    else:
        latest_req.status = "REJECTED"
        app.status = "DEFICIENT"
        audit_action = "CORRECTION_REJECTED"

    # Chained Audit event
    last_event = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == application_id
    ).order_by(ApplicationAuditEvent.timestamp.desc()).first()
    prev_hash = last_event.event_hash if last_event else None

    audit_log = ApplicationAuditEvent(
        application_id=application_id,
        actor_id=acting_user.id if acting_user else None,
        actor_role=acting_user.role if acting_user else "REVIEWER",
        action=audit_action,
        ip_address="127.0.0.1",
        diff_payload={
            "correction_id": latest_req.id,
            "decision": payload.action,
            "remarks": payload.reviewer_remarks,
            "reviewer_name": acting_user.full_name if acting_user else "Senior Scrutiny Officer"
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

    return {
        "success": True,
        "action": payload.action,
        "correction_status": latest_req.status,
        "application_status": app.status,
        "message": f"Correction request resolution recorded as {latest_req.status}."
    }


@router.get("/applications/{application_id}/history", response_model=ApplicationHistoryResponse)
def get_application_history_timeline(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["REVIEWER", "AUDITOR", "ADMIN"]))
):
    """
    Returns full chronological application lifecycle history:
    Submissions, Document Uploads, Validation Runs, Correction Requests, Overrides, Decisions, PII Unmasks, Reports.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    events = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == application_id
    ).order_by(ApplicationAuditEvent.timestamp.asc()).all()

    history_items = []
    title_map = {
        "DOCUMENT_UPLOAD": "Uploaded Document Filing",
        "PII_UNMASK": "Authorized PII Unmasking",
        "REVIEWER_OVERRIDE": "Reviewer Scrutiny Override",
        "CORRECTION_REQUESTED": "Correction Notice Issued",
        "CORRECTION_ACCEPTED": "Remediation Accepted by Reviewer",
        "CORRECTION_REJECTED": "Remediation Rejected by Reviewer",
        "FINAL_DECISION_RECORDED": "Official Statutory Determination Recorded",
        "REPORT_DOWNLOAD": "Compliance PDF Dossier Downloaded",
        "VALIDATION_ENGINE_RUN": "Deterministic Compliance Engine Executed"
    }

    for ev in events:
        actor_name = ev.actor.full_name if ev.actor else (ev.diff_payload.get("reviewer_name") if ev.diff_payload else "System Core")
        history_items.append(
            ApplicationHistoryItem(
                event_id=ev.id,
                event_type=ev.action,
                title=title_map.get(ev.action, ev.action.replace("_", " ").title()),
                actor_name=actor_name,
                actor_role=ev.actor_role or "SYSTEM",
                timestamp=ev.timestamp,
                diff_summary=ev.diff_payload or {},
                sha256_hash=ev.event_hash
            )
        )

    return ApplicationHistoryResponse(
        application_id=app.id,
        application_number=app.application_number,
        events=history_items
    )


@router.post("/applications/{application_id}/override")
def override_compliance_finding(
    application_id: str,
    override_in: ReviewerOverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["REVIEWER", "AUDITOR", "ADMIN"]))
):
    """
    Overrides or waives a compliance finding.
    PRESERVES the original finding_status (e.g. FAIL or WARNING) and initial evidence,
    recording reviewer justification and new lifecycle status (WAIVED or RESOLVED) in an immutable audit trail.
    """
    finding = db.query(ComplianceFinding).filter(
        ComplianceFinding.id == override_in.finding_id,
        ComplianceFinding.application_id == application_id
    ).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found.")

    acting_user = current_user
    if not acting_user:
        acting_user = db.query(User).filter(User.role == "REVIEWER").first() or db.query(User).first()

    old_severity = finding.severity
    old_finding_status = finding.finding_status
    old_lifecycle_status = finding.status

    # Set reviewer override fields without mutating original finding_status or original evidence
    finding.status = override_in.status
    finding.overridden_by_id = acting_user.id if acting_user else "reviewer-override"
    finding.override_reason = override_in.justification

    if override_in.status == "RESOLVED":
        finding.resolved_by_applicant = True
        finding.severity = "INFO"
    elif override_in.status == "WAIVED":
        finding.severity = "INFO"
        if "[WAIVED BY REVIEWER" not in finding.description:
            finding.description += f" [WAIVED BY REVIEWER: {override_in.justification}]"

    # Chained Audit event
    last_event = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == application_id
    ).order_by(ApplicationAuditEvent.timestamp.desc()).first()
    prev_hash = last_event.event_hash if last_event else None

    audit_log = ApplicationAuditEvent(
        application_id=application_id,
        actor_id=acting_user.id if acting_user else None,
        actor_role=acting_user.role if acting_user else "REVIEWER",
        action="REVIEWER_OVERRIDE",
        ip_address="127.0.0.1",
        diff_payload={
            "finding_id": finding.id,
            "rule_code": finding.rule_code,
            "original_finding_status": old_finding_status,
            "old_lifecycle_status": old_lifecycle_status,
            "old_severity": old_severity,
            "new_status": override_in.status,
            "justification": override_in.justification,
            "reviewer": acting_user.full_name if acting_user else "Senior Scrutiny Officer"
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

    return {
        "success": True,
        "message": "Finding override recorded in audit trail. Original finding preserved.",
        "finding_id": finding.id,
        "original_finding_status": finding.finding_status,
        "status": finding.status
    }


@router.post("/applications/{application_id}/unmask-pii")
def request_unmask_pii(
    application_id: str,
    unmask_in: UnmaskPIIRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["REVIEWER", "AUDITOR", "ADMIN"]))
):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    acting_user = current_user
    if not acting_user:
        acting_user = db.query(User).filter(User.role == "REVIEWER").first() or db.query(User).first()

    # Record mandatory unmasking action in immutable audit log
    last_event = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == application_id
    ).order_by(ApplicationAuditEvent.timestamp.desc()).first()
    prev_hash = last_event.event_hash if last_event else None

    audit_log = ApplicationAuditEvent(
        application_id=application_id,
        actor_id=acting_user.id if acting_user else None,
        actor_role=acting_user.role if acting_user else "REVIEWER",
        action="PII_UNMASK",
        ip_address="127.0.0.1",
        diff_payload={
            "reason": unmask_in.reason,
            "reviewer_email": acting_user.email if acting_user else "reviewer@aicte.gov.in",
            "authorized_role": acting_user.role if acting_user else "REVIEWER",
            "timestamp": datetime.now(timezone.utc).isoformat()
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

    return {
        "success": True,
        "message": "PII unmasking authorized and recorded in immutable audit log.",
        "can_unmask": True
    }


@router.get("/applications/{application_id}/audit-logs", response_model=list[AuditLogResponse])
def get_audit_logs(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["REVIEWER", "AUDITOR", "ADMIN"]))
):
    logs = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == application_id
    ).order_by(ApplicationAuditEvent.timestamp.desc()).all()
    return logs


@router.post("/applications/{application_id}/decision")
def record_application_decision(
    application_id: str,
    decision_in: ReviewerDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["REVIEWER", "AUDITOR", "ADMIN"]))
):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    acting_user = current_user
    if not acting_user:
        acting_user = db.query(User).filter(User.role == "REVIEWER").first() or db.query(User).first()

    old_status = app.status
    app.status = decision_in.decision

    # Update summary recommendation if exists
    if app.summary:
        if decision_in.decision == "APPROVED":
            app.summary.recommendation = "ELIGIBLE"
        elif decision_in.decision == "DEFICIENT":
            app.summary.recommendation = "DEFICIENT"
        elif decision_in.decision == "FLAGGED":
            app.summary.recommendation = "REJECTED"

    # Persist official ReviewerDecision record with digital seal hash
    notes = decision_in.statutory_notes or decision_in.remarks or f"Statutory determination: {decision_in.decision}"
    
    actor_id_str = acting_user.id if acting_user else "reviewer-system"
    actor_name_str = acting_user.full_name if acting_user else "Senior Scrutiny Officer"
    actor_email_str = acting_user.email if acting_user else "reviewer@aicte.gov.in"
    actor_role_str = acting_user.role if acting_user else "REVIEWER"

    # Compute digital seal hash
    seal_content = f"{app.id}:{actor_id_str}:{decision_in.decision}:{datetime.now(timezone.utc).isoformat()}"
    import hashlib
    seal_hash = hashlib.sha256(seal_content.encode("utf-8")).hexdigest()

    decision_record = ReviewerDecision(
        application_id=application_id,
        reviewer_id=actor_id_str,
        decision=decision_in.decision,
        statutory_notes=notes,
        deficiencies_json=decision_in.deficiencies,
        stipulated_conditions_json=decision_in.conditions,
        ip_address="127.0.0.1",
        digital_seal_hash=seal_hash
    )
    db.add(decision_record)

    # Chained Audit Log
    last_event = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == application_id
    ).order_by(ApplicationAuditEvent.timestamp.desc()).first()
    prev_hash = last_event.event_hash if last_event else None

    audit_log = ApplicationAuditEvent(
        application_id=application_id,
        actor_id=actor_id_str if acting_user else None,
        actor_role=actor_role_str,
        action="FINAL_DECISION_RECORDED",
        ip_address="127.0.0.1",
        diff_payload={
            "old_status": old_status,
            "new_status": decision_in.decision,
            "remarks": notes,
            "digital_seal_hash": seal_hash,
            "reviewer_name": actor_name_str,
            "reviewer_email": actor_email_str,
            "timestamp": datetime.now(timezone.utc).isoformat()
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

    return {
        "success": True,
        "application_id": app.id,
        "status": app.status,
        "digital_seal_hash": seal_hash,
        "message": f"Application status updated to {app.status} and decision logged with digital seal."
    }
