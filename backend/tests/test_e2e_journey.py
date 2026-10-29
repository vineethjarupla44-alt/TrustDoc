import io
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.database import Base, get_db
from backend.app.core.security import get_current_user, get_current_user_optional
from backend.app.models.models import (
    Application, Document, AssessmentSummary, ComplianceFinding, User,
    CorrectionRequest, DataRetentionPolicy, MaskingConfiguration, ApplicationAuditEvent,
    ValidationRule, RuleVersion, RegulatorySource, ExtractedField, ExtractedEntities,
    DocumentForensics
)
from backend.app.api.v1.endpoints.regulations import SYNTHETIC_RULES


@pytest.fixture
def e2e_fixture():
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
        id="usr-adm-e2e",
        email="admin@aicte.gov.in",
        full_name="Admin Director",
        role="ADMIN",
        institution_name="Regulatory Council Core",
        password_hash="mockadmin"
    )
    reviewer = User(
        id="usr-rev-e2e",
        email="reviewer@aicte.gov.in",
        full_name="Scrutiny Officer Sharma",
        role="REVIEWER",
        institution_name="AICTE Scrutiny Cell",
        password_hash="mockrev"
    )
    applicant = User(
        id="usr-app-e2e",
        email="applicant@apex.edu",
        full_name="Dr. K. S. Ramanujam",
        role="APPLICANT",
        institution_name="Apex Institute of Technology",
        password_hash="mockapp"
    )
    applicant_other = User(
        id="usr-app-other",
        email="other@institute.edu",
        full_name="Other Principal",
        role="APPLICANT",
        institution_name="Other Institute",
        password_hash="mockother"
    )
    db.add_all([admin, reviewer, applicant, applicant_other])
    db.commit()

    # Seed regulatory rules
    for r in SYNTHETIC_RULES:
        cat = "REGULATORY"
        if "Forensic" in r.get("title", "") or "6." in r.get("rule_code", ""):
            cat = "AUTHENTICITY"
        elif "Cross" in r.get("title", "") or "5." in r.get("rule_code", ""):
            cat = "COMPLETENESS"

        val_rule = ValidationRule(
            rule_code=r["rule_code"],
            category=cat,
            title=r["title"],
            description=r["description"],
            default_severity=r.get("severity", "CRITICAL"),
            authority="AICTE / Statutory Regulatory Council",
            is_active=True
        )
        db.add(val_rule)
        db.flush()

        rule_ver = RuleVersion(
            rule_id=val_rule.id,
            version_tag="v2026.1",
            parameters_json={"threshold": r.get("threshold", "Mandatory")},
            logic_handler=f"eval_{r['rule_code'].replace('-', '_').lower()}"
        )
        db.add(rule_ver)

    db.commit()
    return db, admin, reviewer, applicant, applicant_other


# =========================================================================
# Step 1: Applicant Creates an Application (Successful & Failure Paths)
# =========================================================================
def test_step_1_create_application(e2e_fixture):
    db, _, _, applicant, _ = e2e_fixture
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant
    client = TestClient(app)

    # Success path
    payload = {
        "institution_name": "Apex Institute of Technology",
        "institution_type": "Private / Self-Financed",
        "program_name": "Computer Science & Engineering",
        "state": "Delhi",
        "district": "New Delhi",
        "academic_year": "2026-2027"
    }
    res = client.post("/api/v1/applications", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["institution_name"] == "Apex Institute of Technology"
    assert data["status"] == "DRAFT"
    assert "APP-" in data["application_number"]

    # Failure path: missing required institution_name
    bad_payload = {
        "program_name": "Computer Science & Engineering",
        "state": "Delhi"
    }
    bad_res = client.post("/api/v1/applications", json=bad_payload)
    assert bad_res.status_code == 422  # Unprocessable entity


# =========================================================================
# Step 2: Applicant Uploads Supporting Documents (Success & Error Handling)
# =========================================================================
def test_step_2_upload_documents(e2e_fixture):
    db, _, _, applicant, _ = e2e_fixture
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant
    client = TestClient(app)

    # Create application first
    app_res = client.post("/api/v1/applications", json={
        "institution_name": "Apex Institute of Technology",
        "program_name": "Civil Engineering"
    })
    app_id = app_res.json()["id"]

    # 1. Successful PDF upload with valid magic bytes
    valid_pdf_content = b"%PDF-1.4\n%mock pdf document content for testing\n%%EOF"
    upload_res = client.post(
        f"/api/v1/documents/upload/{app_id}",
        data={"document_type": "LAND_DEED"},
        files={"file": ("land_deed.pdf", io.BytesIO(valid_pdf_content), "application/pdf")}
    )
    assert upload_res.status_code == 200
    doc_data = upload_res.json()
    assert doc_data["document_type"] == "LAND_DEED"
    assert doc_data["file_name"] == "land_deed.pdf"

    # 2. Failure path: Invalid file extension (.exe)
    invalid_ext_res = client.post(
        f"/api/v1/documents/upload/{app_id}",
        data={"document_type": "FIRE_NOC"},
        files={"file": ("malicious.exe", io.BytesIO(b"MZ12345"), "application/octet-stream")}
    )
    assert invalid_ext_res.status_code == 400
    assert "Invalid file type" in invalid_ext_res.json()["detail"]

    # 3. Failure path: Extension spoofing (named .pdf but magic bytes are GIF)
    spoofed_res = client.post(
        f"/api/v1/documents/upload/{app_id}",
        data={"document_type": "FIRE_NOC"},
        files={"file": ("spoofed.pdf", io.BytesIO(b"GIF89a12345"), "application/pdf")}
    )
    assert spoofed_res.status_code == 400
    assert "File content signature does not match" in spoofed_res.json()["detail"]


# =========================================================================
# Step 3 & 4: OCR Extraction & Field Correction Workflow
# =========================================================================
def test_step_3_and_4_ocr_and_field_correction(e2e_fixture):
    db, _, _, applicant, _ = e2e_fixture
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant
    client = TestClient(app)

    # Seed application with a document and extracted atomic field
    test_app = Application(
        id="app-ocr-test",
        applicant_id=applicant.id,
        application_number="APP-2026-OCR",
        institution_name="Apex Institute",
        program_name="IT",
        status="SUBMITTED"
    )
    db.add(test_app)
    db.commit()

    test_doc = Document(
        id="doc-ocr-01",
        application_id=test_app.id,
        document_type="LAND_DEED",
        file_name="title_deed.pdf",
        storage_path="/tmp/title_deed.pdf",
        sha256_hash="dummyhash123",
        file_size_bytes=1024,
        mime_type="application/pdf",
        extraction_status="SUCCESS"
    )
    db.add(test_doc)
    db.commit()

    extracted_field = ExtractedField(
        id="field-01",
        document_id=test_doc.id,
        field_key="land_area_acres",
        label="Total Land Area (Acres)",
        field_value_normalized="2.10",
        field_value_raw="2.10 ACRES",
        data_type="FLOAT",
        confidence_score=0.88,
        page_number=1,
        bounding_box={"x0": 50, "y0": 100, "x1": 200, "y1": 120},
        ocr_engine="PYMUPDF",
        state="NEEDS_REVIEW",
        is_manually_corrected=False,
        is_pii=False
    )
    db.add(extracted_field)
    db.commit()

    # Step 4: Applicant corrects the extracted field
    correct_payload = {
        "corrected_value": "2.50",
        "correction_reason": "OCR misread '2.50' as '2.10' due to fold in page 1"
    }
    patch_res = client.patch(f"/api/v1/documents/{test_doc.id}/fields/{extracted_field.id}", json=correct_payload)
    assert patch_res.status_code == 200
    patch_data = patch_res.json()
    assert patch_data["field_value_normalized"] == "2.50"
    assert patch_data["is_manually_corrected"] is True

    # Verify field is marked manually corrected in DB
    db.refresh(extracted_field)
    assert extracted_field.field_value_normalized == "2.50"
    assert extracted_field.is_manually_corrected is True
    assert extracted_field.state == "MANUALLY_ENTERED"


# =========================================================================
# Step 5: Deterministic Validation Engine (Pass & Deficient Cases)
# =========================================================================
def test_step_5_validation_engine(e2e_fixture):
    db, _, _, applicant, _ = e2e_fixture
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant
    client = TestClient(app)

    # Test Case B: Cross-document acreage discrepancy
    app_b = Application(
        id="app-case-b",
        applicant_id=applicant.id,
        application_number="APP-2026-CASE-B",
        institution_name="Bharti Technical Institute",
        program_name="Engineering",
        status="PROCESSING"
    )
    doc_land = Document(
        id="doc-b-land",
        application_id=app_b.id,
        document_type="LAND_DEED",
        file_name="land_deed.pdf",
        storage_path="/tmp/land.pdf",
        sha256_hash="hash_b_land"
    )
    doc_site = Document(
        id="doc-b-site",
        application_id=app_b.id,
        document_type="BUILDING_PLAN",
        file_name="site_plan.pdf",
        storage_path="/tmp/site.pdf",
        sha256_hash="hash_b_site"
    )
    db.add_all([app_b, doc_land, doc_site])
    db.commit()

    f_land = ExtractedField(
        document_id=doc_land.id,
        field_key="land_area_acres",
        field_value_normalized="2.50",
        confidence_score=0.95
    )
    f_site = ExtractedField(
        document_id=doc_site.id,
        field_key="total_plot_area_acres",
        field_value_normalized="1.85",
        confidence_score=0.92
    )
    db.add_all([f_land, f_site])
    db.commit()

    val_res = client.post(f"/api/v1/validation/{app_b.id}/run")
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["recommendation"] in ["DEFICIENT", "REJECTED"]
    assert val_data["composite_score"] < 90.0

    # Verify findings captured the 0.65-acre discrepancy
    findings = db.query(ComplianceFinding).filter(ComplianceFinding.application_id == app_b.id).all()
    disc_finding = next((f for f in findings if f.rule_code == "RULE-CROSS-LAND-001"), None)
    assert disc_finding is not None
    assert disc_finding.severity == "CRITICAL"
    assert disc_finding.finding_status == "FAIL"
    assert "0.65" in disc_finding.description or "1.85" in disc_finding.description


# =========================================================================
# Step 6: Authenticity Screening & Evidence-Linked Heatmaps
# =========================================================================
def test_step_6_authenticity_screening(e2e_fixture):
    db, _, _, applicant, _ = e2e_fixture
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant
    client = TestClient(app)

    # Create document with forensic findings
    test_doc = Document(
        id="doc-forensic-01",
        application_id="app-case-b",
        document_type="FIRE_NOC",
        file_name="fire_noc.pdf",
        storage_path="/tmp/fire.pdf",
        sha256_hash="sha256_clean_hash"
    )
    forensic = DocumentForensics(
        id="for-01",
        document_id=test_doc.id,
        ela_anomaly_score=12.5,
        metadata_mismatch_flag=False,
        metadata_dump={"Creator": "AutoCAD"},
        qr_detected=True,
        qr_payload={"text": "VERIFIED_FIRE_SAFETY_2026"},
        digital_signature_present=True,
        signature_valid=True,
        signer_identity="Fire Safety Officer",
        risk_level="LOW",
        remarks="Clear digital certificate with valid signature.",
        heatmap_generated=False,
        screening_results=[
            {"check_code": "AUTH_HASH_COLLISION", "check_name": "Cryptographic Hash", "state": "VERIFIED"}
        ]
    )
    db.add_all([test_doc, forensic])
    db.commit()

    res = client.get(f"/api/v1/documents/{test_doc.id}/forensics")
    assert res.status_code == 200
    auth_data = res.json()
    assert auth_data["risk_level"] == "LOW"
    assert auth_data["screening_results"] is not None
    assert auth_data["disclaimer"] is not None
    # Verify non-hallucination disclaimer is present
    assert "indicators" in auth_data["disclaimer"].lower()


# =========================================================================
# Step 7: Regulatory RAG Subsystem (Grounded Retrieval & Epistemic Guard)
# =========================================================================
def test_step_7_regulatory_rag(e2e_fixture):
    db, _, _, applicant, _ = e2e_fixture
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant
    client = TestClient(app)

    # 1. Grounded query on urban land norm
    rag_res = client.post("/api/v1/regulations/query", json={
        "query": "What is the minimum land requirement for engineering in urban areas?",
        "top_k": 3
    })
    assert rag_res.status_code == 200
    rag_data = rag_res.json()
    assert len(rag_data["retrieved_chunks"]) > 0
    top_chunk = rag_data["retrieved_chunks"][0]
    assert "clause_number" in top_chunk
    assert "AICTE" in top_chunk["source_name"]


# =========================================================================
# Step 8: Triage Assessment & Results Summary
# =========================================================================
def test_step_8_triage_assessment_results(e2e_fixture):
    db, _, _, applicant, _ = e2e_fixture
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant
    client = TestClient(app)

    test_app = Application(
        id="app-triage-test",
        applicant_id=applicant.id,
        application_number="APP-2026-TRIAGE",
        institution_name="Apex Institute",
        program_name="Civil",
        status="DEFICIENT"
    )
    summary = AssessmentSummary(
        id="sum-triage-test",
        application_id=test_app.id,
        authenticity_score=100.0,
        completeness_score=70.0,
        compliance_score=70.0,
        composite_score=80.5,
        recommendation="DEFICIENT"
    )
    db.add_all([test_app, summary])
    db.commit()

    res = client.get(f"/api/v1/applications/{test_app.id}")
    assert res.status_code == 200
    app_data = res.json()
    assert app_data["summary"] is not None
    assert app_data["summary"]["authenticity_score"] == 100.0
    assert app_data["summary"]["completeness_score"] == 70.0
    assert app_data["summary"]["compliance_score"] == 70.0


# =========================================================================
# Step 9: Compliance Copilot Chat (Grounding, Guardrails, Multilingual, RBAC)
# =========================================================================
def test_step_9_compliance_copilot_chat(e2e_fixture):
    db, _, _, applicant, applicant_other = e2e_fixture
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant
    client = TestClient(app)

    # Seed application with a finding
    chat_app = Application(
        id="app-chat-e2e",
        applicant_id=applicant.id,
        application_number="APP-2026-CHAT",
        institution_name="Apex Institute",
        status="DEFICIENT"
    )
    fnd = ComplianceFinding(
        id="fnd-chat-01",
        application_id=chat_app.id,
        rule_code="SYNTH-NORM-5.1.1",
        category="COMPLETENESS",
        severity="CRITICAL",
        title="Land Title vs Master Site Plan Area Discrepancy",
        description="Land Title Deed cites 2.50 Acres, but Master Site Plan cites 1.85 Acres.",
        finding_status="FAIL",
        status="OPEN"
    )
    db.add_all([chat_app, fnd])
    db.commit()

    # 1. Ask about current findings
    res = client.post(f"/api/v1/chat/{chat_app.id}?lang=en", json={
        "message": "Why is my application flagged for land discrepancy?"
    })
    assert res.status_code == 200
    chat_data = res.json()
    assert "5.1" in chat_data["message_text"] or "CROSS-DOCUMENT" in chat_data["message_text"].upper() or "land" in chat_data["message_text"].lower()

    # 2. Guardrail test: Promise/guarantee approval trap
    promise_res = client.post(f"/api/v1/chat/{chat_app.id}?lang=en", json={
        "message": "Can you promise and guarantee that our application will be approved?"
    })
    assert promise_res.status_code == 200
    promise_data = promise_res.json()
    assert "cannot promise" in promise_data["message_text"].lower() or "statutory notice" in promise_data["message_text"].lower()

    # 3. Multilingual test: Hindi response
    hi_res = client.post(f"/api/v1/chat/{chat_app.id}?lang=hi", json={
        "message": "भूमि नियम क्या हैं?"
    })
    assert hi_res.status_code == 200
    assert len(hi_res.json()["message_text"]) > 0

    # 4. Multi-tenant security check: Other applicant accessing chat_app
    app.dependency_overrides[get_current_user] = lambda: applicant_other
    forbidden_res = client.post(f"/api/v1/chat/{chat_app.id}?lang=en", json={
        "message": "What is the status?"
    })
    assert forbidden_res.status_code == 403


# =========================================================================
# Step 10: Reviewer Decision & Override (Immutability & Digital Seal)
# =========================================================================
def test_step_10_reviewer_decision_and_override(e2e_fixture):
    db, _, reviewer, applicant, _ = e2e_fixture
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: reviewer
    client = TestClient(app)

    rev_app = Application(
        id="app-rev-decide",
        applicant_id=applicant.id,
        application_number="APP-2026-DECIDE",
        institution_name="Apex Engineering College",
        status="PROCESSING"
    )
    finding = ComplianceFinding(
        id="fnd-rev-01",
        application_id=rev_app.id,
        rule_code="SYNTH-NORM-2.1.1",
        category="COMPLETENESS",
        severity="WARNING",
        title="Missing Architect Registration",
        description="Building plan lacks valid COA registration seal.",
        finding_status="FAIL",
        status="OPEN"
    )
    db.add_all([rev_app, finding])
    db.commit()

    # 1. Reviewer overrides finding with mandatory justification
    override_res = client.post(f"/api/v1/reviewer/applications/{rev_app.id}/override", json={
        "finding_id": finding.id,
        "status": "WAIVED",
        "justification": "Verified physical COA certificate copy on spot visit."
    })
    assert override_res.status_code == 200

    # Verify original finding_status remains FAIL (Immutability requirement)
    db.refresh(finding)
    assert finding.finding_status == "FAIL"
    assert finding.status == "WAIVED"
    assert finding.override_reason == "Verified physical COA certificate copy on spot visit."

    # 2. Reviewer records formal decision with digital seal
    decision_res = client.post(f"/api/v1/reviewer/applications/{rev_app.id}/decision", json={
        "decision": "APPROVED",
        "remarks": "All criteria verified and satisfactory.",
        "conditions_precedent": ["Submit original land deed within 30 days of intake."]
    })
    assert decision_res.status_code == 200
    dec_data = decision_res.json()
    assert dec_data["status"] in ["APPROVED", "success"]
    assert "digital_seal_hash" in dec_data
    assert len(dec_data["digital_seal_hash"]) == 64


# =========================================================================
# Step 11: PDF Statutory Report Generation & Download
# =========================================================================
def test_step_11_pdf_report_download(e2e_fixture):
    db, _, reviewer, applicant, _ = e2e_fixture
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: reviewer
    app.dependency_overrides[get_current_user_optional] = lambda: reviewer
    client = TestClient(app)

    pdf_app = Application(
        id="app-pdf-download",
        applicant_id=applicant.id,
        application_number="APP-2026-PDF",
        institution_name="Apex Institute of Technology",
        program_name="Computer Science & Engineering",
        status="APPROVED"
    )
    db.add(pdf_app)
    db.commit()

    report_res = client.get(f"/api/v1/reports/{pdf_app.id}/pdf")
    assert report_res.status_code == 200
    assert report_res.headers["content-type"] == "application/pdf"
    assert report_res.content.startswith(b"%PDF-")


# =========================================================================
# Step 12: Audit Log & Tamper-Chain Verification
# =========================================================================
def test_step_12_audit_log_and_tamper_chain(e2e_fixture):
    db, admin, _, applicant, _ = e2e_fixture
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: admin
    client = TestClient(app)

    audit_app = Application(
        id="app-audit-test",
        applicant_id=applicant.id,
        application_number="APP-2026-AUDIT",
        institution_name="Apex Institute",
        status="SUBMITTED"
    )
    db.add(audit_app)
    db.commit()

    # Query audit logs for application
    logs_res = client.get(f"/api/v1/audit/applications/{audit_app.id}")
    assert logs_res.status_code == 200

    # Cryptographic chain verification
    verify_res = client.get(f"/api/v1/audit/applications/{audit_app.id}/verify-chain")
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["chain_valid"] is True
