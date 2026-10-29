from typing import List, Dict, Any
from backend.app.services.validation_engine.types import (
    ValidationFinding, ValidationStatus, FindingCategory, RuleSeverity
)
from backend.app.services.validation_engine.config import ValidationEngineConfig

class CrossDocumentValidator:
    """
    Module 5: Cross-document comparisons.
    Performs inter-document numerical consistency and correlation audits.
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
        norms = config.category_norms.get(program) or config.category_norms.get("DEFAULT", {})

        # Build docs and fields map
        doc_fields: Dict[str, Dict[str, Any]] = {}
        doc_objects: Dict[str, Any] = {}

        for doc in documents:
            dtype = doc.document_type.upper()
            doc_objects[dtype] = doc
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
            doc_fields[dtype] = fields_by_key

        # 1. Land Extent Reconciliation: Land Deed vs Building Master Plan
        if "LAND_DEED" in doc_fields and "BUILDING_PLAN" in doc_fields:
            deed_field = doc_fields["LAND_DEED"].get("land_area_acres")
            plan_field = doc_fields["BUILDING_PLAN"].get("total_plot_area_acres")

            deed_val = getattr(deed_field, "field_value_normalized", None) if not isinstance(deed_field, dict) else (deed_field.get("field_value_normalized") if deed_field else None)
            plan_val = getattr(plan_field, "field_value_normalized", None) if not isinstance(plan_field, dict) else (plan_field.get("field_value_normalized") if plan_field else None)

            if deed_val is not None and plan_val is not None:
                try:
                    deed_area = float(deed_val)
                    plan_area = float(plan_val)
                    diff = abs(deed_area - plan_area)
                    tol = config.land_area_tolerance_acres

                    if diff > tol:
                        findings.append(ValidationFinding(
                            rule_id="RULE-CROSS-LAND-001",
                            rule_name="Cross-Document Land Extent Reconciliation",
                            category=FindingCategory.CROSS_DOCUMENT,
                            status=ValidationStatus.FAIL,
                            severity=RuleSeverity.CRITICAL,
                            explanation=(
                                f"Land Title Deed cites {deed_area:.2f} Acres, whereas the Approved Building Master Plan "
                                f"cites {plan_area:.2f} Acres. The discrepancy of {diff:.2f} Acres exceeds permissible tolerance (+/- {tol:.2f} Acres)."
                            ),
                            evidence=f"Deed: {deed_area:.2f} Acres vs Building Plan: {plan_area:.2f} Acres (Variance: {diff:.2f} Acres)",
                            source_field_ref={
                                "doc_id": doc_objects["BUILDING_PLAN"].id,
                                "doc_type": "BUILDING_PLAN",
                                "field_key": "total_plot_area_acres",
                                "colliding_doc_id": doc_objects["LAND_DEED"].id
                            },
                            recommended_action=f"Provide a registered Rectification Deed or submit an updated site blueprint reconciling the {diff:.2f} Acre difference."
                        ))
                    else:
                        findings.append(ValidationFinding(
                            rule_id="RULE-CROSS-LAND-001",
                            rule_name="Cross-Document Land Extent Reconciliation",
                            category=FindingCategory.CROSS_DOCUMENT,
                            status=ValidationStatus.PASS,
                            severity=RuleSeverity.INFO,
                            explanation=f"Land Title Deed ({deed_area:.2f} Ac) and Building Plan ({plan_area:.2f} Ac) match within permissible tolerance (+/- {tol:.2f} Ac).",
                            evidence=f"Deed: {deed_area:.2f} Ac vs Plan: {plan_area:.2f} Ac (Delta: {diff:.2f} Ac)",
                            source_field_ref={"doc_id": doc_objects["BUILDING_PLAN"].id, "doc_type": "BUILDING_PLAN"},
                            recommended_action=None
                        ))
                except (ValueError, TypeError):
                    pass

        # 2. Student-to-Faculty Ratio (SFR) Cross-Calculation
        if "FACULTY_LIST" in doc_fields:
            fac_f = doc_fields["FACULTY_LIST"].get("total_faculty")
            stud_f = doc_fields["FACULTY_LIST"].get("student_count")

            fac_val = getattr(fac_f, "field_value_normalized", None) if not isinstance(fac_f, dict) else (fac_f.get("field_value_normalized") if fac_f else None)
            stud_val = getattr(stud_f, "field_value_normalized", None) if not isinstance(stud_f, dict) else (stud_f.get("field_value_normalized") if stud_f else None)

            if fac_val is not None and stud_val is not None:
                try:
                    total_faculty = int(float(fac_val))
                    student_count = int(float(stud_val))
                    max_sfr = norms.get("max_sfr_ratio", 15.0)

                    if total_faculty > 0:
                        sfr = round(student_count / total_faculty, 1)

                        if sfr > max_sfr:
                            findings.append(ValidationFinding(
                                rule_id="RULE-CROSS-SFR-002",
                                rule_name="Student-to-Faculty Ratio (SFR) Regulatory Norm",
                                category=FindingCategory.CROSS_DOCUMENT,
                                status=ValidationStatus.FAIL,
                                severity=RuleSeverity.CRITICAL,
                                explanation=(
                                    f"Effective Student-to-Faculty Ratio is 1:{sfr} ({student_count} students to {total_faculty} faculty members), "
                                    f"violating council maximum ceiling of 1:{max_sfr:.0f} for {program}."
                                ),
                                evidence=f"Total Students: {student_count}, Total Faculty: {total_faculty}, Resulting SFR: 1:{sfr} (Ceiling: 1:{max_sfr:.0f})",
                                source_field_ref={"doc_id": doc_objects["FACULTY_LIST"].id, "doc_type": "FACULTY_LIST", "field_key": "total_faculty"},
                                recommended_action=f"Appoint at least {int((student_count / max_sfr) - total_faculty) + 1} additional qualified faculty members."
                            ))
                        else:
                            findings.append(ValidationFinding(
                                rule_id="RULE-CROSS-SFR-002",
                                rule_name="Student-to-Faculty Ratio (SFR) Regulatory Norm",
                                category=FindingCategory.CROSS_DOCUMENT,
                                status=ValidationStatus.PASS,
                                severity=RuleSeverity.INFO,
                                explanation=f"Effective Student-to-Faculty Ratio of 1:{sfr} complies with statutory ceiling of 1:{max_sfr:.0f}.",
                                evidence=f"SFR 1:{sfr} (Threshold: <= 1:{max_sfr:.0f})",
                                source_field_ref={"doc_id": doc_objects["FACULTY_LIST"].id, "doc_type": "FACULTY_LIST", "field_key": "total_faculty"},
                                recommended_action=None
                            ))
                except (ValueError, TypeError):
                    pass

        return findings
