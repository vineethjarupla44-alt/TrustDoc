from typing import Any

class RulesEngine:
    @classmethod
    def evaluate_regulatory_compliance(cls, docs_dict: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Evaluates deterministic regulatory criteria (synthetic AICTE norms)
        against extracted document attributes.
        """
        findings = []

        # 1. Land Acreage Norm Evaluation (SYNTH-NORM-1.1.1)
        if "LAND_DEED" in docs_dict:
            deed_data = docs_dict["LAND_DEED"]["fields"]
            land_area = deed_data.get("land_area_acres")
            if land_area is not None:
                MIN_REQUIRED_ACRES = 2.50
                if land_area < MIN_REQUIRED_ACRES:
                    findings.append({
                        "category": "REGULATORY",
                        "severity": "CRITICAL",
                        "rule_code": "SYNTH-NORM-1.1.1",
                        "title": "Institutional Land Deficit Below Prescribed Norm",
                        "description": (
                            f"Identified land extent is {land_area:.2f} Acres, which is below the mandatory requirement "
                            f"of {MIN_REQUIRED_ACRES:.2f} Acres for Technical Institutions in Urban categories."
                        ),
                        "evidence_quote": f"Extracted Deed Land Area: {land_area:.2f} Acres (Required: >= {MIN_REQUIRED_ACRES:.2f} Acres)",
                        "suggested_remediation": "Acquire adjoining contiguous land parcel or apply under special institutional hill/metro relaxations.",
                        "source_document_id": docs_dict["LAND_DEED"].get("doc_id")
                    })

        # 2. Fire Safety NOC Active Status (SYNTH-NORM-3.1.2)
        if "FIRE_NOC" in docs_dict:
            fire_data = docs_dict["FIRE_NOC"]["fields"]
            is_expired = fire_data.get("is_expired", False)
            valid_until = fire_data.get("valid_until_date", "Unknown")

            if is_expired:
                findings.append({
                    "category": "REGULATORY",
                    "severity": "CRITICAL",
                    "rule_code": "SYNTH-NORM-3.1.2",
                    "title": "Expired Fire and Life Safety NOC",
                    "description": (
                        f"The submitted Fire Clearance Certificate expired on {valid_until}. "
                        "An active, valid certificate is mandatory for campus occupancy."
                    ),
                    "evidence_quote": f"Valid Until: {valid_until} (Lapsed)",
                    "suggested_remediation": "Obtain and submit the latest renewed Fire Safety Certificate from the State Fire & Rescue Directorate.",
                    "source_document_id": docs_dict["FIRE_NOC"].get("doc_id")
                    })

        # 3. Student-to-Faculty Ratio (SFR) (SYNTH-NORM-4.1.1)
        if "FACULTY_LIST" in docs_dict:
            fac_data = docs_dict["FACULTY_LIST"]["fields"]
            sfr = fac_data.get("sfr_ratio", 0.0)
            students = fac_data.get("student_count", 0)
            faculty = fac_data.get("total_faculty", 0)

            MAX_PERMISSIBLE_SFR = 15.0
            if sfr > MAX_PERMISSIBLE_SFR:
                findings.append({
                    "category": "REGULATORY",
                    "severity": "WARNING",
                    "rule_code": "SYNTH-NORM-4.1.1",
                    "title": "Student-Faculty Ratio (SFR) Exceeds Regulatory Threshold",
                    "description": (
                        f"Calculated Student-to-Faculty Ratio is 1:{sfr:.1f} ({students} students to {faculty} faculty members), "
                        f"exceeding the standard council benchmark of 1:{MAX_PERMISSIBLE_SFR:.0f}."
                    ),
                    "evidence_quote": f"Total Faculty: {faculty}, Total Students: {students}, Effective SFR: 1:{sfr:.1f}",
                    "suggested_remediation": f"Appoint additional certified faculty members to reduce SFR to within 1:{MAX_PERMISSIBLE_SFR:.0f}.",
                    "source_document_id": docs_dict["FACULTY_LIST"].get("doc_id")
                })

        return findings

    @classmethod
    def calculate_scorecard(cls, all_findings: list[dict[str, Any]], forensics_list: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Computes tripartite scores: Authenticity, Completeness, and Compliance.
        """
        auth_score = 100.0
        comp_score = 100.0
        reg_score = 100.0

        has_high_tamper = False

        # Authenticity deductions from forensics
        for f in forensics_list:
            if f.get("risk_level") == "HIGH":
                auth_score -= 35.0
                has_high_tamper = True
            elif f.get("risk_level") == "MEDIUM":
                auth_score -= 15.0

        # Findings deductions
        for finding in all_findings:
            cat = finding.get("category")
            sev = finding.get("severity")

            deduction = 25.0 if sev == "CRITICAL" else (10.0 if sev == "WARNING" else 2.0)

            if cat == "AUTHENTICITY":
                auth_score -= deduction
            elif cat == "COMPLETENESS":
                comp_score -= deduction
            elif cat == "REGULATORY":
                reg_score -= deduction

        auth_score = max(0.0, min(100.0, round(auth_score, 1)))
        comp_score = max(0.0, min(100.0, round(comp_score, 1)))
        reg_score = max(0.0, min(100.0, round(reg_score, 1)))

        composite = round((auth_score * 0.35) + (comp_score * 0.30) + (reg_score * 0.35), 1)

        # Recommendation synthesis
        critical_count = sum(1 for f in all_findings if f.get("severity") == "CRITICAL")

        if has_high_tamper:
            recommendation = "REJECTED"
        elif critical_count > 0 or composite < 70.0:
            recommendation = "DEFICIENT"
        else:
            recommendation = "ELIGIBLE"

        return {
            "authenticity_score": auth_score,
            "completeness_score": comp_score,
            "compliance_score": reg_score,
            "composite_score": composite,
            "recommendation": recommendation
        }
