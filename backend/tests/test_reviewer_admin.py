import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.database import Base, get_db
from backend.app.core.security import get_current_user
from backend.app.models.models import (
    Application, Document, AssessmentSummary, ComplianceFinding, User,
    CorrectionRequest, DataRetentionPolicy, MaskingConfiguration, ApplicationAuditEvent,
    ValidationRule, RuleVersion, RegulatorySource
)


@pytest.fixture
def reviewer_admin_setup():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    # Seed users
    admin = User(
        id="usr-admin-01",
        email="admin@aicte.gov.in",
        full_name="Admin Director",
        role="ADMIN",
        institution_name="AICTE HQ",
        password_hash="mockadmin"
    )
    reviewer = User(
        id="usr-rev-01",
        email="reviewer@aicte.gov.in",
        full_name="Scrutiny Officer Sharma",
        role="REVIEWER",
        institution_name="AICTE Scrutiny Cell",
        password_hash="mockrev"
    )
    applicant = User(
        id="usr-app-01",
        email="applicant@apex.edu",
        full_name="Principal Raman",
        role="APPLICANT",
        institution_name="Apex Engineering College",
        password_hash="mockapp"
    )
    db.add_all([admin, reviewer, applicant])
    db.commit()

    # Seed Applications with different triage profiles
    # App 1: High Risk (Score: 55, FLAGGED, Critical Auth finding)
    app_high = Application(
        id="app-high-01",
        applicant_id=applicant.id,
        application_number="APP-2026-CRITICAL",
        institution_name="Apex Engineering College",
        program_name="Computer Science & Engg",
        institution_type="Private / Self-Financed",
        status="FLAGGED",
        submitted_at=datetime.now(timezone.utc)
    )
    sum_high = AssessmentSummary(
        id="sum-high-01",
        application_id=app_high.id,
        authenticity_score=40.0,
        completeness_score=60.0,
        compliance_score=65.0,
        composite_score=54.8,
        recommendation="REJECTED"
    )
    finding_auth = ComplianceFinding(
        id="fnd-high-01",
        application_id=app_high.id,
        rule_code="AUTH-ELA-001",
        category="AUTHENTICITY",
        severity="CRITICAL",
        title="Image Splice Detected",
        description="ELA noise variance anomaly in seal",
        finding_status="FAIL",
        status="OPEN"
    )
    db.add_all([app_high, sum_high, finding_auth])

    # App 2: Moderate Risk (Score: 78, DEFICIENT, Missing Fire NOC)
    app_mod = Application(
        id="app-mod-02",
        applicant_id=applicant.id,
        application_number="APP-2026-MODERATE",
        institution_name="Apex Engineering College",
        program_name="Civil Engineering",
        institution_type="Private / Self-Financed",
        status="DEFICIENT",
        submitted_at=datetime.now(timezone.utc)
    )
    sum_mod = AssessmentSummary(
        id="sum-mod-02",
        application_id=app_mod.id,
        authenticity_score=95.0,
        completeness_score=70.0,
        compliance_score=70.0,
        composite_score=78.7,
        recommendation="DEFICIENT"
    )
    finding_comp = ComplianceFinding(
        id="fnd-mod-02",
        application_id=app_mod.id,
        rule_code="SYNTH-DOC-01",
        category="COMPLETENESS",
        severity="WARNING",
        title="Fire NOC Validity Expired",
        description="Fire safety certificate lapsed on 01/01/2026",
        finding_status="FAIL",
        status="OPEN"
    )
    db.add_all([app_mod, sum_mod, finding_comp])

    # App 3: Routine Clearance (Score: 96, SUBMITTED, Clean)
    app_clean = Application(
        id="app-clean-03",
        applicant_id=applicant.id,
        application_number="APP-2026-ROUTINE",
        institution_name="Apex Engineering College",
        program_name="Mechanical Engineering",
        institution_type="Private / Self-Financed",
        status="SUBMITTED",
        submitted_at=datetime.now(timezone.utc)
    )
    sum_clean = AssessmentSummary(
        id="sum-clean-03",
        application_id=app_clean.id,
        authenticity_score=100.0,
        completeness_score=95.0,
        compliance_score=95.0,
        composite_score=96.7,
        recommendation="ELIGIBLE"
    )
    # Give app 3 all 4 mandatory docs
    for doc_type in ["LAND_DEED", "BUILDING_PLAN", "FIRE_NOC", "FACULTY_LIST"]:
        db.add(Document(
            id=f"doc-clean-{doc_type}",
            application_id=app_clean.id,
            document_type=doc_type,
            file_name=f"{doc_type}.pdf",
            storage_path=f"storage/{doc_type}.pdf",
            sha256_hash=f"hash_{doc_type}"
        ))
    db.add_all([app_clean, sum_clean])

    # Seed sample validation rule
    rule = ValidationRule(
        id="rule-01",
        rule_code="SYNTH-NORM-1.1.1",
        category="REGULATORY",
        title="Urban Land Extent Norm",
        description="Minimum 2.5 acres required in urban zones",
        default_severity="CRITICAL",
        is_active=True
    )
    db.add(rule)
    db.flush()
    r_ver = RuleVersion(
        id="ver-01",
        rule_id=rule.id,
        version_tag="v2026.1",
        parameters_json={"min_land_acres": 2.5, "zone": "urban"},
        logic_handler="check_land_area"
    )
    db.add(r_ver)

    # Seed regulatory source
    source = RegulatorySource(
        id="src-01",
        source_name="AICTE Approval Process Handbook (2026-2027)",
        authority="AICTE",
        version="v2026.1",
        sha256_hash="source_hash_123",
        is_active=True
    )
    db.add(source)

    # Seed data retention policy
    ret = DataRetentionPolicy(
        id="ret-01",
        policy_code="RETENTION_DRAFTS",
        title="Unsubmitted Abandoned Drafts",
        category="ABANDONED_DRAFTS",
        retention_days=30,
        is_legal_hold=False,
        auto_purge_enabled=True
    )
    db.add(ret)

    # Seed masking config
    mask = MaskingConfiguration(
        id="mask-01",
        identifier_type="PHONE",
        label="Mobile Contact Number",
        pattern_regex=r"\b(?:\+91|0)?([6-9]\d{5})(\d{4})\b",
        masking_mode="PARTIAL_MASK",
        is_active=True,
        unmask_requires_justification=True,
        session_timeout_minutes=15
    )
    db.add(mask)

    db.commit()

    return db, admin, reviewer, applicant


# -------------------------------------------------------------
# Test 1: Prioritized Queue Sorting & Tiers
# -------------------------------------------------------------
def test_reviewer_queue_prioritization_and_tiers(reviewer_admin_setup):
    db, _, reviewer, _ = reviewer_admin_setup
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: reviewer
    client = TestClient(app)

    res = client.get("/api/v1/reviewer/queue")
    assert res.status_code == 200
    data = res.json()

    assert data["total_items"] == 3
    assert data["critical_count"] == 1
    assert data["moderate_count"] == 1
    assert data["routine_count"] == 1

    queue = data["queue"]
    # Critical should be first in queue
    assert queue[0]["application_number"] == "APP-2026-CRITICAL"
    assert queue[0]["priority_tier"] == "CRITICAL_HIGH"
    assert queue[0]["authenticity_flags_count"] == 1

    # Moderate should be second
    assert queue[1]["application_number"] == "APP-2026-MODERATE"
    assert queue[1]["priority_tier"] == "MODERATE_MEDIUM"

    # Routine clearance should be third
    assert queue[2]["application_number"] == "APP-2026-ROUTINE"
    assert queue[2]["priority_tier"] == "ROUTINE_CLEARANCE"
    assert len(queue[2]["missing_documents"]) == 0


# -------------------------------------------------------------
# Test 2: Request-Correction Workflow Lifecycle
# -------------------------------------------------------------
def test_reviewer_request_correction_workflow_lifecycle(reviewer_admin_setup):
    db, _, reviewer, _ = reviewer_admin_setup
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: reviewer
    client = TestClient(app)

    # 1. Issue correction request on Moderate app
    res = client.post(
        "/api/v1/reviewer/applications/app-mod-02/request-correction",
        json={
            "requested_items": [
                {
                    "field_key": "fire_noc_validity",
                    "document_type": "FIRE_NOC",
                    "reason": "Fire NOC validity has expired. Please submit renewed certificate."
                }
            ],
            "instructions": "Upload valid NOC from State Disaster Management Authority within 15 days.",
            "deadline_days": 15
        }
    )
    assert res.status_code == 200
    corr_data = res.json()
    assert corr_data["status"] == "OPEN"
    assert corr_data["application_id"] == "app-mod-02"
    assert len(corr_data["requested_items"]) == 1

    # Verify application status transitioned to DEFICIENT
    mod_app = db.query(Application).filter(Application.id == "app-mod-02").first()
    assert mod_app.status == "DEFICIENT"

    # 2. Reviewer resolves correction request with ACCEPT
    resolve_res = client.post(
        "/api/v1/reviewer/applications/app-mod-02/resolve-correction",
        json={
            "action": "ACCEPT",
            "reviewer_remarks": "Renewed Fire NOC verified and authenticated."
        }
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["correction_status"] == "ACCEPTED"
    assert resolve_res.json()["application_status"] == "PROCESSING"


# -------------------------------------------------------------
# Test 3: Original Findings Preservation upon Override
# -------------------------------------------------------------
def test_reviewer_override_preserves_original_findings(reviewer_admin_setup):
    db, _, reviewer, _ = reviewer_admin_setup
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: reviewer
    client = TestClient(app)

    finding = db.query(ComplianceFinding).filter(ComplianceFinding.id == "fnd-mod-02").first()
    assert finding.finding_status == "FAIL"
    assert finding.status == "OPEN"

    # Override finding to WAIVED
    res = client.post(
        "/api/v1/reviewer/applications/app-mod-02/override",
        json={
            "finding_id": "fnd-mod-02",
            "status": "WAIVED",
            "justification": "Provisional NOC granted by municipal commissioner attached."
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True

    # Crucial security assertion: original finding_status is NOT overwritten to PASS
    db.refresh(finding)
    assert finding.finding_status == "FAIL"  # Preserved original automated detection
    assert finding.status == "WAIVED"        # Reviewer lifecycle decision
    assert finding.overridden_by_id == reviewer.id
    assert "Provisional NOC" in finding.override_reason


# -------------------------------------------------------------
# Test 4: Decision Recording with Digital Seal
# -------------------------------------------------------------
def test_reviewer_decision_recording_with_digital_seal(reviewer_admin_setup):
    db, _, reviewer, _ = reviewer_admin_setup
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: reviewer
    client = TestClient(app)

    res = client.post(
        "/api/v1/reviewer/applications/app-clean-03/decision",
        json={
            "decision": "APPROVED",
            "remarks": "All land norms, infrastructure, and fire safety standards satisfied.",
            "deficiencies": [],
            "conditions": ["Annual safety compliance report by 31 Dec"]
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "APPROVED"
    assert len(data["digital_seal_hash"]) == 64  # SHA-256


# -------------------------------------------------------------
# Test 5: Application History Timeline
# -------------------------------------------------------------
def test_application_history_timeline(reviewer_admin_setup):
    db, _, reviewer, _ = reviewer_admin_setup
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: reviewer
    client = TestClient(app)

    res = client.get("/api/v1/reviewer/applications/app-high-01/history")
    assert res.status_code == 200
    data = res.json()
    assert data["application_id"] == "app-high-01"
    assert isinstance(data["events"], list)


# -------------------------------------------------------------
# Test 6: Admin RBAC Authorization Guards (403 for Non-Admins)
# -------------------------------------------------------------
def test_admin_rbac_authorization_guards(reviewer_admin_setup):
    db, admin, reviewer, applicant = reviewer_admin_setup
    client = TestClient(app)

    # Applicant attempting admin user list -> 403
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant
    res = client.get("/api/v1/admin/users")
    assert res.status_code == 403

    # Reviewer attempting admin user creation -> 403
    app.dependency_overrides[get_current_user] = lambda: reviewer
    res = client.post(
        "/api/v1/admin/users",
        json={
            "email": "intruder@aicte.gov.in",
            "password": "password123",
            "full_name": "Intruder User",
            "role": "ADMIN"
        }
    )
    assert res.status_code == 403

    # Admin successfully accesses -> 200
    app.dependency_overrides[get_current_user] = lambda: admin
    res = client.get("/api/v1/admin/users")
    assert res.status_code == 200


# -------------------------------------------------------------
# Test 7: Admin User Management & Self-Protection
# -------------------------------------------------------------
def test_admin_user_management_and_self_protection(reviewer_admin_setup):
    db, admin, _, _ = reviewer_admin_setup
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: admin
    client = TestClient(app)

    # 1. Create new user
    res = client.post(
        "/api/v1/admin/users",
        json={
            "email": "new.scrutiny@aicte.gov.in",
            "password": "securepassword123",
            "full_name": "Dr. New Officer",
            "role": "REVIEWER",
            "institution_name": "Scrutiny Cell West"
        }
    )
    assert res.status_code == 201
    new_user_data = res.json()
    assert new_user_data["email"] == "new.scrutiny@aicte.gov.in"

    # 2. Update user status
    user_id = new_user_data["id"]
    patch_res = client.patch(
        f"/api/v1/admin/users/{user_id}",
        json={"is_mfa_enabled": True}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_mfa_enabled"] is True

    # 3. Guardrail: Admin cannot deactivate own account
    self_res = client.patch(
        f"/api/v1/admin/users/{admin.id}",
        json={"is_active": False}
    )
    assert self_res.status_code == 400
    assert "Cannot deactivate your own" in self_res.json()["detail"]


# -------------------------------------------------------------
# Test 8: Admin Rule Versioning & Regulatory Source Toggle
# -------------------------------------------------------------
def test_admin_rule_versioning_and_source_toggle(reviewer_admin_setup):
    db, admin, _, _ = reviewer_admin_setup
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: admin
    client = TestClient(app)

    # List rules
    rules_res = client.get("/api/v1/admin/rules")
    assert rules_res.status_code == 200
    assert len(rules_res.json()) >= 1

    # Deploy new rule version
    v_res = client.post(
        "/api/v1/admin/rules/rule-01/versions",
        json={
            "version_tag": "v2027.1-draft",
            "parameters_json": {"min_land_acres": 3.0, "zone": "metro"},
            "logic_handler": "check_land_area_v2"
        }
    )
    assert v_res.status_code == 201
    assert v_res.json()["version_tag"] == "v2027.1-draft"

    # Toggle source status
    toggle_res = client.patch("/api/v1/admin/sources/src-01/toggle")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_active"] is False


# -------------------------------------------------------------
# Test 9: Admin Data Retention Governance & Sweep
# -------------------------------------------------------------
def test_admin_retention_policy_and_sweep(reviewer_admin_setup):
    db, admin, _, _ = reviewer_admin_setup
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: admin
    client = TestClient(app)

    # List policies
    res = client.get("/api/v1/admin/retention/policies")
    assert res.status_code == 200
    assert len(res.json()) >= 1

    # Update policy
    policy_id = res.json()[0]["id"]
    put_res = client.put(
        f"/api/v1/admin/retention/policies/{policy_id}",
        json={"retention_days": 45, "is_legal_hold": False}
    )
    assert put_res.status_code == 200
    assert put_res.json()["retention_days"] == 45

    # Execute retention sweep
    sweep_res = client.post("/api/v1/admin/retention/execute-sweep")
    assert sweep_res.status_code == 200
    sweep_data = sweep_res.json()
    assert sweep_data["status"] == "SWEEP_COMPLETED"
    assert "audit_event_id" in sweep_data


# -------------------------------------------------------------
# Test 10: Admin Masking Configuration & Interactive Tester
# -------------------------------------------------------------
def test_admin_masking_configuration_and_tester(reviewer_admin_setup):
    db, admin, _, _ = reviewer_admin_setup
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: admin
    client = TestClient(app)

    # List masking config
    res = client.get("/api/v1/admin/masking/config")
    assert res.status_code == 200
    configs = res.json()
    assert len(configs) >= 1

    # Test sample text with PII
    sample = "Candidate Aadhaar: 1234 5678 9012, PAN: ABCDE1234F, Phone: 9876543210"
    test_res = client.post(
        "/api/v1/admin/masking/test",
        json={"sample_text": sample}
    )
    assert test_res.status_code == 200
    test_data = test_res.json()
    assert "XXXX-XXXX-9012" in test_data["masked_text"]
    assert "XXXXX1234F" in test_data["masked_text"]
    assert "XXXXXX3210" in test_data["masked_text"]
    assert "AADHAAR" in test_data["matched_identifiers"]
