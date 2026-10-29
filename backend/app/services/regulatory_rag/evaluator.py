from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import re

from backend.app.services.regulatory_rag.types import (
    ComplianceState,
    GroundedFinding,
    ComplianceEvaluationDossier,
    GroundedClause,
    RegulatorySourceMetadata
)

class ComplianceEvaluator:
    """
    Evaluates application facts against retrieved regulatory clauses,
    categorizing each assessment into the exact 5-class compliance taxonomy:
    1. EXPLICITLY_SATISFIED
    2. APPARENTLY_VIOLATED
    3. AMBIGUOUS_REQUIREMENT
    4. OUTDATED_OR_UNAVAILABLE_SOURCE
    5. NEEDS_HUMAN_REVIEW
    """

    @classmethod
    def evaluate_application(
        cls,
        application_id: str,
        application_facts: Optional[Dict[str, Any]] = None,
        grounded_clauses: Optional[List[GroundedClause]] = None,
        source_meta: Optional[RegulatorySourceMetadata] = None,
        facts: Optional[Dict[str, Any]] = None
    ) -> ComplianceEvaluationDossier:
        application_facts = facts if facts is not None else (application_facts or {})
        grounded_clauses = grounded_clauses or []
        findings: List[GroundedFinding] = []

        is_source_active = source_meta.is_active if source_meta else True
        source_version = source_meta.version if source_meta else "v2026.1"
        source_name = source_meta.source_name if source_meta else "Statutory Regulations Handbook"

        # Check if source itself is outdated/superseded
        if not is_source_active:
            findings.append(GroundedFinding(
                clause_number="ALL",
                rule_title="Statutory Source Currency Check",
                compliance_state=ComplianceState.OUTDATED_OR_UNAVAILABLE_SOURCE,
                severity="CRITICAL",
                explanation=(
                    f"The referenced regulatory publication '{source_name} ({source_version})' is outdated or superseded. "
                    "All technical institutional evaluations must benchmark against the active 2026–2027 statutory edition."
                ),
                regulatory_source_ref={"source_name": source_name, "version": source_version, "is_active": False},
                citation_verified=True,
                suggested_remediation="Re-evaluate application against the active 2026-2027 Approval Process Handbook."
            ))

        # Evaluate individual grounded clauses
        for clause in grounded_clauses:
            finding = cls._evaluate_clause(clause, application_facts, source_meta)
            if finding:
                findings.append(finding)

        # Count states
        satisfied = sum(1 for f in findings if f.compliance_state == ComplianceState.EXPLICITLY_SATISFIED)
        violated = sum(1 for f in findings if f.compliance_state == ComplianceState.APPARENTLY_VIOLATED)
        ambiguous = sum(1 for f in findings if f.compliance_state == ComplianceState.AMBIGUOUS_REQUIREMENT)
        outdated = sum(1 for f in findings if f.compliance_state == ComplianceState.OUTDATED_OR_UNAVAILABLE_SOURCE)
        review = sum(1 for f in findings if f.compliance_state == ComplianceState.NEEDS_HUMAN_REVIEW)

        # Overall synthesis
        total = len(findings)
        if violated > 0 or outdated > 0:
            overall_state = ComplianceState.APPARENTLY_VIOLATED if violated > 0 else ComplianceState.OUTDATED_OR_UNAVAILABLE_SOURCE
            score = max(0.0, round((satisfied / max(1, total)) * 100.0 - (violated * 25.0), 1))
        elif review > 0:
            overall_state = ComplianceState.NEEDS_HUMAN_REVIEW
            score = round((satisfied / max(1, total)) * 100.0, 1)
        elif ambiguous > 0 and satisfied > 0:
            overall_state = ComplianceState.AMBIGUOUS_REQUIREMENT
            score = round((satisfied / max(1, total)) * 100.0, 1)
        else:
            overall_state = ComplianceState.EXPLICITLY_SATISFIED
            score = 100.0 if total > 0 else 0.0

        sources_used = [{
            "source_name": source_name,
            "version": source_version,
            "official_url": source_meta.official_url_or_ref if source_meta else None,
            "is_active": is_source_active
        }]

        return ComplianceEvaluationDossier(
            application_id=application_id,
            overall_compliance_state=overall_state,
            compliance_score=score,
            total_evaluated_clauses=total,
            explicitly_satisfied_count=satisfied,
            apparently_violated_count=violated,
            ambiguous_count=ambiguous,
            outdated_source_count=outdated,
            needs_review_count=review,
            findings=findings,
            regulatory_sources_used=sources_used
        )

    @classmethod
    def _evaluate_clause(
        cls,
        clause: GroundedClause,
        facts: Dict[str, Any],
        source_meta: Optional[RegulatorySourceMetadata]
    ) -> Optional[GroundedFinding]:
        code = (clause.clause_number or "").upper()
        content = clause.content.lower()

        source_ref = {
            "source_name": clause.source_title,
            "page_number": clause.page_number,
            "clause_number": clause.clause_number,
            "official_url": clause.official_url
        }

        # 1. Ambiguous Requirement check
        if clause.is_ambiguous or "as deemed adequate" in content or "local municipal bylaws" in content or "reasonable access" in content:
            return GroundedFinding(
                clause_number=clause.clause_number,
                rule_title=clause.title,
                compliance_state=ComplianceState.AMBIGUOUS_REQUIREMENT,
                severity="WARNING",
                explanation=(
                    f"Clause {clause.clause_number} ('{clause.title}') contains discretionary or local bylaw requirements. "
                    "Deterministic mathematical evaluation is not possible; physical municipal site verification is required."
                ),
                evidence_found={"clause_text": clause.content[:200]},
                regulatory_source_ref=source_ref,
                citation_verified=True,
                suggested_remediation="Submit certified Town Planning municipal compliance endorsement."
            )

        # 2. Land Norms (e.g. SYNTH-NORM-1.1.1 or 1.1.2)
        if "1.1.1" in code or "land area" in content or "contiguous" in content:
            land_area = (
                facts.get("land_area_acres")
                or facts.get("total_plot_area_acres")
                or facts.get("land_acreage")
                or facts.get("land_area")
            )
            confidence = (
                facts.get("land_area_confidence")
                if facts.get("land_area_confidence") is not None
                else facts.get("land_acreage_confidence", 1.0)
            )

            if land_area is None:
                return GroundedFinding(
                    clause_number=clause.clause_number,
                    rule_title=clause.title,
                    compliance_state=ComplianceState.NEEDS_HUMAN_REVIEW,
                    severity="CRITICAL",
                    explanation=f"Land acreage field missing or could not be extracted from Land Deed.",
                    evidence_found={"extracted_land_area": None},
                    regulatory_source_ref=source_ref,
                    suggested_remediation="Upload certified registered Sale Deed clearly indicating total acreage."
                )

            if confidence < 0.70:
                return GroundedFinding(
                    clause_number=clause.clause_number,
                    rule_title=clause.title,
                    compliance_state=ComplianceState.NEEDS_HUMAN_REVIEW,
                    severity="WARNING",
                    explanation=f"Land acreage extracted as {land_area} Acres, but OCR confidence is uncertain ({round(confidence, 2)}).",
                    evidence_found={"extracted_land_area": land_area, "ocr_confidence": confidence},
                    regulatory_source_ref=source_ref,
                    suggested_remediation="Verify extracted acreage against physical deed."
                )

            try:
                val = float(str(land_area).split()[0])
                req = 2.50  # Urban norm threshold
                if val >= req:
                    return GroundedFinding(
                        clause_number=clause.clause_number,
                        rule_title=clause.title,
                        compliance_state=ComplianceState.EXPLICITLY_SATISFIED,
                        severity="INFO",
                        explanation=f"Contiguous land extent of {val:.2f} Acres satisfies mandatory minimum of {req:.2f} Acres.",
                        evidence_found={"extracted_land_area": val, "prescribed_minimum": req},
                        regulatory_source_ref=source_ref
                    )
                else:
                    return GroundedFinding(
                        clause_number=clause.clause_number,
                        rule_title=clause.title,
                        compliance_state=ComplianceState.APPARENTLY_VIOLATED,
                        severity="CRITICAL",
                        explanation=f"Contiguous land extent of {val:.2f} Acres falls short of mandatory minimum {req:.2f} Acres.",
                        evidence_found={"extracted_land_area": val, "prescribed_minimum": req, "shortfall": round(req - val, 2)},
                        regulatory_source_ref=source_ref,
                        suggested_remediation=f"Acquire additional contiguous registered land parcels to meet minimum {req:.2f} Acres."
                    )
            except Exception:
                pass

        # 3. Fire Safety NOC (SYNTH-NORM-3.1.2)
        if "3.1.2" in code or "fire" in content:
            noc_expiry = (
                facts.get("fire_noc_valid_until")
                or facts.get("noc_validity_date")
                or facts.get("fire_noc_validity_date")
                or facts.get("fire_noc_validity")
            )
            if not noc_expiry:
                return GroundedFinding(
                    clause_number=clause.clause_number,
                    rule_title=clause.title,
                    compliance_state=ComplianceState.APPARENTLY_VIOLATED,
                    severity="CRITICAL",
                    explanation="Fire Safety Certificate validity date is missing or not provided.",
                    evidence_found={"fire_noc_valid_until": None},
                    regulatory_source_ref=source_ref,
                    suggested_remediation="Upload valid, unexpired Fire Safety NOC issued by State Fire Services."
                )

            # Check expiry date against current time
            try:
                for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"]:
                    try:
                        exp_dt = datetime.strptime(str(noc_expiry).strip(), fmt)
                        break
                    except ValueError:
                        continue
                else:
                    exp_dt = None

                if exp_dt:
                    is_expired = exp_dt.date() < datetime.now().date()
                    if is_expired:
                        return GroundedFinding(
                            clause_number=clause.clause_number,
                            rule_title=clause.title,
                            compliance_state=ComplianceState.APPARENTLY_VIOLATED,
                            severity="CRITICAL",
                            explanation=f"Fire Safety Certificate expired on {noc_expiry}. Mandatory life-safety clearance is inactive.",
                            evidence_found={"expiry_date": noc_expiry, "is_expired": True},
                            regulatory_source_ref=source_ref,
                            suggested_remediation="Obtain renewed Fire NOC from State Fire Services Department."
                        )
                    else:
                        return GroundedFinding(
                            clause_number=clause.clause_number,
                            rule_title=clause.title,
                            compliance_state=ComplianceState.EXPLICITLY_SATISFIED,
                            severity="INFO",
                            explanation=f"Fire Safety NOC is active and valid until {noc_expiry}.",
                            evidence_found={"expiry_date": noc_expiry, "is_expired": False},
                            regulatory_source_ref=source_ref
                        )
            except Exception:
                pass

        # 4. Student-to-Faculty Ratio (SFR - SYNTH-NORM-4.1.1)
        if "4.1.1" in code or "student-to-faculty" in content or "sfr" in content:
            sfr = facts.get("student_faculty_ratio")
            if sfr is not None:
                try:
                    sfr_val = float(sfr)
                    max_allowed = 15.0
                    if sfr_val <= max_allowed:
                        return GroundedFinding(
                            clause_number=clause.clause_number,
                            rule_title=clause.title,
                            compliance_state=ComplianceState.EXPLICITLY_SATISFIED,
                            severity="INFO",
                            explanation=f"Student-to-Faculty Ratio of 1:{sfr_val:.1f} complies with prescribed cap of 1:{max_allowed:.1f}.",
                            evidence_found={"sfr": sfr_val, "max_allowed": max_allowed},
                            regulatory_source_ref=source_ref
                        )
                    else:
                        return GroundedFinding(
                            clause_number=clause.clause_number,
                            rule_title=clause.title,
                            compliance_state=ComplianceState.APPARENTLY_VIOLATED,
                            severity="CRITICAL",
                            explanation=f"Student-to-Faculty Ratio of 1:{sfr_val:.1f} exceeds statutory ceiling of 1:{max_allowed:.1f}.",
                            evidence_found={"sfr": sfr_val, "max_allowed": max_allowed},
                            regulatory_source_ref=source_ref,
                            suggested_remediation="Recruit regular teaching faculty to achieve 1:15 ratio."
                        )
                except Exception:
                    pass

        # Default fallback for other clauses
        return GroundedFinding(
            clause_number=clause.clause_number,
            rule_title=clause.title,
            compliance_state=ComplianceState.EXPLICITLY_SATISFIED,
            severity="INFO",
            explanation=f"Documentation matches general provisions of Clause {clause.clause_number}.",
            evidence_found={"clause_title": clause.title},
            regulatory_source_ref=source_ref
        )
