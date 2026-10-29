from typing import List, Dict, Any, Optional
from backend.app.services.validation_engine.types import (
    ValidationFinding, ValidationStatus, RuleSeverity
)
from backend.app.services.validation_engine.config import ValidationEngineConfig, default_config
from backend.app.services.validation_engine.modules.required_docs_fields import RequiredDocsAndFieldsValidator
from backend.app.services.validation_engine.modules.field_format import FieldFormatValidator
from backend.app.services.validation_engine.modules.date_expiry import DateAndExpiryValidator
from backend.app.services.validation_engine.modules.duplicate_detection import DuplicateDetectionValidator
from backend.app.services.validation_engine.modules.cross_document import CrossDocumentValidator
from backend.app.services.validation_engine.modules.identity_consistency import IdentityConsistencyValidator
from backend.app.services.validation_engine.modules.category_requirements import CategoryRequirementsValidator

class ValidationEngine:
    """
    Master Deterministic Validation Engine orchestrating all 7 statutory modules.
    Independent of LLMs, configurable, and strictly rules-based.
    """

    @classmethod
    def evaluate(
        cls,
        application: Any,
        documents: List[Any],
        config: Optional[ValidationEngineConfig] = None,
        db: Optional[Any] = None,
        forensics_list: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        cfg = config or default_config
        all_findings: List[ValidationFinding] = []

        # Run Module 1: Required fields & missing documents
        all_findings.extend(RequiredDocsAndFieldsValidator.validate(application, documents, cfg))

        # Run Module 2: Field format validation
        all_findings.extend(FieldFormatValidator.validate(application, documents, cfg))

        # Run Module 3: Date & expiry checks
        all_findings.extend(DateAndExpiryValidator.validate(application, documents, cfg))

        # Run Module 4: Duplicate detection
        all_findings.extend(DuplicateDetectionValidator.validate(application, documents, cfg, db=db))

        # Run Module 5: Cross-document comparisons
        all_findings.extend(CrossDocumentValidator.validate(application, documents, cfg))

        # Run Module 6: Institutional identity consistency with OCR uncertainty guardrail
        all_findings.extend(IdentityConsistencyValidator.validate(application, documents, cfg))

        # Run Module 7: Application category statutory requirements
        all_findings.extend(CategoryRequirementsValidator.validate(application, documents, cfg))

        # Compute counts
        passed_count = sum(1 for f in all_findings if f.status == ValidationStatus.PASS)
        failed_count = sum(1 for f in all_findings if f.status == ValidationStatus.FAIL)
        warning_count = sum(1 for f in all_findings if f.status == ValidationStatus.WARNING)
        review_count = sum(1 for f in all_findings if f.status == ValidationStatus.NEEDS_REVIEW)

        # Compute Tripartite Scorecard
        auth_score = 100.0
        comp_score = 100.0
        reg_score = 100.0

        # Forensics deduction for authenticity
        if forensics_list:
            for f in forensics_list:
                if f.get("risk_level") == "HIGH":
                    auth_score -= 35.0
                elif f.get("risk_level") == "MEDIUM":
                    auth_score -= 15.0

        for f in all_findings:
            if f.status == ValidationStatus.FAIL:
                if f.severity == RuleSeverity.CRITICAL:
                    comp_score -= 20.0 if f.category in ("REQUIRED_DOCS_AND_FIELDS", "DUPLICATE_DETECTION") else 0.0
                    reg_score -= 20.0 if f.category not in ("REQUIRED_DOCS_AND_FIELDS", "DUPLICATE_DETECTION") else 0.0
                    if f.category == "DUPLICATE_DETECTION":
                        auth_score -= 30.0
                elif f.severity == RuleSeverity.WARNING:
                    reg_score -= 5.0
            elif f.status == ValidationStatus.WARNING:
                reg_score -= 5.0
            elif f.status == ValidationStatus.NEEDS_REVIEW:
                reg_score -= 2.0

        auth_score = max(0.0, min(100.0, auth_score))
        comp_score = max(0.0, min(100.0, comp_score))
        reg_score = max(0.0, min(100.0, reg_score))

        composite_score = round((0.35 * auth_score) + (0.35 * comp_score) + (0.30 * reg_score), 1)

        critical_fails = sum(1 for f in all_findings if f.status == ValidationStatus.FAIL and f.severity == RuleSeverity.CRITICAL)

        if composite_score >= 85.0 and critical_fails == 0:
            recommendation = "ELIGIBLE"
        elif composite_score >= 60.0 and critical_fails <= 1:
            recommendation = "DEFICIENT"
        else:
            recommendation = "REJECTED"

        return {
            "findings": all_findings,
            "statistics": {
                "total_rules": len(all_findings),
                "passed_count": passed_count,
                "failed_count": failed_count,
                "warning_count": warning_count,
                "review_count": review_count,
                "critical_fails": critical_fails
            },
            "scorecard": {
                "authenticity_score": auth_score,
                "completeness_score": comp_score,
                "compliance_score": reg_score,
                "composite_score": composite_score,
                "recommendation": recommendation
            },
            "ruleset_version": cfg.version_tag
        }
