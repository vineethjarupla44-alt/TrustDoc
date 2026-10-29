import pytest
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from backend.app.services.validation_engine import (
    ValidationEngine, ValidationStatus, FindingCategory, RuleSeverity,
    ValidationEngineConfig, default_config
)
from backend.app.services.validation_engine.modules.required_docs_fields import RequiredDocsAndFieldsValidator
from backend.app.services.validation_engine.modules.field_format import FieldFormatValidator
from backend.app.services.validation_engine.modules.date_expiry import DateAndExpiryValidator
from backend.app.services.validation_engine.modules.duplicate_detection import DuplicateDetectionValidator
from backend.app.services.validation_engine.modules.cross_document import CrossDocumentValidator
from backend.app.services.validation_engine.modules.identity_consistency import IdentityConsistencyValidator
from backend.app.services.validation_engine.modules.category_requirements import CategoryRequirementsValidator

# Helper to build mock documents
def make_mock_doc(doc_id, doc_type, file_name, sha256, fields_dict=None):
    extracted_fields = []
    if fields_dict:
        for k, v in fields_dict.items():
            if isinstance(v, dict):
                extracted_fields.append(SimpleNamespace(
                    id=f"f-{k}",
                    field_key=k,
                    label=k.replace("_", " ").title(),
                    field_value_normalized=v.get("val"),
                    field_value_raw=v.get("val"),
                    confidence_score=v.get("conf", 0.95),
                    state=v.get("state", "DETECTED"),
                    page_number=v.get("page", 1),
                    bounding_box=v.get("bbox", None)
                ))
            else:
                extracted_fields.append(SimpleNamespace(
                    id=f"f-{k}",
                    field_key=k,
                    label=k.replace("_", " ").title(),
                    field_value_normalized=str(v) if v is not None else None,
                    field_value_raw=str(v) if v is not None else None,
                    confidence_score=0.95,
                    state="DETECTED" if v is not None else "MISSING_IN_DOCUMENT",
                    page_number=1,
                    bounding_box=None
                ))

    return SimpleNamespace(
        id=doc_id,
        document_type=doc_type,
        file_name=file_name,
        sha256_hash=sha256,
        file_size_bytes=102400,
        extracted_fields=extracted_fields,
        extracted_entities=SimpleNamespace(
            structured_fields={f.field_key: f.field_value_normalized for f in extracted_fields},
            confidence_score=0.95,
            ocr_engine="PYMUPDF"
        ),
        forensics=None
    )

def test_module1_required_documents_and_fields():
    """Module 1: Missing documents and fields should produce FAIL / NEEDS_REVIEW appropriately."""
    app = SimpleNamespace(id="app-1", program_name="Engineering & Technology", institution_type="Private")

    # Incomplete bundle: Only LAND_DEED uploaded; BUILDING_PLAN, FIRE_NOC, FACULTY_LIST missing
    doc_land = make_mock_doc("d1", "LAND_DEED", "deed.pdf", "hash1", {
        "land_area_acres": "3.50",
        "deed_number": "REG-2024-99",
        # registration_date is missing
    })

    findings = RequiredDocsAndFieldsValidator.validate(app, [doc_land], default_config)
    
    # Missing documents checks
    doc_fails = [f for f in findings if f.status == ValidationStatus.FAIL and "Mandatory Document Presence" in f.rule_name]
    assert any("Fire Noc" in f.rule_name for f in doc_fails)
    assert any("Building Plan" in f.rule_name for f in doc_fails)

    # Missing field check: registration_date in LAND_DEED
    field_fails = [f for f in findings if f.status == ValidationStatus.FAIL and "registration_date" in f.rule_id]
    assert len(field_fails) == 1
    assert field_fails[0].severity == RuleSeverity.CRITICAL

def test_module2_field_format_validation():
    """Module 2: Field format checks on COA regex and numeric bounds."""
    app = SimpleNamespace(id="app-1", program_name="Engineering & Technology")

    # Valid COA
    doc_valid = make_mock_doc("d2", "BUILDING_PLAN", "plan.pdf", "hash2", {
        "coa_registration_no": {"val": "CA/2014/59102", "conf": 0.95},
        "total_plot_area_acres": "3.50"
    })
    findings_valid = FieldFormatValidator.validate(app, [doc_valid], default_config)
    coa_pass = [f for f in findings_valid if f.rule_id == "RULE-FMT-COA-001"]
    assert len(coa_pass) == 1
    assert coa_pass[0].status == ValidationStatus.PASS

    # Malformed COA
    doc_bad = make_mock_doc("d3", "BUILDING_PLAN", "plan.pdf", "hash3", {
        "coa_registration_no": {"val": "INVALID-COA-STRING", "conf": 0.95},
        "total_plot_area_acres": "-5.0"  # Negative area
    })
    findings_bad = FieldFormatValidator.validate(app, [doc_bad], default_config)
    coa_fail = [f for f in findings_bad if f.rule_id == "RULE-FMT-COA-001"]
    assert len(coa_fail) == 1
    assert coa_fail[0].status == ValidationStatus.FAIL

    land_fail = [f for f in findings_bad if f.rule_id == "RULE-FMT-LAND-002"]
    assert len(land_fail) == 1
    assert land_fail[0].status == ValidationStatus.FAIL

def test_module3_date_and_expiry_validation():
    """Module 3: Active validity, expired Fire NOC, and future-dated deed checks."""
    app = SimpleNamespace(id="app-1", program_name="Engineering & Technology")
    now = datetime.now(timezone.utc)

    # 1. Expired Fire NOC
    expired_date_str = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    doc_fire_expired = make_mock_doc("d4", "FIRE_NOC", "fire.pdf", "hash4", {
        "valid_until_date": expired_date_str
    })
    findings_exp = DateAndExpiryValidator.validate(app, [doc_fire_expired], default_config)
    exp_f = [f for f in findings_exp if f.rule_id == "RULE-EXP-FIRE-001"][0]
    assert exp_f.status == ValidationStatus.FAIL
    assert "Lapsed" in exp_f.evidence

    # 2. Approaching Expiry (within 60 days)
    warning_date_str = (now + timedelta(days=25)).strftime("%Y-%m-%d")
    doc_fire_warn = make_mock_doc("d5", "FIRE_NOC", "fire.pdf", "hash5", {
        "valid_until_date": warning_date_str
    })
    findings_warn = DateAndExpiryValidator.validate(app, [doc_fire_warn], default_config)
    warn_f = [f for f in findings_warn if f.rule_id == "RULE-EXP-FIRE-001"][0]
    assert warn_f.status == ValidationStatus.WARNING

    # 3. Future-dated deed
    future_date_str = (now + timedelta(days=100)).strftime("%Y-%m-%d")
    doc_future_deed = make_mock_doc("d6", "LAND_DEED", "deed.pdf", "hash6", {
        "registration_date": future_date_str
    })
    findings_future = DateAndExpiryValidator.validate(app, [doc_future_deed], default_config)
    future_f = [f for f in findings_future if f.rule_id == "RULE-EXP-DEED-002"][0]
    assert future_f.status == ValidationStatus.FAIL
    assert "in the future" in future_f.explanation

def test_module4_duplicate_detection():
    """Module 4: Intra-bundle duplicate document SHA-256 detection."""
    app = SimpleNamespace(id="app-1", program_name="Engineering & Technology")

    # Duplicate file uploaded for both LAND_DEED and BUILDING_PLAN
    shared_hash = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    doc1 = make_mock_doc("d10", "LAND_DEED", "file1.pdf", shared_hash)
    doc2 = make_mock_doc("d11", "BUILDING_PLAN", "file2.pdf", shared_hash)

    findings = DuplicateDetectionValidator.validate(app, [doc1, doc2], default_config)
    dup_f = [f for f in findings if f.rule_id == "RULE-DUP-INTRA-001"][0]
    assert dup_f.status == ValidationStatus.FAIL
    assert dup_f.severity == RuleSeverity.CRITICAL

def test_module5_cross_document_comparisons():
    """Module 5: Cross-document land acreage tolerance and SFR ratio."""
    app = SimpleNamespace(id="app-1", program_name="Engineering & Technology")

    # Mismatch: Deed 3.50 Acres vs Plan 2.50 Acres (Variance 1.00 > 0.05 tolerance)
    doc_deed = make_mock_doc("d20", "LAND_DEED", "deed.pdf", "h20", {"land_area_acres": "3.50"})
    doc_plan = make_mock_doc("d21", "BUILDING_PLAN", "plan.pdf", "h21", {"total_plot_area_acres": "2.50"})
    doc_fac = make_mock_doc("d22", "FACULTY_LIST", "fac.pdf", "h22", {
        "student_count": "600",
        "total_faculty": "30"  # SFR 1:20.0 (violates Engineering 1:15 max)
    })

    findings = CrossDocumentValidator.validate(app, [doc_deed, doc_plan, doc_fac], default_config)
    
    land_cross = [f for f in findings if f.rule_id == "RULE-CROSS-LAND-001"][0]
    assert land_cross.status == ValidationStatus.FAIL
    assert "Variance: 1.00 Acres" in land_cross.evidence

    sfr_cross = [f for f in findings if f.rule_id == "RULE-CROSS-SFR-002"][0]
    assert sfr_cross.status == ValidationStatus.FAIL
    assert "Resulting SFR: 1:20.0" in sfr_cross.evidence

def test_module6_ocr_uncertainty_guardrail():
    """Module 6: Strict OCR uncertainty guardrail - low confidence extractions are NEVER marked as FAIL."""
    app = SimpleNamespace(
        id="app-1",
        institution_name="Apex Institute of Technology, Pune",
        program_name="Engineering & Technology"
    )

    # 1. High-confidence mismatch -> FAIL
    doc_mismatch_high_conf = make_mock_doc("d30", "LAND_DEED", "deed.pdf", "h30", {
        "institution_name": {"val": "Completely Different College Trust", "conf": 0.95}
    })
    findings_high = IdentityConsistencyValidator.validate(app, [doc_mismatch_high_conf], default_config)
    f_high = [f for f in findings_high if "RULE-ID-NAME" in f.rule_id][0]
    assert f_high.status == ValidationStatus.FAIL

    # 2. Low-confidence mismatch -> NEVER FAIL! Must be NEEDS_REVIEW
    doc_mismatch_low_conf = make_mock_doc("d31", "LAND_DEED", "deed.pdf", "h31", {
        "institution_name": {"val": "Ap3x 1nst1tute", "conf": 0.58}  # Low OCR confidence < 0.70
    })
    findings_low = IdentityConsistencyValidator.validate(app, [doc_mismatch_low_conf], default_config)
    f_low = [f for f in findings_low if "RULE-ID-NAME" in f.rule_id][0]
    
    # Statutory guardrail assertion:
    assert f_low.status == ValidationStatus.NEEDS_REVIEW
    assert f_low.status != ValidationStatus.FAIL
    assert "low" in f_low.explanation.lower()

def test_module7_category_requirements():
    """Module 7: Statutory discipline norms (e.g. Engineering min 2.50 acres)."""
    app = SimpleNamespace(
        id="app-1",
        program_name="Engineering & Technology",
        institution_type="Private / Self-Financed"
    )

    # Deficit: 2.10 acres (< 2.50 acres)
    doc_deficit = make_mock_doc("d40", "LAND_DEED", "deed.pdf", "h40", {
        "land_area_acres": "2.10",
        "professors": "2",
        "principal_name": "Dr. S. K. Sharma"
    })
    findings_def = CategoryRequirementsValidator.validate(app, [doc_deficit], default_config)
    land_cat = [f for f in findings_def if "RULE-CAT-LAND" in f.rule_id][0]
    assert land_cat.status == ValidationStatus.FAIL
    assert "2.50 Acres" in land_cat.explanation

    # Compliant: 3.50 acres
    doc_compliant = make_mock_doc("d41", "LAND_DEED", "deed.pdf", "h41", {
        "land_area_acres": "3.50",
        "professors": "2",
        "principal_name": "Dr. S. K. Sharma"
    })
    findings_comp = CategoryRequirementsValidator.validate(app, [doc_compliant], default_config)
    land_cat_pass = [f for f in findings_comp if "RULE-CAT-LAND" in f.rule_id][0]
    assert land_cat_pass.status == ValidationStatus.PASS

def test_master_validation_engine_compliant_sample_case():
    """End-to-End sample case A: Fully compliant technical institution passes all 7 modules."""
    now = datetime.now(timezone.utc)
    app = SimpleNamespace(
        id="app-pass",
        institution_name="Apex Institute of Technology, Pune",
        program_name="Engineering & Technology",
        institution_type="Private / Self-Financed"
    )

    doc_deed = make_mock_doc("doc-a-1", "LAND_DEED", "CaseA_Land_Deed.pdf", "hash_a_1", {
        "land_area_acres": "3.50",
        "deed_number": "REG-2024-9981",
        "registration_date": "2021-03-15",
        "owner_name": "Apex Institute of Technology",
        "institution_name": "Apex Institute of Technology"
    })

    doc_plan = make_mock_doc("doc-a-2", "BUILDING_PLAN", "CaseA_Building_Plan.pdf", "hash_a_2", {
        "total_plot_area_acres": "3.50",
        "coa_registration_no": "CA/2012/54890",
        "architect_name": "Ar. Rajesh Verma"
    })

    future_fire_date = (now + timedelta(days=200)).strftime("%Y-%m-%d")
    doc_fire = make_mock_doc("doc-a-3", "FIRE_NOC", "CaseA_Fire_NOC.pdf", "hash_a_3", {
        "certificate_number": "NOC-FIRE-2024-887",
        "valid_until_date": future_fire_date
    })

    doc_faculty = make_mock_doc("doc-a-4", "FACULTY_LIST", "CaseA_Faculty_List.pdf", "hash_a_4", {
        "principal_name": "Dr. K. S. Ramanujam",
        "total_faculty": "40",
        "student_count": "540",
        "professors": "4"
    })

    result = ValidationEngine.evaluate(
        application=app,
        documents=[doc_deed, doc_plan, doc_fire, doc_faculty]
    )

    stats = result["statistics"]
    scorecard = result["scorecard"]

    assert stats["critical_fails"] == 0
    assert scorecard["recommendation"] == "ELIGIBLE"
    assert scorecard["composite_score"] >= 90.0
    assert result["ruleset_version"] == "v2026.1"

def test_configurable_ruleset_versioning_and_parameter_overrides():
    """Verify that the engine dynamically honors custom parameter overrides and version tags."""
    app = SimpleNamespace(
        id="app-config",
        institution_name="Apex Institute of Technology",
        program_name="Engineering & Technology",
        institution_type="Private / Self-Financed"
    )

    doc_deed = make_mock_doc("doc-c-1", "LAND_DEED", "deed.pdf", "h1", {"land_area_acres": "3.50"})
    doc_plan = make_mock_doc("doc-c-2", "BUILDING_PLAN", "plan.pdf", "h2", {"total_plot_area_acres": "3.35"})

    # Under default config (tolerance 0.05), variance 0.15 is a FAIL
    def_result = CrossDocumentValidator.validate(app, [doc_deed, doc_plan], default_config)
    assert def_result[0].status == ValidationStatus.FAIL

    # Under custom config with relaxed tolerance (0.20) and version tag v2026.2-HILL
    custom_config = ValidationEngineConfig(
        version_tag="v2026.2-HILL",
        land_area_tolerance_acres=0.20
    )
    custom_result = CrossDocumentValidator.validate(app, [doc_deed, doc_plan], custom_config)
    assert custom_result[0].status == ValidationStatus.PASS
