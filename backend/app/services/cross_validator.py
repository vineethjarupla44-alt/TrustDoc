from typing import Any

class CrossValidator:
    MANDATORY_DOC_TYPES = ["LAND_DEED", "BUILDING_PLAN", "FIRE_NOC", "FACULTY_LIST"]

    @classmethod
    def validate_application_documents(cls, docs_dict: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Performs inter-document consistency cross-referencing and missing-field audits.
        docs_dict format: {doc_type: {"doc_id": ..., "fields": {...}, "file_name": ...}}
        """
        findings = []

        # 1. Missing Mandatory Documents Check
        for m_type in cls.MANDATORY_DOC_TYPES:
            if m_type not in docs_dict:
                human_name = m_type.replace("_", " ").title()
                findings.append({
                    "category": "COMPLETENESS",
                    "severity": "CRITICAL",
                    "rule_code": "SYNTH-CHECKLIST-1.0",
                    "title": f"Missing Mandatory Document: {human_name}",
                    "description": f"The institutional accreditation bundle requires an official {human_name}. No document was uploaded.",
                    "evidence_quote": None,
                    "suggested_remediation": f"Upload the sanctioned {human_name} before submitting for council evaluation.",
                    "source_document_id": None
                })

        # 2. Cross-Document Land Extent Audit (Land Deed vs Building Plan)
        if "LAND_DEED" in docs_dict and "BUILDING_PLAN" in docs_dict:
            deed_data = docs_dict["LAND_DEED"]["fields"]
            plan_data = docs_dict["BUILDING_PLAN"]["fields"]

            deed_area = deed_data.get("land_area_acres")
            plan_area = plan_data.get("total_plot_area_acres")

            if deed_area is not None and plan_area is not None:
                diff = abs(deed_area - plan_area)
                if diff > 0.05:  # Tolerance threshold
                    findings.append({
                        "category": "COMPLETENESS",
                        "severity": "CRITICAL",
                        "rule_code": "SYNTH-NORM-5.1.1",
                        "title": "Cross-Document Land Extent Discrepancy",
                        "description": (
                            f"Land Title Deed cites {deed_area:.2f} Acres, whereas the Approved Building Master Plan "
                            f"cites {plan_area:.2f} Acres. The unexplained variance of {diff:.2f} Acres exceeds permissible limits."
                        ),
                        "evidence_quote": f"Title Deed: {deed_area:.2f} Acres vs Building Plan: {plan_area:.2f} Acres (Variance: {diff:.2f} Acres)",
                        "suggested_remediation": (
                            f"Provide a registered Rectification Deed or submit an updated site plan reconciling the {diff:.2f} Acre difference."
                        ),
                        "source_document_id": docs_dict["BUILDING_PLAN"].get("doc_id")
                    })

        # 3. Missing Architect Registration Number Audit
        if "BUILDING_PLAN" in docs_dict:
            plan_data = docs_dict["BUILDING_PLAN"]["fields"]
            coa_no = plan_data.get("coa_registration_no")
            if not coa_no or coa_no.lower() in ("none", "null", ""):
                findings.append({
                    "category": "COMPLETENESS",
                    "severity": "WARNING",
                    "rule_code": "SYNTH-NORM-2.1.1",
                    "title": "Missing Architect Council Registration Endorsement",
                    "description": (
                        "The submitted Master Plan layout does not contain a verified Council of Architecture (COA) "
                        "registration number for the certifying architect."
                    ),
                    "evidence_quote": f"Architect: {plan_data.get('architect_name', 'Not Specified')}, COA Registration: Blank",
                    "suggested_remediation": "Resubmit building blueprints bearing the signature and valid COA registration seal (CA/YYYY/NNNNN) of the chartered architect.",
                    "source_document_id": docs_dict["BUILDING_PLAN"].get("doc_id")
                })

        return findings
