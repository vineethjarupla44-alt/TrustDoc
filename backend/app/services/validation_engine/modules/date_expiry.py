import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from backend.app.services.validation_engine.types import (
    ValidationFinding, ValidationStatus, FindingCategory, RuleSeverity
)
from backend.app.services.validation_engine.config import ValidationEngineConfig

class DateAndExpiryValidator:
    """
    Module 3: Date and expiry checks.
    Evaluates temporal consistency, lapsed safety certifications, and future-dated deeds.
    """

    @classmethod
    def _parse_date(cls, date_str: Optional[str]) -> Optional[datetime]:
        if not date_str:
            return None
        clean_str = str(date_str).strip()
        # Common statutory date formats
        formats = [
            "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y",
            "%d.%m.%Y", "%Y/%m/%d", "%b %d, %Y", "%d %b %Y"
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(clean_str, fmt)
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        return None

    @classmethod
    def validate(
        cls,
        application: Any,
        documents: List[Any],
        config: ValidationEngineConfig
    ) -> List[ValidationFinding]:
        findings: List[ValidationFinding] = []
        now = datetime.now(timezone.utc)

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

            # 1. Fire Safety NOC Expiration Evaluation
            if dtype in ("FIRE_NOC", "SAFETY_CERTIFICATE"):
                field_obj = fields_by_key.get("valid_until_date")
                val = getattr(field_obj, "field_value_normalized", None) if not isinstance(field_obj, dict) else field_obj.get("field_value_normalized")
                page = getattr(field_obj, "page_number", 1) if not isinstance(field_obj, dict) else field_obj.get("page_number", 1)
                bbox = getattr(field_obj, "bounding_box", None) if not isinstance(field_obj, dict) else field_obj.get("bounding_box")

                parsed_expiry = cls._parse_date(val)
                if parsed_expiry:
                    warning_window = now + timedelta(days=config.expiry_warning_days)

                    if parsed_expiry < now:
                        findings.append(ValidationFinding(
                            rule_id="RULE-EXP-FIRE-001",
                            rule_name="Active Fire Safety NOC Validity",
                            category=FindingCategory.DATE_AND_EXPIRY,
                            status=ValidationStatus.FAIL,
                            severity=RuleSeverity.CRITICAL,
                            explanation=(
                                f"Fire and Life Safety NOC expired on {parsed_expiry.strftime('%Y-%m-%d')}. "
                                "Institutions cannot operate educational campuses with lapsed fire clearances."
                            ),
                            evidence=f"Validity Expiration: {parsed_expiry.strftime('%Y-%m-%d')} (Lapsed)",
                            source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": "valid_until_date", "page_number": page, "bounding_box": bbox},
                            recommended_action="Procure and submit an active, renewed Fire Clearance Certificate from the State Fire & Rescue Services."
                        ))
                    elif parsed_expiry <= warning_window:
                        days_left = (parsed_expiry - now).days
                        findings.append(ValidationFinding(
                            rule_id="RULE-EXP-FIRE-001",
                            rule_name="Active Fire Safety NOC Validity",
                            category=FindingCategory.DATE_AND_EXPIRY,
                            status=ValidationStatus.WARNING,
                            severity=RuleSeverity.WARNING,
                            explanation=f"Fire Safety NOC is currently active but will expire within {days_left} days ({parsed_expiry.strftime('%Y-%m-%d')}).",
                            evidence=f"Valid Until: {parsed_expiry.strftime('%Y-%m-%d')} ({days_left} days remaining)",
                            source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": "valid_until_date", "page_number": page, "bounding_box": bbox},
                            recommended_action="Initiate renewal proceedings with fire safety authorities to ensure uninterrupted compliance."
                        ))
                    else:
                        findings.append(ValidationFinding(
                            rule_id="RULE-EXP-FIRE-001",
                            rule_name="Active Fire Safety NOC Validity",
                            category=FindingCategory.DATE_AND_EXPIRY,
                            status=ValidationStatus.PASS,
                            severity=RuleSeverity.INFO,
                            explanation=f"Fire Safety NOC is verified active through {parsed_expiry.strftime('%Y-%m-%d')}.",
                            evidence=f"Expiry Date: {parsed_expiry.strftime('%Y-%m-%d')}",
                            source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": "valid_until_date", "page_number": page, "bounding_box": bbox},
                            recommended_action=None
                        ))

            # 2. Title Deed Past Execution Date Check
            if dtype in ("LAND_DEED", "TITLE_DEED", "LAND_DOCUMENTS"):
                field_obj = fields_by_key.get("registration_date")
                val = getattr(field_obj, "field_value_normalized", None) if not isinstance(field_obj, dict) else field_obj.get("field_value_normalized")
                page = getattr(field_obj, "page_number", 1) if not isinstance(field_obj, dict) else field_obj.get("page_number", 1)
                bbox = getattr(field_obj, "bounding_box", None) if not isinstance(field_obj, dict) else field_obj.get("bounding_box")

                parsed_date = cls._parse_date(val)
                if parsed_date:
                    if parsed_date > (now + timedelta(days=1)):  # 1 day tolerance for timezone shifts
                        findings.append(ValidationFinding(
                            rule_id="RULE-EXP-DEED-002",
                            rule_name="Title Deed Historical Execution Date",
                            category=FindingCategory.DATE_AND_EXPIRY,
                            status=ValidationStatus.FAIL,
                            severity=RuleSeverity.CRITICAL,
                            explanation=f"Title Deed registration date '{parsed_date.strftime('%Y-%m-%d')}' is set in the future.",
                            evidence=f"Deed Date: {parsed_date.strftime('%Y-%m-%d')} vs Current: {now.strftime('%Y-%m-%d')}",
                            source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": "registration_date", "page_number": page, "bounding_box": bbox},
                            recommended_action="Verify execution date against physical stamp on deed and correct transcription."
                        ))
                    else:
                        findings.append(ValidationFinding(
                            rule_id="RULE-EXP-DEED-002",
                            rule_name="Title Deed Historical Execution Date",
                            category=FindingCategory.DATE_AND_EXPIRY,
                            status=ValidationStatus.PASS,
                            severity=RuleSeverity.INFO,
                            explanation=f"Title Deed execution date '{parsed_date.strftime('%Y-%m-%d')}' is a valid historical date.",
                            evidence=f"Registered On: {parsed_date.strftime('%Y-%m-%d')}",
                            source_field_ref={"doc_id": doc.id, "doc_type": dtype, "field_key": "registration_date", "page_number": page, "bounding_box": bbox},
                            recommended_action=None
                        ))

        return findings
