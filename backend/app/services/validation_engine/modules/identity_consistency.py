import re
from difflib import SequenceMatcher
from typing import List, Dict, Any, Tuple
from backend.app.services.validation_engine.types import (
    ValidationFinding, ValidationStatus, FindingCategory, RuleSeverity
)
from backend.app.services.validation_engine.config import ValidationEngineConfig

class IdentityConsistencyValidator:
    """
    Module 6: Institution name and registration-number consistency.
    Enforces strict OCR uncertainty guardrails: low confidence extractions are never marked as definitive FAIL.
    """

    @classmethod
    def _compute_similarity(cls, str1: str, str2: str) -> float:
        if not str1 or not str2:
            return 0.0

        # Normalization
        s1 = re.sub(r'[^a-z0-9\s]', ' ', str1.lower()).strip()
        s2 = re.sub(r'[^a-z0-9\s]', ' ', str2.lower()).strip()

        # 1. Direct string similarity
        direct_ratio = SequenceMatcher(None, s1, s2).ratio()

        # 2. Token sets
        tokens1 = set([w for w in s1.split() if len(w) > 1])
        tokens2 = set([w for w in s2.split() if len(w) > 1])

        if not tokens1 or not tokens2:
            return direct_ratio

        # Token set overlap / containment ratio (e.g. if one is a subset of the other)
        intersection = tokens1.intersection(tokens2)
        min_len = min(len(tokens1), len(tokens2))
        subset_ratio = len(intersection) / min_len if min_len > 0 else 0.0
        jaccard_ratio = len(intersection) / len(tokens1.union(tokens2)) if tokens1.union(tokens2) else 0.0

        # If all or most tokens of the smaller name are present in the larger name:
        if subset_ratio >= 0.80:
            return max(direct_ratio, 0.90)

        # Combined metric
        token_sort_1 = " ".join(sorted(tokens1))
        token_sort_2 = " ".join(sorted(tokens2))
        sort_ratio = SequenceMatcher(None, token_sort_1, token_sort_2).ratio()

        return max(direct_ratio, sort_ratio, jaccard_ratio)

    @classmethod
    def validate(
        cls,
        application: Any,
        documents: List[Any],
        config: ValidationEngineConfig
    ) -> List[ValidationFinding]:
        findings: List[ValidationFinding] = []
        app_name = getattr(application, "institution_name", "") or ""

        if not app_name.strip():
            return findings

        for doc in documents:
            dtype = doc.document_type.upper()

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

            # Check identity fields in document
            target_field_keys = ["institution_name", "owner_name"]
            for f_key in target_field_keys:
                if f_key not in fields_by_key:
                    continue

                field_obj = fields_by_key[f_key]
                val = getattr(field_obj, "field_value_normalized", None) if not isinstance(field_obj, dict) else field_obj.get("field_value_normalized")
                conf = getattr(field_obj, "confidence_score", 1.0) if not isinstance(field_obj, dict) else field_obj.get("confidence_score", 1.0)
                state = getattr(field_obj, "state", "DETECTED") if not isinstance(field_obj, dict) else field_obj.get("state", "DETECTED")
                page = getattr(field_obj, "page_number", 1) if not isinstance(field_obj, dict) else field_obj.get("page_number", 1)
                bbox = getattr(field_obj, "bounding_box", None) if not isinstance(field_obj, dict) else field_obj.get("bounding_box")

                if not val or state == "MISSING_IN_DOCUMENT":
                    continue

                extracted_name = str(val).strip()
                sim = cls._compute_similarity(app_name, extracted_name)

                # 1. High match passes
                if sim >= config.name_similarity_pass_threshold:
                    findings.append(ValidationFinding(
                        rule_id=f"RULE-ID-NAME-{dtype}",
                        rule_name=f"Institutional Name Consistency: {dtype.replace('_', ' ').title()}",
                        category=FindingCategory.IDENTITY_CONSISTENCY,
                        status=ValidationStatus.PASS,
                        severity=RuleSeverity.INFO,
                        explanation=f"Institution name in application aligns with '{dtype.replace('_', ' ')}' party name (similarity: {sim * 100:.0f}%).",
                        evidence=f"Application: '{app_name}' vs Document: '{extracted_name}' (Match: {sim * 100:.0f}%)",
                        source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": f_key, "page_number": page, "bounding_box": bbox},
                        recommended_action=None
                    ))
                # 2. OCR Uncertainty Guardrail: If OCR confidence is low, NEVER mark as FAIL!
                elif conf < config.min_ocr_confidence_threshold or state == "EXTRACTION_FAILED":
                    findings.append(ValidationFinding(
                        rule_id=f"RULE-ID-NAME-{dtype}",
                        rule_name=f"Institutional Name Consistency: {dtype.replace('_', ' ').title()}",
                        category=FindingCategory.IDENTITY_CONSISTENCY,
                        status=ValidationStatus.NEEDS_REVIEW,
                        severity=RuleSeverity.WARNING,
                        explanation=(
                            f"Potential institution name mismatch detected ('{extracted_name}' vs '{app_name}'), "
                            f"but OCR confidence is low ({conf * 100:.0f}%). Under statutory guardrails, uncertain OCR is not treated as a definitive mismatch."
                        ),
                        evidence=f"Application: '{app_name}' vs Low-Confidence OCR: '{extracted_name}' (Confidence: {conf * 100:.0f}%, Sim: {sim * 100:.0f}%)",
                        source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": f_key, "page_number": page, "bounding_box": bbox},
                        recommended_action="Manually inspect source document scan in Document Workbench to verify authentic institutional entity."
                    ))
                # 3. High confidence but clear mismatch -> FAIL
                elif sim < config.name_similarity_fail_threshold:
                    findings.append(ValidationFinding(
                        rule_id=f"RULE-ID-NAME-{dtype}",
                        rule_name=f"Institutional Name Consistency: {dtype.replace('_', ' ').title()}",
                        category=FindingCategory.IDENTITY_CONSISTENCY,
                        status=ValidationStatus.FAIL,
                        severity=RuleSeverity.CRITICAL,
                        explanation=(
                            f"Document title holder '{extracted_name}' does not match registered applicant '{app_name}' "
                            f"(similarity: {sim * 100:.0f}% on high-confidence OCR). Title documents must belong to the applicant trust/institution."
                        ),
                        evidence=f"Application: '{app_name}' vs Document: '{extracted_name}' (Similarity: {sim * 100:.0f}%, OCR Confidence: {conf * 100:.0f}%)",
                        source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": f_key, "page_number": page, "bounding_box": bbox},
                        recommended_action="Submit registered document showing transfer of title or leasehold rights to the applicant institution."
                    ))
                # 4. Partial / Borderline match -> WARNING
                else:
                    findings.append(ValidationFinding(
                        rule_id=f"RULE-ID-NAME-{dtype}",
                        rule_name=f"Institutional Name Consistency: {dtype.replace('_', ' ').title()}",
                        category=FindingCategory.IDENTITY_CONSISTENCY,
                        status=ValidationStatus.WARNING,
                        severity=RuleSeverity.WARNING,
                        explanation=f"Minor name variation detected between application '{app_name}' and document '{extracted_name}'.",
                        evidence=f"Similarity: {sim * 100:.0f}%",
                        source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": f_key, "page_number": page, "bounding_box": bbox},
                        recommended_action="Confirm that variations correspond to the same legal entity."
                    ))
                break  # Process one name field per document

        return findings
