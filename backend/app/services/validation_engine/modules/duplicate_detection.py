from typing import List, Dict, Any, Optional
from collections import defaultdict
from backend.app.services.validation_engine.types import (
    ValidationFinding, ValidationStatus, FindingCategory, RuleSeverity
)
from backend.app.services.validation_engine.config import ValidationEngineConfig

class DuplicateDetectionValidator:
    """
    Module 4: Duplicate document hashes and identifiers.
    Detects intra-bundle document recycling and cross-institutional SHA-256 collisions.
    """

    @classmethod
    def validate(
        cls,
        application: Any,
        documents: List[Any],
        config: ValidationEngineConfig,
        db: Optional[Any] = None
    ) -> List[ValidationFinding]:
        findings: List[ValidationFinding] = []
        app_id = getattr(application, "id", None)

        # 1. Intra-Application Document Hash Collisions
        hashes_in_app: Dict[str, List[Any]] = defaultdict(list)
        for doc in documents:
            if doc.sha256_hash:
                hashes_in_app[doc.sha256_hash].append(doc)

        has_intra_duplicates = False
        for sha, doc_list in hashes_in_app.items():
            if len(doc_list) > 1:
                has_intra_duplicates = True
                types_str = ", ".join([d.document_type.replace("_", " ") for d in doc_list])
                names_str = ", ".join([d.file_name for d in doc_list])
                findings.append(ValidationFinding(
                    rule_id="RULE-DUP-INTRA-001",
                    rule_name="Duplicate Document Upload in Application Bundle",
                    category=FindingCategory.DUPLICATE_DETECTION,
                    status=ValidationStatus.FAIL,
                    severity=RuleSeverity.CRITICAL,
                    explanation=(
                        f"Identical file content (SHA-256: {sha[:16]}...) was uploaded for multiple document types: "
                        f"{types_str}. Each statutory requirement must be substantiated by a distinct authentic document."
                    ),
                    evidence=f"Matched Files: [{names_str}] (Hash: {sha})",
                    source_field_ref={"doc_id": doc_list[0].id, "colliding_doc_ids": [d.id for d in doc_list]},
                    recommended_action="Upload the respective individual document for each slot rather than re-using files."
                ))

        if not has_intra_duplicates and documents:
            findings.append(ValidationFinding(
                rule_id="RULE-DUP-INTRA-001",
                rule_name="Duplicate Document Upload in Application Bundle",
                category=FindingCategory.DUPLICATE_DETECTION,
                status=ValidationStatus.PASS,
                severity=RuleSeverity.INFO,
                explanation="All uploaded documents within this application bundle have distinct cryptographic SHA-256 hashes.",
                evidence=f"{len(documents)} distinct document hashes verified",
                source_field_ref=None,
                recommended_action=None
            ))

        # 2. Cross-Application Document Hash Collisions (Plagiarism / Cross-Institutional Reuse)
        if db is not None and app_id:
            try:
                # Query documents from other applications
                from backend.app.models.models import Document as DBDoc, Application as DBApp
                doc_hashes = [d.sha256_hash for d in documents if d.sha256_hash]

                if doc_hashes:
                    colliding_docs = db.query(DBDoc).filter(
                        DBDoc.sha256_hash.in_(doc_hashes),
                        DBDoc.application_id != app_id
                    ).all()

                    has_cross_collision = False
                    for c_doc in colliding_docs:
                        has_cross_collision = True
                        other_app = db.query(DBApp).filter(DBApp.id == c_doc.application_id).first()
                        other_inst = other_app.institution_name if other_app else "Unknown Institution"
                        other_app_no = other_app.application_number if other_app else c_doc.application_id

                        findings.append(ValidationFinding(
                            rule_id="RULE-DUP-CROSS-002",
                            rule_name="Cross-Institutional Document Hash Collision",
                            category=FindingCategory.DUPLICATE_DETECTION,
                            status=ValidationStatus.FAIL,
                            severity=RuleSeverity.CRITICAL,
                            explanation=(
                                f"Submitted document '{c_doc.file_name}' (SHA-256: {c_doc.sha256_hash[:16]}...) is bit-for-bit identical "
                                f"to a document previously submitted by '{other_inst}' (App No: {other_app_no})."
                            ),
                            evidence=f"Colliding SHA-256: {c_doc.sha256_hash} (Found in Application {other_app_no})",
                            source_field_ref={"doc_id": c_doc.id, "colliding_application_id": c_doc.application_id},
                            recommended_action="Provide explanation and upload certified original institutional documentation belonging solely to this applicant."
                        ))

                    if not has_cross_collision:
                        findings.append(ValidationFinding(
                            rule_id="RULE-DUP-CROSS-002",
                            rule_name="Cross-Institutional Document Hash Collision",
                            category=FindingCategory.DUPLICATE_DETECTION,
                            status=ValidationStatus.PASS,
                            severity=RuleSeverity.INFO,
                            explanation="Zero hash collisions detected against historical repository of institutional applications.",
                            evidence="100% unique across accreditation database",
                            source_field_ref=None,
                            recommended_action=None
                        ))
            except Exception as e:
                # Fail gracefully if DB query issues occur
                pass

        return findings
