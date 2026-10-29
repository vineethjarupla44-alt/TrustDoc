import pytest
import logging
from datetime import datetime, timezone
from pydantic import ValidationError
from backend.app.core.database import Base, SessionLocal, engine
from backend.app.core.security import generate_document_access_token, verify_document_access_token
from backend.app.core.masking import SensitiveContentLogFilter, mask_text
from backend.app.models.models import (
    User, Application, Document, ExtractedField, ValidationRule, RuleVersion,
    AuthenticityFinding, ComplianceFinding, ReviewerDecision, ApplicationAuditEvent, ReportMetadata
)
from backend.app.schemas.schemas import (
    ApplicationCreate, AssessmentSummaryResponse, ReviewerOverrideRequest, ProblemDetailResponse
)
from backend.app.api.v1.endpoints.audit import compute_event_hash

# Ensure all database tables exist in test session
Base.metadata.create_all(bind=engine)

def test_pydantic_validation_rules_and_error_constraints():
    # Valid academic year pattern: 2026-2027
    app_in = ApplicationCreate(
        institution_name="Apex Institute of Technology",
        program_name="Undergraduate Engineering & Technology",
        institution_type="Private / Self-Financed",
        state="Delhi",
        district="New Delhi",
        academic_year="2026-2027"
    )
    assert app_in.academic_year == "2026-2027"

    # Invalid academic year pattern should raise ValidationError
    with pytest.raises(ValidationError):
        ApplicationCreate(
            institution_name="Apex Institute",
            state="Delhi",
            district="New Delhi",
            academic_year="invalid-year"
        )

    # Score bounds validation: ge=0.0, le=100.0
    with pytest.raises(ValidationError):
        AssessmentSummaryResponse(
            id="test-id",
            application_id="app-id",
            authenticity_score=105.0,  # Exceeds max 100.0
            completeness_score=80.0,
            compliance_score=85.0,
            composite_score=90.0,
            recommendation="ELIGIBLE",
            evaluated_at=datetime.now(timezone.utc)
        )

    # Reviewer override justification length constraint (min 10 chars)
    with pytest.raises(ValidationError):
        ReviewerOverrideRequest(
            finding_id="12345678-1234-1234-1234-123456789012",
            status="WAIVED",
            justification="Too short"  # < 10 characters
        )

def test_secure_document_access_tokens():
    doc_id = "doc-uuid-987654"
    user_id = "user-uuid-123456"

    token = generate_document_access_token(doc_id, user_id, expires_in_seconds=60)
    assert isinstance(token, str)

    # Valid token verification
    payload = verify_document_access_token(token, doc_id)
    assert payload is not None
    assert payload["sub"] == user_id
    assert payload["doc_id"] == doc_id
    assert payload["scope"] == "doc_access"

    # Token should be rejected for wrong document ID
    wrong_payload = verify_document_access_token(token, "different-doc-id")
    assert wrong_payload is None

def test_cryptographic_audit_chain():
    app_id = "app-audit-test-1"
    evt1_id = "evt-1"
    ts1 = datetime.now(timezone.utc).isoformat()
    h1 = compute_event_hash(evt1_id, app_id, "APPLICATION_CREATE", "user-1", ts1, None)
    assert len(h1) == 64

    # Second chained event
    evt2_id = "evt-2"
    ts2 = datetime.now(timezone.utc).isoformat()
    h2 = compute_event_hash(evt2_id, app_id, "DOCUMENT_UPLOAD", "user-1", ts2, h1)
    assert len(h2) == 64
    assert h2 != h1

    # Tampering check: altering previous hash alters the chained hash
    tampered_h2 = compute_event_hash(evt2_id, app_id, "DOCUMENT_UPLOAD", "user-1", ts2, "tampered_prev_hash")
    assert tampered_h2 != h2

def test_zero_knowledge_privacy_filter():
    log_filter = SensitiveContentLogFilter()

    # Test record with sensitive PAN and Aadhaar
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg="Processing applicant with Aadhaar 9876 5432 1098 and PAN ABCDE1234F",
        args=(),
        exc_info=None
    )
    log_filter.filter(record)
    assert "9876 5432" not in record.msg
    assert "XXXX-XXXX-1098" in record.msg
    assert "ABCDE" not in record.msg
    assert "XXXXX1234F" in record.msg

    # Test large OCR text truncation
    huge_ocr_text = "D" * 2000
    record_large = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg=huge_ocr_text,
        args=(),
        exc_info=None
    )
    log_filter.filter(record_large)
    assert len(record_large.msg) <= 1050
    assert "[TRUNCATED FOR PRIVACY]" in record_large.msg

def test_relational_models_persistence():
    db = SessionLocal()
    try:
        # Create user
        user = User(
            email=f"tester_{datetime.now().timestamp()}@institution.edu",
            password_hash="hashed_pw",
            full_name="Prof. Tester",
            role="APPLICANT"
        )
        db.add(user)
        db.flush()

        # Create application
        app = Application(
            applicant_id=user.id,
            application_number=f"APP-TEST-{datetime.now().timestamp()}",
            institution_name="Test College of Engineering",
            state="Maharashtra",
            district="Pune"
        )
        db.add(app)
        db.flush()

        # Create document
        doc = Document(
            application_id=app.id,
            document_type="LAND_DEED",
            file_name="land_title.pdf",
            storage_path="/tmp/land_title.pdf",
            sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            file_size_bytes=1048576,
            mime_type="application/pdf"
        )
        db.add(doc)
        db.flush()

        # Create normalized extracted field
        field = ExtractedField(
            document_id=doc.id,
            field_key="land_area_acres",
            field_value_normalized="3.50",
            field_value_raw="Three point five zero acres",
            data_type="float",
            confidence_score=98.5
        )
        db.add(field)

        # Create reviewer decision
        decision = ReviewerDecision(
            application_id=app.id,
            reviewer_id=user.id,
            decision="APPROVED",
            statutory_notes="All norms verified and validated against statutory handbook.",
            deficiencies_json=[],
            stipulated_conditions_json=["Submit annual progress report"]
        )
        db.add(decision)

        # Create report metadata
        report = ReportMetadata(
            application_id=app.id,
            report_type="PDF_SUMMARY",
            file_path="/tmp/dossier.pdf",
            sha256_hash="f" * 64,
            file_size_bytes=204800,
            generated_by_id=user.id
        )
        db.add(report)

        db.commit()

        # Verify query and relationships
        queried_app = db.query(Application).filter(Application.id == app.id).first()
        assert queried_app is not None
        assert len(queried_app.documents) == 1
        assert len(queried_app.documents[0].extracted_fields) == 1
        assert queried_app.documents[0].extracted_fields[0].field_key == "land_area_acres"
        assert len(queried_app.decisions) == 1
        assert queried_app.decisions[0].decision == "APPROVED"
        assert len(queried_app.reports) == 1

    finally:
        db.close()
