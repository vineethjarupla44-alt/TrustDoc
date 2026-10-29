from typing import List, Dict, Any
from backend.app.services.validation_engine.types import (
    ValidationFinding, ValidationStatus, FindingCategory, RuleSeverity
)
from backend.app.services.validation_engine.config import ValidationEngineConfig

class RequiredDocsAndFieldsValidator:
    """
    Module 1: Required fields and missing documents validation.
    Checks completeness of mandatory documentation bundles and constituent statutory fields.
    """

    @classmethod
    def validate(
        cls,
        application: Any,
        documents: List[Any],
        config: ValidationEngineConfig
    ) -> List[ValidationFinding]:
        findings: List[ValidationFinding] = []
        program = getattr(application, "program_name", "DEFAULT") or "DEFAULT"

        # 1. Mandatory Documents Evaluation
        mandatory_docs = config.mandatory_documents.get(program) or config.mandatory_documents.get("DEFAULT", [])
        uploaded_doc_types = {d.document_type.upper(): d for d in documents}

        for m_type in mandatory_docs:
            human_name = m_type.replace("_", " ").title()
            if m_type not in uploaded_doc_types:
                findings.append(ValidationFinding(
                    rule_id=f"RULE-REQ-DOC-{m_type}",
                    rule_name=f"Mandatory Document Presence: {human_name}",
                    category=FindingCategory.REQUIRED_DOCS_AND_FIELDS,
                    status=ValidationStatus.FAIL,
                    severity=RuleSeverity.CRITICAL,
                    explanation=f"The application dossier requires an official {human_name}. No document of this type was uploaded.",
                    evidence=None,
                    source_field_ref={"doc_type": m_type},
                    recommended_action=f"Upload the sanctioned {human_name} in PDF/PNG format before final submission."
                ))
            else:
                doc = uploaded_doc_types[m_type]
                findings.append(ValidationFinding(
                    rule_id=f"RULE-REQ-DOC-{m_type}",
                    rule_name=f"Mandatory Document Presence: {human_name}",
                    category=FindingCategory.REQUIRED_DOCS_AND_FIELDS,
                    status=ValidationStatus.PASS,
                    severity=RuleSeverity.INFO,
                    explanation=f"Required document '{human_name}' is uploaded and present in application dossier.",
                    evidence=f"File: {doc.file_name} (SHA-256: {doc.sha256_hash[:12]}...)",
                    source_field_ref={"doc_id": doc.id, "doc_type": m_type},
                    recommended_action=None
                ))

        # 2. Mandatory Extracted Fields Evaluation
        for doc in documents:
            dtype = doc.document_type.upper()
            req_fields = config.mandatory_fields.get(dtype, [])
            if not req_fields:
                continue

            # Build fields map from normalized ExtractedField rows or fallback
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

            for f_key in req_fields:
                human_field = f_key.replace("_", " ").title()
                field_obj = fields_by_key.get(f_key)

                if not field_obj:
                    findings.append(ValidationFinding(
                        rule_id=f"RULE-REQ-FLD-{dtype}-{f_key}",
                        rule_name=f"Mandatory Field Presence: {human_field}",
                        category=FindingCategory.REQUIRED_DOCS_AND_FIELDS,
                        status=ValidationStatus.FAIL,
                        severity=RuleSeverity.CRITICAL,
                        explanation=f"Mandatory field '{human_field}' was not located in {dtype.replace('_', ' ')}.",
                        evidence=None,
                        source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": f_key},
                        recommended_action=f"Ensure the uploaded {dtype.replace('_', ' ')} contains legible section for '{human_field}', or use manual field correction."
                    ))
                    continue

                # Inspect field properties
                val = getattr(field_obj, "field_value_normalized", None) if not isinstance(field_obj, dict) else field_obj.get("field_value_normalized")
                state = getattr(field_obj, "state", "DETECTED") if not isinstance(field_obj, dict) else field_obj.get("state", "DETECTED")
                conf = getattr(field_obj, "confidence_score", 1.0) if not isinstance(field_obj, dict) else field_obj.get("confidence_score", 1.0)
                page = getattr(field_obj, "page_number", 1) if not isinstance(field_obj, dict) else field_obj.get("page_number", 1)
                bbox = getattr(field_obj, "bounding_box", None) if not isinstance(field_obj, dict) else field_obj.get("bounding_box")

                if state == "EXTRACTION_FAILED":
                    findings.append(ValidationFinding(
                        rule_id=f"RULE-REQ-FLD-{dtype}-{f_key}",
                        rule_name=f"Mandatory Field Presence: {human_field}",
                        category=FindingCategory.REQUIRED_DOCS_AND_FIELDS,
                        status=ValidationStatus.NEEDS_REVIEW,
                        severity=RuleSeverity.WARNING,
                        explanation=f"OCR extraction failed for '{human_field}' due to scan illegibility. Requires manual reviewer verification.",
                        evidence=None,
                        source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": f_key, "page_number": page, "bounding_box": bbox},
                        recommended_action="Inspect source document canvas or upload a higher-resolution scan."
                    ))
                elif state == "MISSING_IN_DOCUMENT" or val is None or str(val).strip() == "":
                    findings.append(ValidationFinding(
                        rule_id=f"RULE-REQ-FLD-{dtype}-{f_key}",
                        rule_name=f"Mandatory Field Presence: {human_field}",
                        category=FindingCategory.REQUIRED_DOCS_AND_FIELDS,
                        status=ValidationStatus.FAIL,
                        severity=RuleSeverity.CRITICAL,
                        explanation=f"Required statutory attribute '{human_field}' is missing in the submitted {dtype.replace('_', ' ')}.",
                        evidence=None,
                        source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": f_key, "page_number": page, "bounding_box": bbox},
                        recommended_action=f"Submit an amended document containing the certified '{human_field}'."
                    ))
                elif conf < config.min_ocr_confidence_threshold:
                    findings.append(ValidationFinding(
                        rule_id=f"RULE-REQ-FLD-{dtype}-{f_key}",
                        rule_name=f"Mandatory Field Presence: {human_field}",
                        category=FindingCategory.REQUIRED_DOCS_AND_FIELDS,
                        status=ValidationStatus.NEEDS_REVIEW,
                        severity=RuleSeverity.WARNING,
                        explanation=f"Field '{human_field}' detected but with low OCR confidence ({conf * 100:.0f}%). Needs human confirmation.",
                        evidence=f"Extracted Value: {val}",
                        source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": f_key, "page_number": page, "bounding_box": bbox},
                        recommended_action="Confirm the extracted text in the Document Workbench."
                    ))
                else:
                    findings.append(ValidationFinding(
                        rule_id=f"RULE-REQ-FLD-{dtype}-{f_key}",
                        rule_name=f"Mandatory Field Presence: {human_field}",
                        category=FindingCategory.REQUIRED_DOCS_AND_FIELDS,
                        status=ValidationStatus.PASS,
                        severity=RuleSeverity.INFO,
                        explanation=f"Mandatory field '{human_field}' successfully verified with {conf * 100:.0f}% confidence.",
                        evidence=f"Extracted Value: {val}",
                        source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": f_key, "page_number": page, "bounding_box": bbox},
                        recommended_action=None
                    ))

        return findings
