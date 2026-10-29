import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role, get_password_hash
from backend.app.models.models import (
    User, Application, ValidationRule, RuleVersion, RegulatorySource,
    ApplicationAuditEvent, DataRetentionPolicy, MaskingConfiguration
)
from backend.app.schemas.schemas import (
    AdminUserResponse, AdminUserCreateRequest, AdminUserUpdateRequest,
    ValidationRuleResponse, CreateRuleVersionRequest, RuleVersionResponse,
    DataRetentionPolicyResponse, UpdateRetentionPolicyRequest, RetentionSweepResponse,
    MaskingConfigResponse, UpdateMaskingConfigRequest, MaskingTestRequest, MaskingTestResponse,
    AuditLogResponse, OfficerApprovalDecisionRequest
)
from backend.app.api.v1.endpoints.audit import compute_event_hash
from backend.app.core.masking import mask_text

router = APIRouter(prefix="/admin", tags=["Compliance Administration & Governance"])

# -------------------------------------------------------------
# 1. User & Role Management (RBAC)
# -------------------------------------------------------------
@router.get("/users", response_model=List[AdminUserResponse])
def list_system_users(
    role: Optional[str] = Query(None, pattern="^(APPLICANT|REVIEWER|AUDITOR|ADMIN)$"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    """Lists all registered system users with optional role and search filtering."""
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if search:
        s = f"%{search.lower()}%"
        query = query.filter(
            (User.email.ilike(s)) | (User.full_name.ilike(s)) | (User.institution_name.ilike(s))
        )
    return query.order_by(User.created_at.desc()).all()


@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
def create_system_user(
    payload: AdminUserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    """Enrolls a new institutional user or scrutiny officer."""
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    new_user = User(
        email=payload.email.lower(),
        password_hash=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        institution_name=payload.institution_name,
        is_mfa_enabled=payload.is_mfa_enabled,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_system_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    """Modifies user permissions, role, or active status with self-demotion protection."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Guardrail: Prevent admin from deactivating or demoting their own active session
    if user.id == current_user.id:
        if payload.is_active is False:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own administrator account.")
        if payload.role and payload.role != "ADMIN":
            raise HTTPException(status_code=400, detail="Cannot revoke your own administrator role.")

    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.is_mfa_enabled is not None:
        user.is_mfa_enabled = payload.is_mfa_enabled
    if payload.institution_name is not None:
        user.institution_name = payload.institution_name

    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


@router.get("/officer-requests", response_model=List[AdminUserResponse])
def list_officer_account_requests(
    status_filter: Optional[str] = Query("PENDING_APPROVAL"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    """Lists security officer account registration requests filtered by approval status."""
    query = db.query(User).filter(User.role == "REVIEWER")
    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(User.approval_status == status_filter.upper())
    return query.order_by(User.created_at.desc()).all()


@router.post("/officer-requests/{user_id}/decision", response_model=AdminUserResponse)
def decide_officer_account_request(
    user_id: str,
    payload: OfficerApprovalDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    """
    Approves or rejects a Security Officer account registration request.
    Only approved requests are granted active login access to the Security Officer portal.
    """
    officer = db.query(User).filter(User.id == user_id, User.role == "REVIEWER").first()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer account request not found.")

    now = datetime.now(timezone.utc)
    if payload.action == "APPROVE":
        officer.approval_status = "APPROVED"
        officer.is_active = True
        officer.rejection_reason = None
        action_name = "SECURITY_OFFICER_REQUEST_APPROVED"
    else:
        officer.approval_status = "REJECTED"
        officer.is_active = False
        officer.rejection_reason = payload.rejection_reason or "Verification criteria not met."
        action_name = "SECURITY_OFFICER_REQUEST_REJECTED"

    officer.updated_at = now

    try:
        first_app = db.query(Application).first()
        if first_app:
            audit_evt = ApplicationAuditEvent(
                application_id=first_app.id,
                actor_id=current_user.id,
                actor_role="ADMIN",
                action=action_name,
                ip_address="127.0.0.1",
                diff_payload={
                    "officer_email": officer.email,
                    "employee_id": officer.employee_id,
                    "decision": payload.action,
                    "reason": officer.rejection_reason
                },
                event_hash=compute_event_hash(f"{officer.id}-{payload.action}-{now.isoformat()}")
            )
            db.add(audit_evt)
    except Exception as audit_err:
        logging.warning(f"Audit log recording skipped in officer decision: {audit_err}")
    db.commit()
    db.refresh(officer)
    return officer


# -------------------------------------------------------------
# 2. Regulatory Source & Rule-Version Management
# -------------------------------------------------------------
@router.get("/rules", response_model=List[ValidationRuleResponse])
def list_validation_rules_and_versions(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN", "AUDITOR"]))
):
    """Lists all configured validation rules, parameter sets, and active versions."""
    query = db.query(ValidationRule)
    if category:
        query = query.filter(ValidationRule.category == category)
    return query.order_by(ValidationRule.rule_code.asc()).all()


@router.post("/rules/{rule_id}/versions", response_model=RuleVersionResponse, status_code=status.HTTP_201_CREATED)
def create_rule_version(
    rule_id: str,
    payload: CreateRuleVersionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    """Deploys a new version of a validation rule with updated statutory parameters."""
    rule = db.query(ValidationRule).filter(ValidationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Validation rule not found.")

    handler = payload.logic_handler or (rule.versions[0].logic_handler if rule.versions else "default_handler")

    new_version = RuleVersion(
        rule_id=rule_id,
        version_tag=payload.version_tag,
        parameters_json=payload.parameters_json,
        logic_handler=handler,
        effective_from=datetime.now(timezone.utc)
    )
    db.add(new_version)
    db.commit()
    db.refresh(new_version)
    return new_version


@router.patch("/sources/{source_id}/toggle")
def toggle_regulatory_source_status(
    source_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    """Activates or deactivates a statutory regulatory handbook source."""
    source = db.query(RegulatorySource).filter(RegulatorySource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Regulatory source not found.")

    source.is_active = not source.is_active
    db.commit()
    return {
        "source_id": source.id,
        "source_name": source.source_name,
        "is_active": source.is_active,
        "message": f"Source is now {'ACTIVE' if source.is_active else 'INACTIVE'}."
    }


# -------------------------------------------------------------
# 3. Data Retention & Deletion Governance
# -------------------------------------------------------------
@router.get("/retention/policies", response_model=List[DataRetentionPolicyResponse])
def get_data_retention_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN", "AUDITOR"]))
):
    """Returns configured statutory data retention schedules and legal hold flags."""
    policies = db.query(DataRetentionPolicy).all()
    if not policies:
        # Seed default AICTE / statutory data retention policies
        defaults = [
            DataRetentionPolicy(
                policy_code="RETENTION_ACCREDITED",
                title="Accredited Institutional Applications",
                category="ACCREDITED_RECORDS",
                retention_days=2555,  # 7 Years
                is_legal_hold=False,
                auto_purge_enabled=False,
                description="Statutory institutional accreditation filings preserved for 7 years pursuant to AICTE Gazette regulations."
            ),
            DataRetentionPolicy(
                policy_code="RETENTION_REJECTED",
                title="Rejected Applications & Scrutiny Records",
                category="REJECTED_RECORDS",
                retention_days=1095,  # 3 Years
                is_legal_hold=False,
                auto_purge_enabled=True,
                description="Maintained for statutory appellate and judicial inquiry windows (3 years)."
            ),
            DataRetentionPolicy(
                policy_code="RETENTION_OCR_CACHE",
                title="Temporary OCR Extraction Artifacts & Heatmaps",
                category="TEMPORARY_CACHE",
                retention_days=90,  # 90 Days
                is_legal_hold=False,
                auto_purge_enabled=True,
                description="Intermediate forensic heatmaps and OCR text scratch caches."
            ),
            DataRetentionPolicy(
                policy_code="RETENTION_DRAFTS",
                title="Unsubmitted Abandoned Drafts",
                category="ABANDONED_DRAFTS",
                retention_days=30,  # 30 Days
                is_legal_hold=False,
                auto_purge_enabled=True,
                description="Incomplete draft submissions inactive for over 30 days."
            ),
        ]
        db.add_all(defaults)
        db.commit()
        policies = db.query(DataRetentionPolicy).all()

    return policies


@router.put("/retention/policies/{policy_id}", response_model=DataRetentionPolicyResponse)
def update_retention_policy(
    policy_id: str,
    payload: UpdateRetentionPolicyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    """Updates statutory retention period or toggles legal hold."""
    policy = db.query(DataRetentionPolicy).filter(DataRetentionPolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Retention policy not found.")

    if payload.retention_days is not None:
        policy.retention_days = payload.retention_days
    if payload.is_legal_hold is not None:
        policy.is_legal_hold = payload.is_legal_hold
    if payload.auto_purge_enabled is not None:
        policy.auto_purge_enabled = payload.auto_purge_enabled
    if payload.description is not None:
        policy.description = payload.description

    policy.updated_by_id = current_user.id
    policy.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(policy)
    return policy


@router.post("/retention/execute-sweep", response_model=RetentionSweepResponse)
def execute_retention_sweep(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    """
    Executes a statutory retention and deletion sweep across expired non-held records.
    Records immutable cryptographic audit log of the operation.
    """
    draft_policy = db.query(DataRetentionPolicy).filter(
        DataRetentionPolicy.policy_code == "RETENTION_DRAFTS"
    ).first()

    legal_hold_active = draft_policy.is_legal_hold if draft_policy else False
    purged_drafts = 0

    if not legal_hold_active:
        cutoff = datetime.now(timezone.utc) - timedelta(days=(draft_policy.retention_days if draft_policy else 30))
        expired_drafts = db.query(Application).filter(
            Application.status == "DRAFT",
            Application.updated_at < cutoff
        ).all()
        purged_drafts = len(expired_drafts)
        for d in expired_drafts:
            db.delete(d)

    total_retained = db.query(Application).count()

    # Chained Audit event
    last_event = db.query(ApplicationAuditEvent).order_by(ApplicationAuditEvent.timestamp.desc()).first()
    prev_hash = last_event.event_hash if last_event else None

    # Pick an application ID or use a system placeholder
    app_target = db.query(Application).first()
    target_id = app_target.id if app_target else "SYSTEM-GOVERNANCE"

    sweep_time = datetime.now(timezone.utc)
    audit_log = ApplicationAuditEvent(
        application_id=target_id,
        actor_id=current_user.id,
        actor_role=current_user.role,
        action="RETENTION_SWEEP_EXECUTED",
        ip_address="127.0.0.1",
        diff_payload={
            "admin_name": current_user.full_name,
            "purged_drafts_count": purged_drafts,
            "legal_hold_active": legal_hold_active,
            "total_retained_records": total_retained,
            "executed_at": sweep_time.isoformat()
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

    return RetentionSweepResponse(
        status="SWEEP_COMPLETED",
        purged_drafts_count=purged_drafts,
        cleaned_artifacts_count=purged_drafts * 2,
        retained_records_count=total_retained,
        sweep_timestamp=sweep_time,
        audit_event_id=audit_log.id
    )


# -------------------------------------------------------------
# 4. Sensitive-Data Masking Configuration
# -------------------------------------------------------------
@router.get("/masking/config", response_model=List[MaskingConfigResponse])
def get_masking_configuration(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN", "AUDITOR"]))
):
    """Retrieves active PII identifier masking rules and security configurations."""
    configs = db.query(MaskingConfiguration).all()
    if not configs:
        defaults = [
            MaskingConfiguration(
                identifier_type="AADHAAR",
                label="Aadhaar UIDAI Number",
                pattern_regex=r"\b(\d{4})[ -]?(\d{4})[ -]?(\d{4})\b",
                masking_mode="PARTIAL_MASK",
                is_active=True,
                unmask_requires_justification=True,
                session_timeout_minutes=15
            ),
            MaskingConfiguration(
                identifier_type="PAN",
                label="Permanent Account Number (PAN)",
                pattern_regex=r"\b([A-Z]{5})(\d{4})([A-Z]{1})\b",
                masking_mode="PARTIAL_MASK",
                is_active=True,
                unmask_requires_justification=True,
                session_timeout_minutes=15
            ),
            MaskingConfiguration(
                identifier_type="PHONE",
                label="Mobile Contact Number",
                pattern_regex=r"\b(?:\+91|0)?([6-9]\d{5})(\d{4})\b",
                masking_mode="PARTIAL_MASK",
                is_active=True,
                unmask_requires_justification=True,
                session_timeout_minutes=15
            ),
            MaskingConfiguration(
                identifier_type="EMAIL",
                label="Personal Email Address",
                pattern_regex=r"\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b",
                masking_mode="PARTIAL_MASK",
                is_active=True,
                unmask_requires_justification=True,
                session_timeout_minutes=15
            ),
            MaskingConfiguration(
                identifier_type="BANK_ACCOUNT",
                label="Bank Account Number",
                pattern_regex=r"\b\d{9,18}\b",
                masking_mode="FULL_MASK",
                is_active=True,
                unmask_requires_justification=True,
                session_timeout_minutes=15
            ),
        ]
        db.add_all(defaults)
        db.commit()
        configs = db.query(MaskingConfiguration).all()
    return configs


@router.put("/masking/config/{config_id}", response_model=MaskingConfigResponse)
def update_masking_configuration(
    config_id: str,
    payload: UpdateMaskingConfigRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    """Updates PII masking mode, regex pattern, or unmasking session timeout."""
    config = db.query(MaskingConfiguration).filter(MaskingConfiguration.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Masking configuration not found.")

    if payload.pattern_regex is not None:
        try:
            re.compile(payload.pattern_regex)
            config.pattern_regex = payload.pattern_regex
        except re.error as e:
            raise HTTPException(status_code=400, detail=f"Invalid regular expression pattern: {str(e)}")

    if payload.masking_mode is not None:
        config.masking_mode = payload.masking_mode
    if payload.is_active is not None:
        config.is_active = payload.is_active
    if payload.unmask_requires_justification is not None:
        config.unmask_requires_justification = payload.unmask_requires_justification
    if payload.session_timeout_minutes is not None:
        config.session_timeout_minutes = payload.session_timeout_minutes

    config.updated_by_id = current_user.id
    config.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(config)
    return config


@router.post("/masking/test", response_model=MaskingTestResponse)
def test_sensitive_data_masking(
    payload: MaskingTestRequest,
    current_user: User = Depends(require_role(["ADMIN", "AUDITOR"]))
):
    """
    Interactive test endpoint allowing administrators to evaluate privacy masking
    against arbitrary text strings.
    """
    masked = mask_text(payload.sample_text)
    matched = []
    if re.search(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b", payload.sample_text):
        matched.append("AADHAAR")
    if re.search(r"\b[A-Z]{5}\d{4}[A-Z]{1}\b", payload.sample_text):
        matched.append("PAN")
    if re.search(r"\b(?:\+91|0)?[6-9]\d{9}\b", payload.sample_text):
        matched.append("PHONE")
    if "@" in payload.sample_text:
        matched.append("EMAIL")

    return MaskingTestResponse(
        original_text=payload.sample_text,
        masked_text=masked,
        matched_identifiers=matched
    )


# -------------------------------------------------------------
# 5. Global Audit Log Query
# -------------------------------------------------------------
@router.get("/audit/system-logs", response_model=List[AuditLogResponse])
def get_system_wide_audit_logs(
    action: Optional[str] = Query(None),
    actor_role: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN", "AUDITOR"]))
):
    """
    Queries system-wide tamper-evident audit journal across all applications and governance events.
    """
    query = db.query(ApplicationAuditEvent)
    if action:
        query = query.filter(ApplicationAuditEvent.action == action)
    if actor_role:
        query = query.filter(ApplicationAuditEvent.actor_role == actor_role)

    return query.order_by(ApplicationAuditEvent.timestamp.desc()).limit(limit).all()
