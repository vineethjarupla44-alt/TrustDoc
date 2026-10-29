import io
import fitz  # PyMuPDF to parse and inspect generated PDF structure
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.database import Base, get_db
from backend.app.core.security import get_current_user, get_current_user_optional
from backend.app.services.pdf_report import PDFReportGenerator, NumberedCanvas
from backend.app.models.models import (
    Application, Document, AssessmentSummary, ComplianceFinding, AuthenticityFinding, User, ReportMetadata
)

from sqlalchemy.pool import StaticPool

@pytest.fixture
def test_db_and_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    # Seed mock user
    user = User(
        id="usr-test-101",
        email="scrutiny.officer@aicte.gov.in",
        full_name="Dr. S. K. Sharma",
        role="REVIEWER",
        password_hash="mockhashedpassword"
    )
    db.add(user)

    # Seed mock application
    app_record = Application(
        id="app-test-report-01",
        applicant_id="usr-test-101",
        application_number="APP-2026-DELHI-001",
        institution_name="Delhi Technical Institute of Engineering",
        program_name="Undergraduate Engineering (B.Tech)",
        institution_type="Private / Self-Financed",
        state="Delhi",
        district="New Delhi",
        academic_year="2026-2027",
        status="PROCESSING"
    )
    db.add(app_record)

    summary = AssessmentSummary(
        application_id=app_record.id,
        authenticity_score=95.0,
        completeness_score=90.0,
        compliance_score=92.0,
        composite_score=92.45,
        recommendation="ELIGIBLE"
    )
    db.add(summary)

    doc = Document(
        id="doc-report-01",
        application_id=app_record.id,
        document_type="LAND_DEED",
        file_name="Title_Deed_Delhi.pdf",
        storage_path="/mock/path/Title_Deed_Delhi.pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        extraction_status="SUCCESS"
    )
    db.add(doc)

    forensics = AuthenticityFinding(
        document_id=doc.id,
        ela_anomaly_score=14.2,
        metadata_mismatch_flag=False,
        qr_detected=True,
        digital_signature_present=True,
        risk_level="LOW",
        heatmap_generated=False
    )
    db.add(forensics)

    finding = ComplianceFinding(
        application_id=app_record.id,
        source_document_id=doc.id,
        rule_code="SYNTH-NORM-1.1.1",
        category="COMPLIANCE",
        severity="INFO",
        title="Land Requirement Conformance",
        description="Contiguous land area exceeds minimum 2.50 acres required for urban territory.",
        evidence_quote="Extracted land area: 2.85 Acres",
        suggested_remediation="No remediation required. Norm is fully satisfied.",
        status="OPEN",
        finding_status="PASS"
    )
    db.add(finding)
    db.commit()

    # Configure FastAPI dependency overrides
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_user_optional] = lambda: user

    client = TestClient(app)
    yield db, client, app_record.id

    # Teardown
    app.dependency_overrides.clear()
    db.close()


@pytest.fixture
def sample_report_payload():
    return {
        "application_number": "APP-2026-REG-TEST",
        "institution_name": "National Technical Institute of Delhi",
        "program_name": "Undergraduate B.Tech Computer Science & Engineering",
        "institution_type": "Private / Self-Financed",
        "state": "Delhi NCR (Urban Territory)",
        "evaluation_date": "26-Oct-2026 00:30 UTC",
        "summary": {
            "authenticity_score": 94.5,
            "completeness_score": 88.0,
            "compliance_score": 92.0,
            "composite_score": 91.68,
            "recommendation": "ELIGIBLE"
        },
        "documents": [
            {
                "document_type": "LAND_DEED",
                "file_name": "Registered_Land_Title_Deed.pdf",
                "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "extraction_status": "SUCCESS",
                "forensics": {
                    "ela_anomaly_score": 12.4,
                    "metadata_mismatch_flag": False,
                    "qr_detected": True,
                    "digital_signature_present": True,
                    "risk_level": "LOW",
                    "heatmap_generated": False,
                    "heatmap_path": None
                }
            },
            {
                "document_type": "BUILDING_PLAN",
                "file_name": "Architect_Sanctioned_Master_Plan.pdf",
                "sha256_hash": "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
                "extraction_status": "SUCCESS",
                "forensics": {
                    "ela_anomaly_score": 42.1,
                    "metadata_mismatch_flag": True,
                    "qr_detected": False,
                    "digital_signature_present": False,
                    "risk_level": "HIGH",
                    "heatmap_generated": True,
                    "heatmap_path": "/data/heatmaps/plan_heatmap.png"
                }
            }
        ],
        "extracted_uncertainties": [
            {
                "field_key": "Survey Number Bounds",
                "state": "DETECTED",
                "value": "42/1B Kondapur Sub-division",
                "confidence": 62.5
            }
        ],
        "findings": [
            {
                "category": "COMPLIANCE",
                "severity": "CRITICAL",
                "rule_code": "SYNTH-NORM-1.1.1",
                "title": "Minimum Contiguous Land Extent Norm",
                "description": "Urban territory requires minimum 2.50 contiguous acres.",
                "evidence_quote": "Extracted acreage 2.85 Acres on Page 2.",
                "suggested_remediation": "Provide registered encumbrance certificate verifying title continuity.",
                "status": "OPEN",
                "finding_status": "PASS",
                "source_field_ref": {"page_number": 2}
            },
            {
                "category": "AUTHENTICITY",
                "severity": "WARNING",
                "rule_code": "SYNTH-NORM-6.1.2",
                "title": "Editing Software Metadata Footprint",
                "description": "Detected Adobe Photoshop CS6 creator tool in building plan metadata.",
                "evidence_quote": "Producer: Adobe Photoshop CS6 (Windows) Page 1.",
                "suggested_remediation": "Submit original vector CAD export directly from licensed Architect.",
                "status": "OPEN",
                "finding_status": "WARNING",
                "source_field_ref": {"page_number": 1}
            }
        ],
        "reviewer_decision": {
            "decision": "ELIGIBLE",
            "statutory_notes": "Preliminary documentary scrutiny cleared subject to submission of vector CAD plans.",
            "recorded_at": "2026-10-26T00:30:00Z",
            "ip_address": "127.0.0.1",
            "digital_seal_hash": "7f9a12c8e3b4a5d6f7890123456789abcdef0123456789abcdef0123456789ab"
        }
    }


def test_pdf_report_generator_binary_validity(sample_report_payload):
    """Verifies that PDFReportGenerator produces a valid, multi-page PDF document."""
    pdf_bytes = PDFReportGenerator.generate_application_report(sample_report_payload)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 2000
    assert pdf_bytes.startswith(b"%PDF-")

    # Inspect PDF structure using PyMuPDF
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    assert doc.page_count >= 1

    # Extract text from all pages to verify required statutory content
    full_text = ""
    for page in doc:
        full_text += page.get_text()

    # Statutory Identifiers & Metadata
    assert "TrustDoc" in full_text or "ComplianceAI" in full_text
    assert "TRUSTDOC-2026" in full_text or "SIH26261" in full_text
    assert "APP-2026-REG-TEST" in full_text
    assert "National Technical Institute of Delhi" in full_text
    assert "AICTE APH 2026" in full_text

    # All 4 Pillars Separated
    assert "Pillar 1" in full_text and "Document Authenticity" in full_text
    assert "Pillar 2" in full_text and "Completeness" in full_text
    assert "Pillar 3" in full_text and "Regulatory Compliance" in full_text
    assert "Pillar 4" in full_text and "Reviewer Decision" in full_text

    # Triage Formula & Epistemic Disclaimer
    assert "Composite Triage Score" in full_text
    assert "0.35" in full_text
    assert "0.30" in full_text
    clean_text = " ".join(full_text.lower().split())
    assert "neither a probability of fraud nor a legal conclusion" in clean_text

    # Rule References & Remediations
    assert "SYNTH-NORM-1.1.1" in full_text
    assert "SYNTH-NORM-6.1.2" in full_text
    assert "Remediation:" in full_text

    # Limitations & Forensic Boundaries
    assert "Algorithmic Forensics Boundary" in full_text
    assert "Error Level Analysis" in full_text


def test_triage_tier_classification_logic():
    """Validates priority tier classification mathematics and edge conditions."""
    # Routine clearance: Composite >= 90 and no critical authenticity flags
    tier_name, color, desc = PDFReportGenerator.calculate_priority_tier(composite=94.5, has_critical_authenticity=False)
    assert tier_name == "ROUTINE CLEARANCE CANDIDATE"
    assert color == "#059669"

    # Moderate priority: 70 <= Composite < 90
    tier_name_med, color_med, _ = PDFReportGenerator.calculate_priority_tier(composite=82.0, has_critical_authenticity=False)
    assert tier_name_med == "MODERATE / MEDIUM PRIORITY"
    assert color_med == "#D97706"

    # Critical priority: Composite < 70
    tier_name_crit, color_crit, _ = PDFReportGenerator.calculate_priority_tier(composite=68.5, has_critical_authenticity=False)
    assert tier_name_crit == "CRITICAL / HIGH PRIORITY"
    assert color_crit == "#DC2626"

    # Critical priority: Critical Authenticity Flag overrides high composite score
    tier_name_flagged, color_flagged, _ = PDFReportGenerator.calculate_priority_tier(composite=95.0, has_critical_authenticity=True)
    assert tier_name_flagged == "CRITICAL / HIGH PRIORITY"
    assert color_flagged == "#DC2626"


def test_reports_api_generate_and_download_endpoints(test_db_and_client):
    """Tests POST /reports/{id}/generate and GET /reports/{id}/pdf with database integration."""
    db, client, app_id = test_db_and_client

    # 1. Test POST /api/v1/reports/{application_id}/generate
    res_gen = client.post(f"/api/v1/reports/{app_id}/generate")
    assert res_gen.status_code == 200
    meta_data = res_gen.json()
    assert meta_data["application_id"] == app_id
    assert meta_data["report_type"] == "PDF_SUMMARY"
    assert meta_data["status"] == "READY"
    assert len(meta_data["sha256_hash"]) == 64
    assert meta_data["file_size_bytes"] > 0

    # 2. Test GET /api/v1/reports/{application_id}/pdf
    res_pdf = client.get(f"/api/v1/reports/{app_id}/pdf")
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in res_pdf.headers["content-disposition"]
    assert res_pdf.headers.get("x-report-sha256") == meta_data["sha256_hash"]
    assert res_pdf.content.startswith(b"%PDF-")

    # 3. Test GET /api/v1/reports/{application_id}/metadata
    res_meta = client.get(f"/api/v1/reports/{app_id}/metadata")
    assert res_meta.status_code == 200
    assert res_meta.json()["sha256_hash"] == meta_data["sha256_hash"]
