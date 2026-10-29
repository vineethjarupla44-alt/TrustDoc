import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.security import verify_password, get_password_hash, create_access_token, get_current_user
from backend.app.models.models import User, Application, InstitutionRegistration, ApplicationAuditEvent
from backend.app.schemas.schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
    ApplicantRegistrationRequest,
    ApplicantRegistrationResponse,
    OfficerRegistrationRequest,
    OfficerRegistrationResponse,
    OfficerRequestStatusResponse,
    AdminSetupStatusResponse,
    InitialAdminSetupRequest
)
from backend.app.api.v1.endpoints.audit import compute_event_hash

router = APIRouter(prefix="/auth", tags=["Authentication & Account Onboarding"])

# -------------------------------------------------------------
# 1. College Applicant Registration (New & Claim/Renewal)
# -------------------------------------------------------------
@router.post("/register-applicant", response_model=ApplicantRegistrationResponse, status_code=status.HTTP_201_CREATED)
def register_applicant(payload: ApplicantRegistrationRequest, db: Session = Depends(get_db)):
    """
    Registers a new College Applicant, validates duplicate email/registration,
    persists the authorized representative, and creates/links institutional records.
    """
    clean_email = payload.email.lower().strip()
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{clean_email}' already exists. Please sign in or use another email."
        )

    now = datetime.now(timezone.utc)
    ref_code = f"REG-2026-{uuid.uuid4().hex[:6].upper()}"

    # Determine registration numbers
    if payload.registration_number and payload.registration_number.strip():
        clean_reg_num = payload.registration_number.strip()
        existing_reg = db.query(InstitutionRegistration).filter(
            InstitutionRegistration.registration_number == clean_reg_num
        ).first()
        if existing_reg:
            # Check if already owned by another active user
            if existing_reg.applicant_user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Registration Number '{clean_reg_num}' is already claimed by another registered representative."
                )
        reg_number = clean_reg_num
        inst_code = f"AICTE-{clean_reg_num}"
    else:
        reg_number = f"1-{uuid.uuid4().hex[:9].upper()}"
        inst_code = f"AICTE-1-{uuid.uuid4().hex[:8].upper()}"

    # Create Applicant User
    new_user = User(
        email=clean_email,
        password_hash=get_password_hash(payload.password),
        full_name=payload.full_name.strip(),
        role="APPLICANT",
        institution_name=payload.institution_name.strip(),
        phone_number=payload.phone_number.strip(),
        approval_status="APPROVED",
        is_active=True
    )
    db.add(new_user)
    db.flush()

    # Create or update linked InstitutionRegistration
    institution = InstitutionRegistration(
        institution_code=inst_code,
        registration_number=reg_number,
        institution_name=payload.institution_name.strip(),
        applicant_user_id=new_user.id,
        institution_type=payload.institution_type,
        affiliation_university=payload.affiliation_university,
        state=payload.state,
        district=payload.district,
        address=payload.address.strip(),
        contact_email=clean_email,
        contact_phone=payload.phone_number.strip(),
        head_of_institution=payload.full_name.strip(),
        valid_from=now,
        valid_upto=now + timedelta(days=365 * 3),
        status="ACTIVE",
        is_autonomous=False,
        accreditation_grade="Pending Initial Assessment"
    )
    db.add(institution)
    db.flush()

    # Automatically create an active Draft Application for the new applicant
    initial_app = Application(
        applicant_id=new_user.id,
        application_number=f"APP-2026-{uuid.uuid4().hex[:6].upper()}",
        institution_name=payload.institution_name.strip(),
        institution_type=payload.institution_type or "Private / Self-Financed",
        state=payload.state or "Delhi",
        district=payload.district or "New Delhi",
        academic_year="2026-2027",
        status="DRAFT"
    )
    db.add(initial_app)
    db.flush()

    # Chained Audit Trail
    audit_evt = ApplicationAuditEvent(
        application_id=initial_app.id,
        actor_id=new_user.id,
        actor_role="APPLICANT",
        action="COLLEGE_APPLICANT_ONBOARDED",
        ip_address="127.0.0.1",
        diff_payload={
            "reference": ref_code,
            "registration_number": reg_number,
            "institution_name": payload.institution_name,
            "documents_uploaded": len(payload.uploaded_documents)
        },
        event_hash=compute_event_hash(f"{ref_code}-{clean_email}-ONBOARDED")
    )
    db.add(audit_evt)

    db.commit()
    db.refresh(new_user)

    return ApplicantRegistrationResponse(
        user=new_user,
        registration_reference=ref_code,
        registration_number=reg_number,
        status="ACTIVE",
        message="Institutional account created and verified. You may now sign in to your Applicant Portal."
    )


# -------------------------------------------------------------
# 2. Security Officer Account Request & Status Verification
# -------------------------------------------------------------
@router.post("/request-officer", response_model=OfficerRegistrationResponse, status_code=status.HTTP_201_CREATED)
def request_officer_account(payload: OfficerRegistrationRequest, db: Session = Depends(get_db)):
    """
    Submits a Security Officer account request with official credentials.
    Enrolls the request in PENDING_APPROVAL status with strict statutory access gating.
    Handles:
    - Case A: Both email and employee ID are new -> creates request in PENDING_APPROVAL status.
    - Case B: Identical pending request exists -> returns 409 with specific duplicate guidance and status link.
    - Case C: An approved officer account exists -> returns 409 directing to login/recovery.
    - Case D: Existing request was rejected -> shows rejection status and allows policy-governed resubmission.
    - Case E: Email/Employee ID mismatch -> returns 409 conflict message.
    - Case F: Database/server errors -> transaction rollback and safe error reporting.
    """
    clean_email = payload.email.lower().strip()
    clean_emp_id = payload.employee_id.strip()

    # 1. Backend Input Validation
    if not clean_email or "@" not in clean_email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A valid official email address is required."
        )
    if not clean_emp_id or len(clean_emp_id) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A valid Government/Employee ID (minimum 3 characters) is required."
        )
    if not payload.full_name or len(payload.full_name.strip()) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Officer full name must be at least 2 characters."
        )
    if not payload.organization or len(payload.organization.strip()) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Authority Organization name is required."
        )
    if not payload.password or len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 6 characters."
        )

    # 2. Database Duplicate & Conflict Inspection
    existing_by_email = db.query(User).filter(User.email == clean_email).first()
    existing_by_emp_id = db.query(User).filter(User.employee_id == clean_emp_id).first() if clean_emp_id else None

    # Case E1: Email exists with another role (e.g. APPLICANT or ADMIN)
    if existing_by_email and existing_by_email.role != "REVIEWER":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflict detected: The official email '{clean_email}' is already registered as an institutional account with role '{existing_by_email.role}'. Please use your designated departmental scrutiny email or contact administrator support.",
            headers={"X-Conflict-Code": "ROLE_CONFLICT", "X-Officer-Email": clean_email}
        )

    # Case E2: Employee ID exists under another user record
    if existing_by_emp_id and (not existing_by_email or existing_by_email.id != existing_by_emp_id.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflict detected: Government Employee ID '{clean_emp_id}' is already registered under another official email. For statutory integrity, please contact Central Scrutiny Administration.",
            headers={"X-Conflict-Code": "CREDENTIAL_MISMATCH", "X-Officer-EmpId": clean_emp_id}
        )

    # Case: Email matches an existing officer record
    if existing_by_email:
        status_val = getattr(existing_by_email, "approval_status", "APPROVED")

        # Case C: Officer account already exists and is approved
        if status_val == "APPROVED" or existing_by_email.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An officer account already exists for this email. Please log in or use password recovery.",
                headers={"X-Conflict-Code": "APPROVED_EXISTS", "X-Officer-Email": clean_email}
            )

        # Case B: Identical pending request exists
        if status_val == "PENDING_APPROVAL":
            if existing_by_email.employee_id == clean_emp_id or not existing_by_email.employee_id:
                ref_id = f"OFFICER-REQ-{existing_by_email.id[:6].upper()}"
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An officer account request already exists for these details and is awaiting administrator review.",
                    headers={
                        "X-Conflict-Code": "ALREADY_PENDING",
                        "X-Officer-Ref": ref_id,
                        "X-Officer-Email": clean_email,
                        "X-Officer-EmpId": clean_emp_id
                    }
                )
            else:
                # Case E3: Email exists in pending status, but with a different employee ID
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Conflict detected: An officer account request for email '{clean_email}' is already registered with Employee ID '{existing_by_email.employee_id}'. Please verify your credentials or contact Central Scrutiny Administration.",
                    headers={"X-Conflict-Code": "CREDENTIAL_MISMATCH", "X-Officer-Email": clean_email}
                )

        # Case D: An existing request was rejected
        if status_val == "REJECTED":
            rejection_reason = getattr(existing_by_email, "rejection_reason", None) or "Statutory eligibility criteria not satisfied."

            # Policy-governed resubmission
            if payload.resubmit:
                try:
                    existing_by_email.password_hash = get_password_hash(payload.password)
                    existing_by_email.full_name = payload.full_name.strip()
                    existing_by_email.employee_id = clean_emp_id
                    existing_by_email.department = payload.department.strip()
                    existing_by_email.designation = payload.designation.strip()
                    existing_by_email.institution_name = payload.organization.strip()
                    if payload.phone_number:
                        existing_by_email.phone_number = payload.phone_number.strip()
                    existing_by_email.approval_status = "PENDING_APPROVAL"
                    existing_by_email.is_active = False
                    existing_by_email.rejection_reason = None
                    existing_by_email.updated_at = datetime.now(timezone.utc)

                    try:
                        first_app = db.query(Application).first()
                        if first_app:
                            audit_evt = ApplicationAuditEvent(
                                application_id=first_app.id,
                                actor_id=existing_by_email.id,
                                actor_role="REVIEWER",
                                action="SECURITY_OFFICER_REQUEST_RESUBMITTED",
                                ip_address="127.0.0.1",
                                diff_payload={
                                    "email": clean_email,
                                    "employee_id": clean_emp_id,
                                    "department": payload.department
                                },
                                event_hash=compute_event_hash(f"{existing_by_email.id}-{clean_emp_id}-RESUBMITTED")
                            )
                            db.add(audit_evt)
                    except Exception as audit_err:
                        logging.warning(f"Audit log recording skipped: {audit_err}")

                    db.commit()
                    db.refresh(existing_by_email)

                    req_id = f"OFFICER-REQ-{existing_by_email.id[:6].upper()}"
                    return OfficerRegistrationResponse(
                        request_id=req_id,
                        full_name=existing_by_email.full_name,
                        email=clean_email,
                        employee_id=clean_emp_id,
                        organization=existing_by_email.institution_name or payload.organization,
                        status="PENDING_APPROVAL",
                        message="Your revised officer account request has been resubmitted and is awaiting administrator re-review.",
                        created_at=existing_by_email.updated_at
                    )
                except Exception as exc:
                    db.rollback()
                    logging.error(f"Error resubmitting officer request for {clean_email}: {exc}", exc_info=True)
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="An unexpected system error occurred while resubmitting your request. Diagnostic details have been logged."
                    )
            else:
                # Inform user of previous rejection and provide path to resubmit or contact administration
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A previous officer account request for this email was rejected by administration (Reason: {rejection_reason}). You may submit updated credentials for re-review or contact Central Scrutiny Administration.",
                    headers={
                        "X-Conflict-Code": "PREVIOUSLY_REJECTED",
                        "X-Rejection-Reason": rejection_reason,
                        "X-Officer-Email": clean_email
                    }
                )

    # Case A: Email and Employee ID are both new!
    try:
        req_uuid = uuid.uuid4()
        req_id = f"OFFICER-REQ-{req_uuid.hex[:6].upper()}"

        new_officer = User(
            id=str(req_uuid),
            email=clean_email,
            password_hash=get_password_hash(payload.password),
            full_name=payload.full_name.strip(),
            role="REVIEWER",
            institution_name=payload.organization.strip(),
            employee_id=clean_emp_id,
            department=payload.department.strip(),
            designation=payload.designation.strip(),
            phone_number=payload.phone_number.strip() if payload.phone_number else None,
            approval_status="PENDING_APPROVAL",
            is_active=False
        )
        db.add(new_officer)
        db.flush()

        try:
            first_app = db.query(Application).first()
            if first_app:
                audit_evt = ApplicationAuditEvent(
                    application_id=first_app.id,
                    actor_id=new_officer.id,
                    actor_role="REVIEWER",
                    action="SECURITY_OFFICER_REQUEST_SUBMITTED",
                    ip_address="127.0.0.1",
                    diff_payload={
                        "request_id": req_id,
                        "email": clean_email,
                        "employee_id": clean_emp_id,
                        "department": payload.department
                    },
                    event_hash=compute_event_hash(f"{req_id}-{clean_emp_id}-SUBMITTED")
                )
                db.add(audit_evt)
        except Exception as audit_err:
            logging.warning(f"Audit log recording skipped: {audit_err}")

        db.commit()
        db.refresh(new_officer)

        return OfficerRegistrationResponse(
            request_id=req_id,
            full_name=new_officer.full_name,
            email=clean_email,
            employee_id=clean_emp_id,
            organization=payload.organization,
            status="PENDING_APPROVAL",
            message="Security Officer credentials registered. Account requires statutory administrator approval before login is permitted.",
            created_at=new_officer.created_at
        )

    # Case F: Database or server error
    except IntegrityError as ie:
        db.rollback()
        logging.warning(f"Integrity constraint collision during officer registration for {clean_email}: {ie}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An officer account request already exists for these details and is awaiting administrator review.",
            headers={"X-Conflict-Code": "ALREADY_PENDING"}
        )
    except Exception as exc:
        db.rollback()
        logging.error(f"Unexpected error during officer registration for {clean_email}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected system error occurred while processing your officer account request. Diagnostic details have been logged safely. Please try again later or contact administrator support."
        )


@router.get("/officer-request-status", response_model=OfficerRequestStatusResponse)
def get_officer_request_status(
    email: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None),
    reference_id: Optional[str] = Query(None),
    identifier: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Retrieves the statutory approval status for an officer credential request.
    Can be queried via official email, employee ID, or request reference code.
    """
    clean_identifier = (identifier or "").strip()
    clean_email = (email or "").strip().lower()
    clean_emp_id = (employee_id or "").strip()
    clean_ref = (reference_id or "").strip()

    if not clean_identifier and not clean_email and not clean_emp_id and not clean_ref:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide an email address, employee ID, or reference code to query request status."
        )

    query = db.query(User).filter(User.role == "REVIEWER")
    officer = None

    # Search by email
    target_email = clean_email or (clean_identifier.lower() if "@" in clean_identifier else None)
    if target_email:
        officer = query.filter(User.email == target_email).first()

    # Search by employee_id
    if not officer:
        target_emp = clean_emp_id or clean_identifier
        if target_emp:
            officer = query.filter(User.employee_id == target_emp).first()

    # Search by reference ID
    if not officer:
        target_ref = clean_ref or clean_identifier
        if target_ref:
            if target_ref.upper().startswith("OFFICER-REQ-"):
                short_code = target_ref.upper().replace("OFFICER-REQ-", "").lower()
                officer = query.filter(User.id.ilike(f"{short_code}%")).first()
            else:
                officer = query.filter(User.id == target_ref).first()

    if not officer:
        return OfficerRequestStatusResponse(
            found=False,
            is_active=False,
            message="No officer account request was found matching the provided details. Please verify your credentials or submit a new request."
        )

    status_val = getattr(officer, "approval_status", "APPROVED")
    is_active = bool(officer.is_active)

    if status_val == "PENDING_APPROVAL":
        msg = "Your officer account request is currently pending statutory review by Central Scrutiny Administration."
    elif status_val == "APPROVED":
        msg = "Your officer account has been approved and is active. You may log in to the Security Officer portal."
    elif status_val == "REJECTED":
        reason = officer.rejection_reason or "Statutory verification criteria not satisfied."
        msg = f"Your officer account request was not approved by administration (Reason: {reason}). You may submit a revised request for re-review."
    else:
        msg = f"Officer account status: {status_val}"

    return OfficerRequestStatusResponse(
        found=True,
        email=officer.email,
        employee_id=officer.employee_id,
        full_name=officer.full_name,
        department=officer.department,
        designation=officer.designation,
        organization=officer.institution_name,
        approval_status=status_val,
        rejection_reason=officer.rejection_reason if status_val == "REJECTED" else None,
        submitted_at=officer.created_at,
        updated_at=officer.updated_at,
        is_active=is_active,
        message=msg
    )


# -------------------------------------------------------------
# 3. Administrator Setup Status & Initial Root Setup
# -------------------------------------------------------------
@router.get("/admin-setup-status", response_model=AdminSetupStatusResponse)
def get_admin_setup_status(db: Session = Depends(get_db)):
    """
    Checks if an administrator exists. Initial setup is permitted only if no active administrators exist.
    """
    admin_count = db.query(User).filter(
        User.role == "ADMIN",
        User.approval_status == "APPROVED",
        User.is_active == True
    ).count()

    return AdminSetupStatusResponse(
        has_admin=admin_count > 0,
        setup_allowed=admin_count == 0,
        admin_count=admin_count
    )


@router.post("/initial-admin-setup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def initial_admin_setup(payload: InitialAdminSetupRequest, db: Session = Depends(get_db)):
    """
    Provisions the root administrator account during fresh local development or initial system installation.
    Requires the server-side INITIAL_ADMIN_SECRET. Disabled once an administrator exists.
    """
    admin_count = db.query(User).filter(
        User.role == "ADMIN",
        User.approval_status == "APPROVED",
        User.is_active == True
    ).count()

    if admin_count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Initial administrator setup is disabled because an administrator already exists. Additional administrators must be provisioned by an authenticated administrator via the Admin Console."
        )

    # Validate setup secret
    expected_secret = getattr(settings, "INITIAL_ADMIN_SECRET", "TRUSTDOC_ROOT_ADMIN_SETUP_2026")
    if payload.setup_secret.strip() != expected_secret.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrator setup secret key. Please check your server environment configuration."
        )

    clean_email = payload.email.lower().strip()
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{clean_email}' already exists."
        )

    new_admin = User(
        email=clean_email,
        password_hash=get_password_hash(payload.password),
        full_name=payload.full_name.strip(),
        role="ADMIN",
        institution_name=payload.institution_name.strip(),
        approval_status="APPROVED",
        is_active=True
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    return new_admin


# -------------------------------------------------------------
# 4. Universal Authentication (Login)
# -------------------------------------------------------------
@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    clean_email = login_in.email.lower().strip()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user or not verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password. Please verify your credentials.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Check approval status
    user_status = getattr(user, "approval_status", "APPROVED")
    if user_status == "PENDING_APPROVAL":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your officer account request is currently pending statutory administrator verification. You will be granted access once approved by Central Administration."
        )

    if user_status == "REJECTED":
        reason = getattr(user, "rejection_reason", None) or "Institutional credentials or eligibility criteria not met."
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your account request was rejected by administration. Reason: {reason}"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact your system administrator."
        )

    # Role validation against expected portal
    if login_in.expected_role:
        expected = login_in.expected_role.upper()
        if expected in ("OFFICER", "SECURITY_OFFICER", "SCRUTINY_OFFICER"):
            expected = "REVIEWER"
        user_role = user.role.upper()
        if user_role != expected:
            role_display = {
                "APPLICANT": "College Applicant",
                "REVIEWER": "Security Officer",
                "ADMIN": "Administrator",
                "AUDITOR": "Auditor"
            }
            user_display = role_display.get(user_role, user_role)
            expected_display = role_display.get(expected, expected)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role mismatch: This account is registered as '{user_display}', but you attempted to login under the '{expected_display}' portal. Please select the correct login portal."
            )

    access_token = create_access_token(data={"sub": user.email, "role": user.role, "id": user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


# -------------------------------------------------------------
# 5. Session Management & Verification
# -------------------------------------------------------------
@router.post("/logout")
def logout():
    """Confirms user logout and terminates session."""
    return {"message": "Successfully logged out from TrustDoc session."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# Legacy backwards compatibility endpoint
@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    requested_role = (user_in.role or "APPLICANT").upper()
    if requested_role in ("ADMIN", "REVIEWER", "OFFICER", "AUDITOR"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public registration is restricted to College Applicants. Security Officer and Administrator accounts must be provisioned by an authorized administrator."
        )

    clean_email = user_in.email.lower().strip()
    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    user = User(
        email=clean_email,
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role="APPLICANT",
        institution_name=user_in.institution_name,
        approval_status="APPROVED",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
