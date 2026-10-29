import re
from typing import List, Dict, Any
from backend.app.services.validation_engine.types import (
    ValidationFinding, ValidationStatus, FindingCategory, RuleSeverity
)
from backend.app.services.validation_engine.config import ValidationEngineConfig

class FieldFormatValidator:
    """
    Module 2: Field-format validation.
    Enforces regex, numeric bounds, and syntactic validation rules.
    """

    @classmethod
    def validate(
        cls,
        application: Any,
        documents: List[Any],
        config: ValidationEngineConfig
    ) -> List[ValidationFinding]:
        findings: List[ValidationFinding] = []

        for doc in documents:
            dtype = doc.document_type.upper()
            
            # Extract fields dictionary
            fields_by_key: Dict[str, Any] = {}
            if hasattr(doc, "extracted_fields") and doc.extracted_fields:
                for f in doc.extracted_fields:
                    fields_by_key[f.field_key] = f
            elif hasattr(doc, "extracted_entities") and doc.extracted_entities and doc.extracted_entities.structured_fields:
                for k, v in doc.extracted_entities.structured_fields.items():
                    fields_by_key[k] = {
                        "field_value_normalized": v,
                        "confidence_score": doc.extracted_entities.confidence_score or 0.85,
                        "state": "DETECTED" if v is not None else "MISSING_IN_DOCUMENT",
                        "page_number": 1,
                        "bounding_box": None
                    }

            # 1. COA Architect Registration Number Check
            if "coa_registration_no" in fields_by_key:
                field_obj = fields_by_key["coa_registration_no"]
                val = getattr(field_obj, "field_value_normalized", None) if not isinstance(field_obj, dict) else field_obj.get("field_value_normalized")
                conf = getattr(field_obj, "confidence_score", 1.0) if not isinstance(field_obj, dict) else field_obj.get("confidence_score", 1.0)
                page = getattr(field_obj, "page_number", 1) if not isinstance(field_obj, dict) else field_obj.get("page_number", 1)
                bbox = getattr(field_obj, "bounding_box", None) if not isinstance(field_obj, dict) else field_obj.get("bounding_box")

                if val:
                    val_str = str(val).strip()
                    pattern = config.format_regexes.get("coa_registration_no", r"^(?:CA/)?\d{4}/\d{4,6}$")
                    if re.match(pattern, val_str, re.IGNORECASE):
                        findings.append(ValidationFinding(
                            rule_id="RULE-FMT-COA-001",
                            rule_name="Architect COA Registration Number Syntax",
                            category=FindingCategory.FIELD_FORMAT,
                            status=ValidationStatus.PASS,
                            severity=RuleSeverity.INFO,
                            explanation=f"Architect Council of Architecture (COA) registration '{val_str}' conforms to statutory syntax.",
                            evidence=f"Extracted Seal: {val_str}",
                            source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": "coa_registration_no", "page_number": page, "bounding_box": bbox},
                            recommended_action=None
                        ))
                    elif conf < config.min_ocr_confidence_threshold:
                        findings.append(ValidationFinding(
                            rule_id="RULE-FMT-COA-001",
                            rule_name="Architect COA Registration Number Syntax",
                            category=FindingCategory.FIELD_FORMAT,
                            status=ValidationStatus.NEEDS_REVIEW,
                            severity=RuleSeverity.WARNING,
                            explanation=f"COA number '{val_str}' deviates from standard syntax (CA/YYYY/NNNNN), but OCR confidence is low ({conf * 100:.0f}%).",
                            evidence=f"Extracted Seal: {val_str}",
                            source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": "coa_registration_no", "page_number": page, "bounding_box": bbox},
                            recommended_action="Review high-resolution blueprint canvas to verify handwritten or embossed architect seal."
                        ))
                    else:
                        findings.append(ValidationFinding(
                            rule_id="RULE-FMT-COA-001",
                            rule_name="Architect COA Registration Number Syntax",
                            category=FindingCategory.FIELD_FORMAT,
                            status=ValidationStatus.FAIL,
                            severity=RuleSeverity.CRITICAL,
                            explanation=f"Architect COA registration number '{val_str}' violates statutory format standard (expected CA/YYYY/NNNNN).",
                            evidence=f"Extracted Value: {val_str}",
                            source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": "coa_registration_no", "page_number": page, "bounding_box": bbox},
                            recommended_action="Submit certified architectural blueprints bearing a valid Council of Architecture registration number."
                        ))

            # 2. Land Area Numeric Bounds Check (Deed land area & Site plan plot area)
            for area_key in ("land_area_acres", "total_plot_area_acres"):
                if area_key in fields_by_key:
                    field_obj = fields_by_key[area_key]
                    val = getattr(field_obj, "field_value_normalized", None) if not isinstance(field_obj, dict) else field_obj.get("field_value_normalized")
                    page = getattr(field_obj, "page_number", 1) if not isinstance(field_obj, dict) else field_obj.get("page_number", 1)
                    bbox = getattr(field_obj, "bounding_box", None) if not isinstance(field_obj, dict) else field_obj.get("bounding_box")

                    if val is not None:
                        try:
                            area_float = float(val)
                            if area_float <= 0.0 or area_float > 5000.0:
                                findings.append(ValidationFinding(
                                    rule_id="RULE-FMT-LAND-002",
                                    rule_name="Land Area Numerical Range Validity",
                                    category=FindingCategory.FIELD_FORMAT,
                                    status=ValidationStatus.FAIL,
                                    severity=RuleSeverity.CRITICAL,
                                    explanation=f"Land area value '{val}' for '{area_key}' is outside permissible positive institutional bounds (0.0 < area <= 5000.0).",
                                    evidence=f"Normalized Value: {area_float} Acres",
                                    source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": area_key, "page_number": page, "bounding_box": bbox},
                                    recommended_action="Correct the land area value in the document workbench or re-upload certified document."
                                ))
                            else:
                                findings.append(ValidationFinding(
                                    rule_id="RULE-FMT-LAND-002",
                                    rule_name="Land Area Numerical Range Validity",
                                    category=FindingCategory.FIELD_FORMAT,
                                    status=ValidationStatus.PASS,
                                    severity=RuleSeverity.INFO,
                                    explanation=f"Land extent '{area_float:.2f} Acres' for '{area_key}' is a valid positive quantity.",
                                    evidence=f"Parsed Value: {area_float:.2f} Acres",
                                    source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": area_key, "page_number": page, "bounding_box": bbox},
                                    recommended_action=None
                                ))
                        except (ValueError, TypeError):
                            findings.append(ValidationFinding(
                                rule_id="RULE-FMT-LAND-002",
                                rule_name="Land Area Numerical Range Validity",
                                category=FindingCategory.FIELD_FORMAT,
                                status=ValidationStatus.FAIL,
                                severity=RuleSeverity.CRITICAL,
                                explanation=f"Land area '{val}' could not be parsed as a decimal numerical acreage.",
                                evidence=f"Raw Value: {val}",
                                source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": area_key, "page_number": page, "bounding_box": bbox},
                                recommended_action="Ensure the land area is entered as a valid decimal number."
                            ))

            # 3. Faculty Counts Numeric Range Check
            if "total_faculty" in fields_by_key:
                field_obj = fields_by_key["total_faculty"]
                val = getattr(field_obj, "field_value_normalized", None) if not isinstance(field_obj, dict) else field_obj.get("field_value_normalized")
                page = getattr(field_obj, "page_number", 1) if not isinstance(field_obj, dict) else field_obj.get("page_number", 1)
                bbox = getattr(field_obj, "bounding_box", None) if not isinstance(field_obj, dict) else field_obj.get("bounding_box")

                if val is not None:
                    try:
                        fac_int = int(float(val))
                        if fac_int < 1:
                            findings.append(ValidationFinding(
                                rule_id="RULE-FMT-FAC-003",
                                rule_name="Teaching Faculty Count Numerical Validity",
                                category=FindingCategory.FIELD_FORMAT,
                                status=ValidationStatus.FAIL,
                                severity=RuleSeverity.CRITICAL,
                                explanation=f"Total teaching faculty count '{fac_int}' is invalid. Institutions must declare at least 1 appointed faculty.",
                                evidence=f"Parsed Faculty: {fac_int}",
                                source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": "total_faculty", "page_number": page, "bounding_box": bbox},
                                recommended_action="Submit complete teaching cadre roster with full staff particulars."
                            ))
                        else:
                            findings.append(ValidationFinding(
                                rule_id="RULE-FMT-FAC-003",
                                rule_name="Teaching Faculty Count Numerical Validity",
                                category=FindingCategory.FIELD_FORMAT,
                                status=ValidationStatus.PASS,
                                severity=RuleSeverity.INFO,
                                explanation=f"Declared faculty count '{fac_int}' is a valid integer.",
                                evidence=f"Total Faculty: {fac_int}",
                                source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": "total_faculty", "page_number": page, "bounding_box": bbox},
                                recommended_action=None
                            ))
                    except (ValueError, TypeError):
                        pass

        return findings
