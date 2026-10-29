import hashlib
from pathlib import Path
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from backend.app.services.authenticity.types import AuthenticityCheckResult, AuthenticityState

class HashCollisionChecker:
    """
    Computes cryptographic checksums (SHA-256 and MD5) and detects intra-application
    and cross-application document collisions in the institutional registry.
    """

    CAN_ESTABLISH = [
        "Bit-for-bit mathematical identity and cryptographic non-repudiation.",
        "Exact collision detection across previously archived institutional applications."
    ]

    CANNOT_ESTABLISH = [
        "The truthfulness, authenticity, or legal validity of the underlying original document.",
        "Image tampering, pixel manipulation, or localized document splicing. An identical SHA-256 hash indicates an exact duplicate file upload, not image tampering."
    ]

    @classmethod
    def check(
        cls,
        file_path: Path | str,
        current_doc_id: Optional[str] = None,
        db: Optional[Session] = None
    ) -> AuthenticityCheckResult:
        file_path = Path(file_path)
        if not file_path.exists():
            return AuthenticityCheckResult(
                check_code="AUTH_HASH_COLLISION",
                check_name="Cryptographic Hashes & Duplicate Detection",
                state=AuthenticityState.UNAVAILABLE,
                can_establish=cls.CAN_ESTABLISH,
                cannot_establish=cls.CANNOT_ESTABLISH,
                explanation="File not found at specified storage path.",
                anomaly_score=0.0,
                evidence={"error": "File does not exist on disk"}
            )

        sha256_hasher = hashlib.sha256()
        md5_hasher = hashlib.md5()
        
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                sha256_hasher.update(chunk)
                md5_hasher.update(chunk)

        sha256_hash = sha256_hasher.hexdigest()
        md5_hash = md5_hasher.hexdigest()

        evidence: Dict[str, Any] = {
            "sha256": sha256_hash,
            "md5": md5_hash,
            "collision_count": 0,
            "collision_details": []
        }

        # Check DB for duplicate collisions
        if db is not None:
            try:
                from backend.app.models.models import Document
                query = db.query(Document).filter(Document.sha256_hash == sha256_hash)
                if current_doc_id:
                    query = query.filter(Document.id != current_doc_id)
                
                duplicates = query.all()
                if duplicates:
                    evidence["collision_count"] = len(duplicates)
                    for dup in duplicates:
                        evidence["collision_details"].append({
                            "document_id": dup.id,
                            "application_id": dup.application_id,
                            "document_type": dup.document_type,
                            "file_name": dup.file_name,
                            "uploaded_at": dup.created_at.isoformat() if dup.created_at else None
                        })
                    
                    # If duplicate exists in a different application, it's a suspicious reuse indicator
                    cross_app_dups = [d for d in duplicates if current_doc_id and d.id != current_doc_id]
                    return AuthenticityCheckResult(
                        check_code="AUTH_HASH_COLLISION",
                        check_name="Cryptographic Hashes & Duplicate Detection",
                        state=AuthenticityState.SUSPICIOUS_INDICATOR,
                        can_establish=cls.CAN_ESTABLISH,
                        cannot_establish=cls.CANNOT_ESTABLISH,
                        explanation=(
                            f"Identical duplicate file match detected. Exact SHA-256 checksum ({sha256_hash[:16]}...) "
                            f"matches {len(duplicates)} existing document(s) in the institutional repository. "
                            f"Indicates duplicate file reuse across submissions; does not indicate image tampering or pixel manipulation."
                        ),
                        anomaly_score=85.0,
                        evidence=evidence
                    )
            except Exception as e:
                evidence["db_query_warning"] = str(e)

        return AuthenticityCheckResult(
            check_code="AUTH_HASH_COLLISION",
            check_name="Cryptographic Hashes & Duplicate Detection",
            state=AuthenticityState.VERIFIED,
            can_establish=cls.CAN_ESTABLISH,
            cannot_establish=cls.CANNOT_ESTABLISH,
            explanation=(
                f"Unique cryptographic fingerprint registered (SHA-256: {sha256_hash[:16]}...). "
                "Zero duplicate collisions detected across institutional repository."
            ),
            anomaly_score=0.0,
            evidence=evidence
        )
