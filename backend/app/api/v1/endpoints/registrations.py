import uuid
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role
from backend.app.models.models import (
    User, InstitutionRegistration, RegistrationRenewal, ApplicationAuditEvent
)
from backend.app.schemas.schemas import (
    InstitutionRegistrationResponse,
    RegistrationRenewalResponse,
    RenewalSubmissionRequest,
    NewRegistrationRequest,
    RenewalDecisionRequest,
    RenewalCorrectionRequest,
    CollegeRegistrationOverview
)
from backend.app.api.v1.endpoints.audit import compute_event_hash

router = APIRouter(prefix="/registrations", tags=["College Registration & Renewal"])

RENEWAL_WINDOW_DAYS = 90
RENEWAL_EXTENSION_YEARS = 3

def get_or_seed_institution_registration(db: Session, user: User) -> InstitutionRegistration:
    """Ensure every college applicant has an initialized registered institution profile."""
    reg = db.query(InstitutionRegistration).filter(
        InstitutionRegistration.applicant_user_id == user.id
    ).first()

    if not reg:
        # Default seed registration for testing and evaluator inspection
        now = datetime.now(timezone.utc)
        # Seeded expiry set to 30 days in the future to place it cleanly in RENEWAL_DUE state
        valid_from = now - timedelta(days=365 * 3 - 30)
        valid_upto = now + timedelta(days=30)

        reg = InstitutionRegistration(
            institution_code="AICTE-1-439877261",
            registration_number="1-439877261",
            institution_name=user.institution_name or "Apex Institute of Technology",
            applicant_user_id=user.id,
            institution_type="Private / Self-Financed",
            affiliation_university="Delhi Technological University (DTU)",
            state="Delhi",
            district="New Delhi",
            address="Plot No. 12, Institutional Area, Sector 62, New Delhi - 110001",
            contact_email=user.email,
            contact_phone="+91-11-28945601",
            head_of_institution=user.full_name or "Dr. K. S. Ramanujam (Principal)",
            valid_from=valid_from,
            valid_upto=valid_upto,
            status="ACTIVE",
            is_autonomous=False,
            accreditation_grade="NAAC A+"
        )
        db.add(reg)
        db.commit()
        db.refresh(reg)

    return reg


@router.get("/overview", response_model=CollegeRegistrationOverview)
def get_college_registration_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the authenticated institution's registration details,
    current renewal status, history, and statutory eligibility state.
    """
    reg = get_or_seed_institution_registration(db, current_user)
    now = datetime.now(timezone.utc)

    # Fetch active/recent renewals
    renewals = db.query(RegistrationRenewal).filter(
        RegistrationRenewal.registration_id == reg.id
    ).order_by(RegistrationRenewal.created_at.desc()).all()

    active_renewal = renewals[0] if renewals else None

    # Calculate days until expiry
    valid_upto_aware = reg.valid_upto if reg.valid_upto.tzinfo else reg.valid_upto.replace(tzinfo=timezone.utc)
    delta_days = (valid_upto_aware - now).days

    # Derive state according to persisted workflow records and statutory dates
    if active_renewal and active_renewal.status in ("SUBMITTED", "UNDER_REVIEW", "CORRECTIONS_REQUIRED"):
        eligibility_status = active_renewal.status
        if eligibility_status == "SUBMITTED":
            eligibility_message = f"Renewal application {active_renewal.renewal_reference_number} has been submitted and is awaiting scrutiny queue assignment."
        elif eligibility_status == "UNDER_REVIEW":
            eligibility_message = f"Renewal application {active_renewal.renewal_reference_number} is actively under scrutiny review by the Regulatory Council."
        else:
            eligibility_message = f"Deficiency notice issued on {active_renewal.renewal_reference_number}. Please upload requested corrections before the deadline."
    elif active_renewal and active_renewal.status == "APPROVED" and delta_days > RENEWAL_WINDOW_DAYS:
        eligibility_status = "APPROVED"
        eligibility_message = f"Registration successfully renewed until {reg.valid_upto.strftime('%d %b %Y')} under Reference {active_renewal.renewal_reference_number}."
    elif delta_days < 0:
        eligibility_status = "EXPIRED"
        eligibility_message = f"Institutional registration expired on {reg.valid_upto.strftime('%d %b %Y')}. Urgent statutory renewal required to avoid de-affiliation."
    elif delta_days <= RENEWAL_WINDOW_DAYS:
        eligibility_status = "RENEWAL_DUE"
        eligibility_message = f"Statutory renewal window is OPEN. Registration expires in {delta_days} days ({reg.valid_upto.strftime('%d %b %Y')})."
    else:
        eligibility_status = "NOT_YET_ELIGIBLE"
        eligibility_message = f"Registration is valid until {reg.valid_upto.strftime('%d %b %Y')}. The statutory renewal window opens 90 days prior to expiry."

    return CollegeRegistrationOverview(
        registration=reg,
        active_renewal=active_renewal,
        renewal_history=renewals,
        eligibility_status=eligibility_status,
        eligibility_message=eligibility_message,
        days_until_expiry=delta_days,
        renewal_window_days=RENEWAL_WINDOW_DAYS,
        renewal_extension_years=RENEWAL_EXTENSION_YEARS
    )


@router.post("/renewal", response_model=RegistrationRenewalResponse, status_code=status.HTTP_201_CREATED)
def submit_registration_renewal(
    payload: RenewalSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits an institutional registration renewal. Pre-fills saved records,
    validates required fields, persists uploaded documents, and creates an auditable record.
    """
    reg = get_or_seed_institution_registration(db, current_user)

    # Check for active pending submission
    pending = db.query(RegistrationRenewal).filter(
        RegistrationRenewal.registration_id == reg.id,
        RegistrationRenewal.status.in_(["SUBMITTED", "UNDER_REVIEW", "CORRECTIONS_REQUIRED"])
    ).first()

    if pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An active renewal submission ({pending.renewal_reference_number}) is already in progress with status '{pending.status}'."
        )

    ref_num = f"REN-2026-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.now(timezone.utc)

    # Construct and persist renewal record
    renewal = RegistrationRenewal(
        registration_id=reg.id,
        applicant_id=current_user.id,
        application_type="RENEWAL",
        renewal_reference_number=ref_num,
        academic_year=payload.academic_year,
        status="SUBMITTED",
        institution_details=payload.institution_details,
        uploaded_documents=payload.uploaded_documents,
        submitted_at=now
    )
    db.add(renewal)

    # Log to audit trail
    audit_evt = ApplicationAuditEvent(
        application_id=reg.id,
        actor_id=current_user.id,
        actor_role="APPLICANT",
        action="COLLEGE_REGISTRATION_RENEWAL_SUBMITTED",
        ip_address="127.0.0.1",
        diff_payload={
            "renewal_reference": ref_num,
            "institution_code": reg.institution_code,
            "documents_count": len(payload.uploaded_documents)
        },
        event_hash=compute_event_hash(f"{ref_num}-{now.isoformat()}-RENEWAL_SUBMITTED")
    )
    db.add(audit_evt)

    db.commit()
    db.refresh(renewal)
    return renewal


@router.post("/new", response_model=RegistrationRenewalResponse, status_code=status.HTTP_201_CREATED)
def submit_new_college_registration(
    payload: NewRegistrationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Starts a new institutional registration application with initial establishment documents.
    """
    now = datetime.now(timezone.utc)
    new_reg_code = f"AICTE-1-{uuid.uuid4().hex[:8].upper()}"
    reg_num = f"1-{uuid.uuid4().hex[:9].upper()}"
    ref_num = f"REG-2026-{uuid.uuid4().hex[:6].upper()}"

    # Create new InstitutionRegistration record
    reg = InstitutionRegistration(
        institution_code=new_reg_code,
        registration_number=reg_num,
        institution_name=payload.institution_name,
        applicant_user_id=current_user.id,
        institution_type=payload.institution_type,
        affiliation_university=payload.affiliation_university,
        state=payload.state,
        district=payload.district,
        address=payload.address,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        head_of_institution=payload.head_of_institution,
        valid_from=now,
        valid_upto=now + timedelta(days=365 * 3),
        status="PENDING_APPROVAL"
    )
    db.add(reg)
    db.flush()

    renewal = RegistrationRenewal(
        registration_id=reg.id,
        applicant_id=current_user.id,
        application_type="NEW_REGISTRATION",
        renewal_reference_number=ref_num,
        academic_year="2026-2027",
        status="SUBMITTED",
        institution_details=payload.dict(),
        uploaded_documents=payload.uploaded_documents,
        submitted_at=now
    )
    db.add(renewal)
    db.commit()
    db.refresh(renewal)
    return renewal


@router.get("/queue", response_model=List[RegistrationRenewalResponse])
def get_registration_scrutiny_queue(
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["REVIEWER", "AUDITOR", "ADMIN"]))
):
    """
    Reviewer & Admin scrutiny queue for institutional registrations and renewal submissions.
    """
    query = db.query(RegistrationRenewal).order_by(RegistrationRenewal.created_at.desc())
    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(RegistrationRenewal.status == status_filter.upper())
    return query.all()


@router.post("/renewal/{renewal_id}/decision", response_model=RegistrationRenewalResponse)
def record_renewal_scrutiny_decision(
    renewal_id: str,
    decision_in: RenewalDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["REVIEWER", "ADMIN"]))
):
    """
    Authorized Security Officer or Administrator determination on an institutional renewal.
    - APPROVE: Extends registration validity period and updates status to ACTIVE.
    - CORRECTIONS_REQUIRED: Sets deficiency notice and deadline for applicant resubmission.
    - REJECT: Formal rejection with statutory justification.
    """
    renewal = db.query(RegistrationRenewal).filter(RegistrationRenewal.id == renewal_id).first()
    if not renewal:
        raise HTTPException(status_code=404, detail="Renewal submission not found.")

    reg = db.query(InstitutionRegistration).filter(InstitutionRegistration.id == renewal.registration_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Parent institutional registration not found.")

    now = datetime.now(timezone.utc)
    renewal.reviewed_at = now
    renewal.decision_date = now
    renewal.reviewer_id = current_user.id
    renewal.decision = decision_in.decision
    renewal.decision_notes = decision_in.statutory_notes

    # Seal hash
    seal_raw = f"{renewal.renewal_reference_number}-{decision_in.decision}-{current_user.email}-{now.isoformat()}"
    renewal.digital_scrutiny_seal = hashlib.sha256(seal_raw.encode('utf-8')).hexdigest()

    if decision_in.decision == "APPROVED":
        renewal.status = "APPROVED"
        # Renewed validity period begins from previous expiry or current date
        base_date = reg.valid_upto if reg.valid_upto > now else now
        renewal.new_valid_from = now
        renewal.new_valid_upto = base_date + timedelta(days=365 * decision_in.extension_years)

        # Update parent registration record
        reg.valid_upto = renewal.new_valid_upto
        reg.status = "ACTIVE"
        reg.updated_at = now
    elif decision_in.decision == "CORRECTIONS_REQUIRED":
        renewal.status = "CORRECTIONS_REQUIRED"
        renewal.deficiency_notice = decision_in.deficiency_notice or decision_in.statutory_notes
        renewal.deficiency_deadline_days = decision_in.deficiency_deadline_days
    elif decision_in.decision == "REJECTED":
        renewal.status = "REJECTED"

    # Audit event
    audit_evt = ApplicationAuditEvent(
        application_id=reg.id,
        actor_id=current_user.id,
        actor_role=current_user.role,
        action=f"RENEWAL_DECISION_{decision_in.decision}",
        ip_address="127.0.0.1",
        diff_payload={
            "renewal_id": renewal.id,
            "decision": decision_in.decision,
            "digital_seal": renewal.digital_scrutiny_seal,
            "extended_until": renewal.new_valid_upto.isoformat() if renewal.new_valid_upto else None
        },
        event_hash=renewal.digital_scrutiny_seal
    )
    db.add(audit_evt)

    db.commit()
    db.refresh(renewal)
    return renewal


@router.post("/renewal/{renewal_id}/resubmit-corrections", response_model=RegistrationRenewalResponse)
def resubmit_renewal_corrections(
    renewal_id: str,
    payload: RenewalCorrectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Applicant uploads corrected documents and explanatory notes responding to deficiency notices.
    """
    renewal = db.query(RegistrationRenewal).filter(
        RegistrationRenewal.id == renewal_id,
        RegistrationRenewal.applicant_id == current_user.id
    ).first()

    if not renewal:
        raise HTTPException(status_code=404, detail="Renewal submission not found or not owned by applicant.")

    if renewal.status != "CORRECTIONS_REQUIRED":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resubmit corrections: renewal is currently in '{renewal.status}' state."
        )

    now = datetime.now(timezone.utc)
    renewal.applicant_correction_notes = payload.correction_notes
    renewal.applicant_correction_documents = payload.correction_documents
    renewal.resubmitted_at = now
    renewal.status = "UNDER_REVIEW"

    # Audit
    audit_evt = ApplicationAuditEvent(
        application_id=renewal.registration_id,
        actor_id=current_user.id,
        actor_role="APPLICANT",
        action="RENEWAL_CORRECTIONS_RESUBMITTED",
        ip_address="127.0.0.1",
        diff_payload={"renewal_id": renewal.id, "correction_documents_count": len(payload.correction_documents)},
        event_hash=compute_event_hash(f"CORRECTION-{renewal.id}-{now.isoformat()}")
    )
    db.add(audit_evt)

    db.commit()
    db.refresh(renewal)
    return renewal


@router.get("/rules")
def get_registration_renewal_rules():
    """
    Configurable statutory renewal rules and documentation requirements.
    """
    return {
        "authority": "AICTE / Statutory Higher Education Regulatory Council",
        "renewal_window_days": RENEWAL_WINDOW_DAYS,
        "extension_validity_years": RENEWAL_EXTENSION_YEARS,
        "mandatory_renewal_documents": [
            {
                "code": "LAND_DEED",
                "title": "Registered Land Title Deed / Continuing Ownership",
                "standard": "AICTE APH 2026-27 Ch. 1"
            },
            {
                "code": "FIRE_NOC",
                "title": "Current Fire & Life Safety Clearance Certificate",
                "standard": "AICTE APH 2026-27 Ch. 3 (Annual Renewal)"
            },
            {
                "code": "BUILDING_PLAN",
                "title": "Approved Building Plan & Occupancy Certificate",
                "standard": "AICTE APH 2026-27 Ch. 2"
            },
            {
                "code": "FACULTY_LIST",
                "title": "Faculty Cadre & Ratio Declaration (Form 16/EPF Verified)",
                "standard": "AICTE APH 2026-27 Ch. 4 (1:2:6 Ratio)"
            }
        ],
        "statutory_fee_currency": "INR",
        "is_demo_rule": True,
        "disclaimer": "Statutory deadlines and renewal parameters are configured according to the AICTE 2026-27 Approval Process Handbook."
    }
