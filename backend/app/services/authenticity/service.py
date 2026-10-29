from pathlib import Path
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.services.authenticity.types import (
    AuthenticityState,
    AuthenticityCheckResult,
    DocumentAuthenticityDossier
)
from backend.app.services.authenticity.checks import (
    HashCollisionChecker,
    FormatSignatureChecker,
    MetadataChecker,
    ELAChecker,
    OpenCVInspectionChecker,
    QRTrustChecker,
    DigitalSignatureChecker
)
from backend.app.services.authenticity.heatmap_generator import HeatmapGenerator

class AuthenticityScreeningService:
    """
    Master orchestrator for multi-layer non-destructive document authenticity screening.
    Executes all 7 modular checks, generates real heatmaps when mathematically warranted,
    and synthesizes an epistemic forensic dossier.
    """

    @classmethod
    def run_all_checks(
        cls,
        file_path: Path | str,
        document_id: Optional[str] = None,
        db: Optional[Session] = None
    ) -> DocumentAuthenticityDossier:
        file_path = Path(file_path)
        doc_id_str = document_id or "temp_doc"

        # 1. Cryptographic Hashes & Duplicate Collision
        hash_res = HashCollisionChecker.check(file_path, current_doc_id=document_id, db=db)
        sha256_hash = hash_res.evidence.get("sha256", "")

        # 2. File Signature & Container Integrity
        format_res = FormatSignatureChecker.check(file_path)

        # 3. Metadata Analysis & Authoring Footprints
        metadata_res = MetadataChecker.check(file_path)

        # 4. Error Level Analysis (ELA)
        ela_res, diff_arr, ela_anomaly_score = ELAChecker.check(file_path)

        # 5. OpenCV Sensor & Feature Inspection
        cv_res = OpenCVInspectionChecker.check(file_path)

        # 6. QR-Code Trust Verification
        qr_res = QRTrustChecker.check(file_path)

        # 7. Digital Signature (PKI) Verification
        sig_res = DigitalSignatureChecker.check(file_path)

        # 8. Genuine Heatmap Generation (only when mathematically triggered)
        heatmap_generated = False
        heatmap_path = None
        heatmap_type = None

        heatmap_output_path = file_path.parent / f"{doc_id_str}_heatmap.png"
        heatmap_info = HeatmapGenerator.generate_ela_heatmap(
            file_path=file_path,
            output_path=heatmap_output_path,
            diff_array=diff_arr,
            anomaly_score=ela_anomaly_score
        )

        if heatmap_info.get("generated"):
            heatmap_generated = True
            heatmap_path = str(heatmap_output_path)
            heatmap_type = "ELA_LOCALIZED_RESIDUAL"
            ela_res.suspicious_regions = heatmap_info.get("regions", [])

        checks: List[AuthenticityCheckResult] = [
            hash_res,
            format_res,
            metadata_res,
            ela_res,
            cv_res,
            qr_res,
            sig_res
        ]

        # Synthesize Overall Verdict & Risk Score
        states = [c.state for c in checks]
        has_mismatch = any(s == AuthenticityState.MISMATCH for s in states)
        suspicious_count = sum(1 for s in states if s == AuthenticityState.SUSPICIOUS_INDICATOR)
        needs_review_count = sum(1 for s in states if s == AuthenticityState.NEEDS_MANUAL_REVIEW)

        if has_mismatch:
            overall_verdict = AuthenticityState.MISMATCH
            risk_level = "HIGH"
            risk_score = 92.0
        elif suspicious_count >= 2 or ela_anomaly_score > 65.0:
            overall_verdict = AuthenticityState.SUSPICIOUS_INDICATOR
            risk_level = "HIGH"
            risk_score = 80.0
        elif suspicious_count == 1:
            overall_verdict = AuthenticityState.SUSPICIOUS_INDICATOR
            risk_level = "MEDIUM"
            risk_score = 55.0
        elif needs_review_count > 0 or ela_anomaly_score >= 35.0:
            overall_verdict = AuthenticityState.NEEDS_MANUAL_REVIEW
            risk_level = "MEDIUM"
            risk_score = 42.0
        else:
            overall_verdict = AuthenticityState.VERIFIED
            risk_level = "LOW"
            risk_score = 8.0

        # Construct human-readable remarks
        flagged_explanations = [c.explanation for c in checks if c.state in [
            AuthenticityState.MISMATCH,
            AuthenticityState.SUSPICIOUS_INDICATOR,
            AuthenticityState.NEEDS_MANUAL_REVIEW
        ]]

        if flagged_explanations:
            remarks = "Screening observations: " + "; ".join(flagged_explanations)
        else:
            remarks = (
                "Cryptographic checksum unique, container syntax valid, and metadata/compression profiles "
                "conform to standard institutional authoring pipelines."
            )

        return DocumentAuthenticityDossier(
            document_id=doc_id_str,
            sha256_hash=sha256_hash,
            overall_verdict=overall_verdict,
            risk_level=risk_level,
            risk_score=risk_score,
            checks=checks,
            heatmap_generated=heatmap_generated,
            heatmap_path=heatmap_path,
            heatmap_type=heatmap_type,
            remarks=remarks
        )

    @classmethod
    def screen_document(
        cls,
        file_path: Path | str,
        document_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Screens an uploaded document, persists the dossier to the database,
        and returns the dictionary payload matching DocumentForensics schema.
        """
        dossier = cls.run_all_checks(file_path=file_path, document_id=document_id, db=db)
        
        # Prepare JSON serializable checks
        screening_results_json = [c.model_dump() for c in dossier.checks]

        # Extract legacy compatibility fields
        hash_check = next((c for c in dossier.checks if c.check_code == "AUTH_HASH_COLLISION"), None)
        meta_check = next((c for c in dossier.checks if c.check_code == "AUTH_METADATA_ANALYSIS"), None)
        ela_check = next((c for c in dossier.checks if c.check_code == "AUTH_ELA_COMPRESSION"), None)
        qr_check = next((c for c in dossier.checks if c.check_code == "AUTH_QR_TRUST_VERIFY"), None)
        sig_check = next((c for c in dossier.checks if c.check_code == "AUTH_DIGITAL_SIG_PKI"), None)

        metadata_dump = meta_check.evidence if meta_check else {}
        metadata_mismatch_flag = (
            meta_check is not None and 
            meta_check.state in [AuthenticityState.MISMATCH, AuthenticityState.SUSPICIOUS_INDICATOR]
        )

        qr_detected = qr_check.evidence.get("qr_detected", False) if qr_check else False
        qr_payload = qr_check.evidence if qr_check else None

        sig_present = sig_check.evidence.get("digital_signature_present", False) if sig_check else False
        sig_valid = sig_check.state == AuthenticityState.VERIFIED if sig_check else False
        signer_id = sig_check.evidence.get("signer_identity") if sig_check else None

        from backend.app.models.models import AuthenticityFinding, Document
        
        # Update or create AuthenticityFinding in DB
        finding = db.query(AuthenticityFinding).filter(AuthenticityFinding.document_id == document_id).first()
        if not finding:
            finding = AuthenticityFinding(document_id=document_id)
            db.add(finding)

        finding.ela_anomaly_score = dossier.checks[3].anomaly_score if len(dossier.checks) > 3 else 0.0
        finding.metadata_mismatch_flag = metadata_mismatch_flag
        finding.metadata_dump = metadata_dump
        finding.qr_detected = qr_detected
        finding.qr_payload = qr_payload
        finding.digital_signature_present = sig_present
        finding.signature_valid = sig_valid
        finding.signer_identity = signer_id
        finding.risk_level = dossier.risk_level
        finding.remarks = dossier.remarks
        
        # Store enhanced attributes
        finding.screening_results = screening_results_json
        finding.heatmap_path = dossier.heatmap_path
        finding.heatmap_generated = dossier.heatmap_generated

        # Also update sha256_hash on Document if present
        doc_record = db.query(Document).filter(Document.id == document_id).first()
        if doc_record and dossier.sha256_hash:
            doc_record.sha256_hash = dossier.sha256_hash

        db.commit()
        db.refresh(finding)

        return {
            "id": finding.id,
            "document_id": document_id,
            "sha256_hash": dossier.sha256_hash,
            "overall_verdict": dossier.overall_verdict.value,
            "ela_anomaly_score": finding.ela_anomaly_score,
            "metadata_mismatch_flag": finding.metadata_mismatch_flag,
            "metadata_dump": finding.metadata_dump,
            "qr_detected": finding.qr_detected,
            "qr_payload": finding.qr_payload,
            "digital_signature_present": finding.digital_signature_present,
            "signature_valid": finding.signature_valid,
            "signer_identity": finding.signer_identity,
            "risk_level": finding.risk_level,
            "remarks": finding.remarks,
            "screening_results": screening_results_json,
            "heatmap_generated": dossier.heatmap_generated,
            "heatmap_path": dossier.heatmap_path,
            "disclaimer": dossier.disclaimer
        }

    @classmethod
    def full_screening(cls, file_path: Path | str) -> Dict[str, Any]:
        """
        Backwards-compatible drop-in replacement for legacy ForensicService.full_screening.
        """
        dossier = cls.run_all_checks(file_path=file_path)
        meta_check = next((c for c in dossier.checks if c.check_code == "AUTH_METADATA_ANALYSIS"), None)
        ela_check = next((c for c in dossier.checks if c.check_code == "AUTH_ELA_COMPRESSION"), None)
        qr_check = next((c for c in dossier.checks if c.check_code == "AUTH_QR_TRUST_VERIFY"), None)
        sig_check = next((c for c in dossier.checks if c.check_code == "AUTH_DIGITAL_SIG_PKI"), None)

        metadata_dump = meta_check.evidence if meta_check else {}
        metadata_mismatch = (
            meta_check is not None and 
            meta_check.state in [AuthenticityState.MISMATCH, AuthenticityState.SUSPICIOUS_INDICATOR]
        )

        qr_detected = qr_check.evidence.get("qr_detected", False) if qr_check else False
        qr_payload = qr_check.evidence.get("raw_payload") if qr_check else None

        sig_present = sig_check.evidence.get("digital_signature_present", False) if sig_check else False
        sig_valid = sig_check.state == AuthenticityState.VERIFIED if sig_check else False
        signer_id = sig_check.evidence.get("signer_identity") if sig_check else None

        return {
            "sha256_hash": dossier.sha256_hash,
            "ela_anomaly_score": ela_check.anomaly_score if ela_check else 0.0,
            "metadata_mismatch_flag": metadata_mismatch,
            "metadata_dump": metadata_dump,
            "qr_detected": qr_detected,
            "qr_payload": {"raw_text": qr_payload} if qr_payload else None,
            "digital_signature_present": sig_present,
            "signature_valid": sig_valid,
            "signer_identity": signer_id,
            "risk_level": dossier.risk_level,
            "remarks": dossier.remarks,
            "screening_results": [c.model_dump() for c in dossier.checks],
            "heatmap_generated": dossier.heatmap_generated,
            "heatmap_path": dossier.heatmap_path,
            "disclaimer": dossier.disclaimer
        }
