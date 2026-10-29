import io
import uuid
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.database import SessionLocal
from backend.app.core.security import get_current_user
from backend.app.models.models import (
    User, Application, Document, ExtractedField, ApplicationAuditEvent
)
from backend.app.services.ocr_service import OCRService
from backend.app.services.extractor_service import ExtractorService

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_test_data():
    db = SessionLocal()
    # Create test applicant user
    test_user = db.query(User).filter(User.email == "doc_test_user@compliance.gov.in").first()
    if not test_user:
        test_user = User(
            email="doc_test_user@compliance.gov.in",
            password_hash="argon2_fake_hash",
            full_name="Document Tester",
            role="APPLICANT",
            institution_name="Test Engineering Academy"
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user)

    # Create test application
    test_app = db.query(Application).filter(Application.application_number == "DOC-TEST-2026-001").first()
    if not test_app:
        test_app = Application(
            applicant_id=test_user.id,
            application_number="DOC-TEST-2026-001",
            program_name="Computer Science & Engineering",
            institution_type="Private / Self-Financed",
            state="Maharashtra",
            district="Pune",
            status="DRAFT"
        )
        db.add(test_app)
        db.commit()
        db.refresh(test_app)

    app.dependency_overrides[get_current_user] = lambda: test_user
    yield {"user_id": test_user.id, "app_id": test_app.id}
    app.dependency_overrides.pop(get_current_user, None)
    db.close()

def test_upload_rejection_for_unsupported_extension(setup_test_data):
    """Workflow requirement 1: Reject unsupported extensions."""
    app_id = setup_test_data["app_id"]
    fake_exe = io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00")
    response = client.post(
        f"/api/v1/documents/upload/{app_id}",
        data={"document_type": "LAND_DOCUMENTS"},
        files={"file": ("malicious.exe", fake_exe, "application/x-msdownload")}
    )
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]

def test_upload_rejection_for_mismatched_magic_bytes(setup_test_data):
    """Workflow requirement 1: Reject file with spoofed extension."""
    app_id = setup_test_data["app_id"]
    fake_pdf = io.BytesIO(b"NOT_A_REAL_PDF_HEADER_CONTENT")
    response = client.post(
        f"/api/v1/documents/upload/{app_id}",
        data={"document_type": "LAND_DOCUMENTS"},
        files={"file": ("spoofed.pdf", fake_pdf, "application/pdf")}
    )
    assert response.status_code == 400
    assert "File content signature does not match" in response.json()["detail"]

def test_extractor_four_state_taxonomy():
    """Workflow requirement 9: Distinguish extraction failures from actual missing info."""
    # 1. Text with clear fields
    sample_land_text = """
    REGISTERED SALE DEED
    Institution Name: Apex Institute of Technology
    Total Land Area: 3.50 Acres
    Registration No: REG-LAND-2024-9981
    Executed Date: 15/03/2021
    """
    pages_data = [{
        "page_number": 1,
        "text": sample_land_text,
        "ocr_confidence": 0.98,
        "blocks": [
            {"text": "Apex Institute of Technology", "bbox": [100, 200, 300, 220]},
            {"text": "3.50 Acres", "bbox": [100, 250, 200, 270]}
        ]
    }]

    result = ExtractorService.extract_entities_with_provenance(
        "LAND_DOCUMENTS",
        sample_land_text,
        pages_data=pages_data,
        ocr_engine="PYMUPDF"
    )

    atomic = {f["field_key"]: f for f in result["atomic_fields"]}
    
    # Institution name should be DETECTED with provenance
    assert atomic["institution_name"]["state"] == "DETECTED"
    assert atomic["institution_name"]["page_number"] == 1
    assert atomic["institution_name"]["confidence_score"] >= 0.70

    # Land area should be DETECTED
    assert atomic["land_area_acres"]["state"] == "DETECTED"
    assert float(atomic["land_area_acres"]["field_value_normalized"]) == 3.50

    # Missing mandatory field: surveyor_name was not in text
    assert atomic["surveyor_name"]["state"] == "MISSING_IN_DOCUMENT"
    assert atomic["surveyor_name"]["field_value_normalized"] is None

    # 2. Complete extraction failure (e.g. illegible or empty text)
    failed_result = ExtractorService.extract_entities_with_provenance(
        "LAND_DOCUMENTS",
        "",
        pages_data=[],
        ocr_engine="TESSERACT_OCR"
    )
    for field in failed_result["atomic_fields"]:
        assert field["state"] == "EXTRACTION_FAILED"

def test_document_status_and_field_correction_api(setup_test_data):
    """Workflow requirements 7, 8, 10: Status check, field correction, and audit chain."""
    db = SessionLocal()
    app_id = setup_test_data["app_id"]
    user_id = setup_test_data["user_id"]

    # Insert a synthetic document with extracted fields
    doc = Document(
        application_id=app_id,
        document_type="AFFILIATION_LETTERS",
        file_name="aff_letter_2026.pdf",
        storage_path="synthetic/path.pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        file_size_bytes=409600,
        mime_type="application/pdf",
        extraction_status="SUCCESS"
    )
    db.add(doc)
    db.flush()

    # Add a field with LOW confidence
    field_failing = ExtractedField(
        document_id=doc.id,
        field_key="affiliating_university",
        label="Affiliating University",
        field_value_normalized="Univ of Tech",
        field_value_raw="Univ of Tech",
        data_type="string",
        confidence_score=0.62,
        page_number=1,
        ocr_engine="PYMUPDF",
        state="DETECTED"
    )
    # Add a missing field
    field_missing = ExtractedField(
        document_id=doc.id,
        field_key="valid_until_year",
        label="Validity Period",
        field_value_normalized=None,
        field_value_raw=None,
        data_type="string",
        confidence_score=0.0,
        page_number=1,
        ocr_engine="PYMUPDF",
        state="MISSING_IN_DOCUMENT"
    )
    db.add_all([field_failing, field_missing])
    db.commit()
    db.refresh(doc)
    db.refresh(field_failing)

    # 1. Test GET /documents/{id}/status
    status_res = client.get(f"/api/v1/documents/{doc.id}/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["document_id"] == doc.id
    assert status_data["status"] == "EXTRACTED"
    assert status_data["fields_extracted_count"] == 1
    assert status_data["fields_missing_count"] == 1
    assert status_data["needs_manual_review"] is True

    # 2. Test GET /documents/{id}/fields
    fields_res = client.get(f"/api/v1/documents/{doc.id}/fields")
    assert fields_res.status_code == 200
    fields_list = fields_res.json()
    assert len(fields_list) == 2

    # 3. Test PATCH /documents/{id}/fields/{field_id} (Manual correction)
    patch_res = client.patch(
        f"/api/v1/documents/{doc.id}/fields/{field_failing.id}",
        json={
            "corrected_value": "Savitribai Phule Pune University",
            "correction_reason": "Corrected abbreviated name to official statutory university title."
        }
    )
    assert patch_res.status_code == 200
    corrected_data = patch_res.json()
    assert corrected_data["field_value_normalized"] == "Savitribai Phule Pune University"
    assert corrected_data["is_manually_corrected"] is True
    assert corrected_data["state"] == "MANUALLY_ENTERED"
    assert "official statutory university title" in corrected_data["correction_reason"]

    # 4. Verify immutable audit log creation
    audit_event = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == app_id,
        ApplicationAuditEvent.action == "FIELD_CORRECTION"
    ).order_by(ApplicationAuditEvent.timestamp.desc()).first()

    assert audit_event is not None
    assert audit_event.diff_payload["field_key"] == "affiliating_university"
    assert audit_event.diff_payload["new_value"] == "Savitribai Phule Pune University"
    assert audit_event.event_hash is not None
    assert len(audit_event.event_hash) == 64  # SHA-256 hash length

    db.close()
