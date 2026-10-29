from typing import List, Dict, Any
from backend.app.services.validation_engine.types import (
    ValidationFinding, ValidationStatus, FindingCategory, RuleSeverity
)
from backend.app.services.validation_engine.config import ValidationEngineConfig

class CategoryRequirementsValidator:
    """
    Module 7: Application-category-specific requirements.
    Evaluates statutory norms dictated by academic discipline, program, and institution type.
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
        inst_type = getattr(application, "institution_type", "Private / Self-Financed") or "Private / Self-Financed"
        norms = config.category_norms.get(program) or config.category_norms.get("DEFAULT", {})

        # Extract all available fields across documents
        all_fields: Dict[str, Any] = {}
        for doc in documents:
            if hasattr(doc, "extracted_fields") and doc.extracted_fields:
                for f in doc.extracted_fields:
                    all_fields[f.field_key] = f
            elif hasattr(doc, "extracted_entities") and doc.extracted_entities and doc.extracted_entities.structured_fields:
                for k, v in doc.extracted_entities.structured_fields.items():
                    all_fields[k] = {
                        "field_value_normalized": v,
                        "confidence_score": doc.extracted_entities.confidence_score or 0.85,
                        "state": "DETECTED" if v is not None else "MISSING_IN_DOCUMENT",
                        "page_number": 1,
                        "bounding_box": None
                    }

        # 1. Statutory Land Acreage Threshold Evaluation
        min_land_required = norms.get("min_land_acres_urban", 2.00)
        land_obj = all_fields.get("land_area_acres")
        if land_obj:
            val = getattr(land_obj, "field_value_normalized", None) if not isinstance(land_obj, dict) else land_obj.get("field_value_normalized")
            if val is not None:
                try:
                    area = float(val)
                    if area < min_land_required:
                        findings.append(ValidationFinding(
                            rule_id=f"RULE-CAT-LAND-{program.replace(' ', '_').upper()}",
                            rule_name=f"Prescribed Minimum Land Acreage: {program}",
                            category=FindingCategory.CATEGORY_REQUIREMENTS,
                            status=ValidationStatus.FAIL,
                            severity=RuleSeverity.CRITICAL,
                            explanation=(
                                f"Extracted land extent is {area:.2f} Acres, which falls below the mandatory statutory "
                                f"norm of {min_land_required:.2f} Acres for {program} institutions ({inst_type})."
                            ),
                            evidence=f"Identified Land Area: {area:.2f} Acres (Required Minimum: >= {min_land_required:.2f} Acres)",
                            source_field_ref={"field_key": "land_area_acres"},
                            recommended_action=f"Acquire contiguous land parcel to reach {min_land_required:.2f} Acres or apply under urban/metro relaxation norms."
                        ))
                    else:
                        findings.append(ValidationFinding(
                            rule_id=f"RULE-CAT-LAND-{program.replace(' ', '_').upper()}",
                            rule_name=f"Prescribed Minimum Land Acreage: {program}",
                            category=FindingCategory.CATEGORY_REQUIREMENTS,
                            status=ValidationStatus.PASS,
                            severity=RuleSeverity.INFO,
                            explanation=f"Institutional land extent ({area:.2f} Acres) meets statutory minimum requirement of {min_land_required:.2f} Acres for {program}.",
                            evidence=f"Deed Land Extent: {area:.2f} Acres (Minimum Norm: {min_land_required:.2f} Acres)",
                            source_field_ref={"field_key": "land_area_acres"},
                            recommended_action=None
                        ))
                except (ValueError, TypeError):
                    pass

        # 2. Cadre Distribution: Full Professor Requirement
        if norms.get("min_full_professors", 1) > 0:
            prof_obj = all_fields.get("professors")
            if prof_obj:
                p_val = getattr(prof_obj, "field_value_normalized", None) if not isinstance(prof_obj, dict) else prof_obj.get("field_value_normalized")
                if p_val is not None:
                    try:
                        p_count = int(float(p_val))
                        min_prof = norms["min_full_professors"]
                        if p_count < min_prof:
                            findings.append(ValidationFinding(
                                rule_id="RULE-CAT-PROF-002",
                                rule_name="Senior Teaching Cadre (Full Professor) Requirement",
                                category=FindingCategory.CATEGORY_REQUIREMENTS,
                                status=ValidationStatus.FAIL,
                                severity=RuleSeverity.CRITICAL,
                                explanation=f"Institution declares {p_count} Full Professors. Statutory council norms mandate at least {min_prof} Full Professor.",
                                evidence=f"Full Professors: {p_count} (Mandatory: >= {min_prof})",
                                source_field_ref={"field_key": "professors"},
                                recommended_action="Appoint certified full professor to fulfill academic cadre distribution requirements."
                            ))
                        else:
                            findings.append(ValidationFinding(
                                rule_id="RULE-CAT-PROF-002",
                                rule_name="Senior Teaching Cadre (Full Professor) Requirement",
                                category=FindingCategory.CATEGORY_REQUIREMENTS,
                                status=ValidationStatus.PASS,
                                severity=RuleSeverity.INFO,
                                explanation=f"Full professor cadre count ({p_count}) satisfies statutory quota.",
                                evidence=f"Appointed Full Professors: {p_count}",
                                source_field_ref={"field_key": "professors"},
                                recommended_action=None
                            ))
                    except (ValueError, TypeError):
                        pass

        # 3. Head of Institution / Principal Designation
        if norms.get("min_principal_required", True):
            princ_obj = all_fields.get("principal_name")
            p_name = getattr(princ_obj, "field_value_normalized", None) if not isinstance(princ_obj, dict) else (princ_obj.get("field_value_normalized") if princ_obj else None)
            if p_name and str(p_name).strip() and str(p_name).lower() not in ("none", "null", ""):
                findings.append(ValidationFinding(
                    rule_id="RULE-CAT-PRINC-003",
                    rule_name="Head of Institution Appointment Endorsement",
                    category=FindingCategory.CATEGORY_REQUIREMENTS,
                    status=ValidationStatus.PASS,
                    severity=RuleSeverity.INFO,
                    explanation=f"Designated Head of Institution '{p_name}' verified on faculty cadre declaration.",
                    evidence=f"Principal / Director: {p_name}",
                    source_field_ref={"field_key": "principal_name"},
                    recommended_action=None
                ))
            else:
                findings.append(ValidationFinding(
                    rule_id="RULE-CAT-PRINC-003",
                    rule_name="Head of Institution Appointment Endorsement",
                    category=FindingCategory.CATEGORY_REQUIREMENTS,
                    status=ValidationStatus.FAIL,
                    severity=RuleSeverity.CRITICAL,
                    explanation=f"No approved Head of Institution / Director is declared on the faculty roster for {program}.",
                    evidence="Principal Name: Unspecified / Blank",
                    source_field_ref={"field_key": "principal_name"},
                    recommended_action="Submit appointment letter and university approval endorsement for designated Principal/Director."
                ))

        return findings
