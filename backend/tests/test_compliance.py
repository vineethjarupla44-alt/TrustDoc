import pytest
from backend.app.core.masking import mask_text, mask_dict_fields
from backend.app.services.cross_validator import CrossValidator
from backend.app.services.rules_engine import RulesEngine
from backend.app.services.rag_service import rag_service

def test_pii_masking():
    # Aadhaar masking
    raw_aadhaar = "Applicant Aadhaar is 9812 4589 1234 for verification."
    masked = mask_text(raw_aadhaar)
    assert "9812 4589" not in masked
    assert "XXXX-XXXX-1234" in masked

    # PAN masking
    raw_pan = "Trust PAN Card Number: ABCDE1234F"
    masked_pan = mask_text(raw_pan)
    assert "ABCDE" not in masked_pan
    assert "XXXXX1234F" in masked_pan

    # Dict masking
    payload = {
        "institution": "Apex Institute",
        "aadhaar_number": "1234 5678 9012",
        "nested": {"contact_phone": "9876543210"}
    }
    masked_dict = mask_dict_fields(payload, unmask=False)
    assert masked_dict["aadhaar_number"] == "XXXX-XXXX-9012"
    assert "987654" not in masked_dict["nested"]["contact_phone"]

def test_cross_validator_discrepancy():
    docs_dict = {
        "LAND_DEED": {
            "doc_id": "doc-1",
            "fields": {"land_area_acres": 2.50}
        },
        "BUILDING_PLAN": {
            "doc_id": "doc-2",
            "fields": {"total_plot_area_acres": 1.85, "coa_registration_no": None}
        },
        "FIRE_NOC": {"doc_id": "doc-3", "fields": {}},
        "FACULTY_LIST": {"doc_id": "doc-4", "fields": {}}
    }
    findings = CrossValidator.validate_application_documents(docs_dict)
    
    # Must detect land discrepancy
    disc = next((f for f in findings if f["rule_code"] == "SYNTH-NORM-5.1.1"), None)
    assert disc is not None
    assert disc["severity"] == "CRITICAL"
    assert "0.65 Acres" in disc["description"]

    # Must detect missing architect COA
    missing_coa = next((f for f in findings if f["rule_code"] == "SYNTH-NORM-2.1.1"), None)
    assert missing_coa is not None
    assert missing_coa["severity"] == "WARNING"

def test_rules_engine_evaluations():
    docs_dict = {
        "LAND_DEED": {
            "doc_id": "doc-1",
            "fields": {"land_area_acres": 2.10}  # Below 2.50
        },
        "FIRE_NOC": {
            "doc_id": "doc-2",
            "fields": {"is_expired": True, "valid_until_date": "10/01/2023"}
        },
        "FACULTY_LIST": {
            "doc_id": "doc-3",
            "fields": {"sfr_ratio": 22.5, "student_count": 450, "total_faculty": 20}
        }
    }
    findings = RulesEngine.evaluate_regulatory_compliance(docs_dict)
    
    # Must flag land deficit
    land_f = next((f for f in findings if f["rule_code"] == "SYNTH-NORM-1.1.1"), None)
    assert land_f is not None
    assert land_f["severity"] == "CRITICAL"

    # Must flag expired Fire NOC
    fire_f = next((f for f in findings if f["rule_code"] == "SYNTH-NORM-3.1.2"), None)
    assert fire_f is not None
    assert fire_f["severity"] == "CRITICAL"

    # Must flag SFR violation
    sfr_f = next((f for f in findings if f["rule_code"] == "SYNTH-NORM-4.1.1"), None)
    assert sfr_f is not None
    assert sfr_f["severity"] == "WARNING"

def test_rag_semantic_search():
    results = rag_service.search_regulations("fire safety active validity noc", top_k=2)
    assert len(results) > 0
    assert any("SYNTH-NORM-3.1" in r["rule_code"] or "Fire" in r["title"] for r in results)

    # Test chatbot advice
    advice = rag_service.answer_applicant_query("What is the minimum land required in an urban metro area?")
    assert len(advice["citations"]) > 0
    assert "SYNTH-NORM-1.1.1" in advice["citations"][0]["rule_code"]
