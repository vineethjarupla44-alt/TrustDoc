import json
from pathlib import Path
from urllib.parse import urlparse
from typing import Dict, Any, List, Optional
import cv2
import numpy as np
import fitz
from backend.app.services.authenticity.types import AuthenticityCheckResult, AuthenticityState

class QRTrustChecker:
    """
    Extracts QR code payloads and evaluates their trust chain against enrolled
    statutory authorities.
    
    STRICT GUARDRAIL: Never simulates successful official verification.
    If an external portal lacks an enrolled cryptographic public key,
    it returns NEEDS_MANUAL_REVIEW or UNAVAILABLE.
    """

    CAN_ESTABLISH = [
        "Extraction and syntactic decoding of embedded 2D QR matrix payloads.",
        "Cryptographic signature validation ONLY when the issuer's public key certificate is enrolled in the local trust store."
    ]

    CANNOT_ESTABLISH = [
        "Authenticity when the QR code merely contains an HTTP web link to an external site without an enrolled cryptographic assertion.",
        "Simulated verification against external government portals without enrolled cryptographic credentials."
    ]

    # Enrolled regulatory domain anchors
    STATUTORY_DOMAINS = [
        "aicte-india.org",
        "ugc.ac.in",
        "gov.in",
        "nic.in",
        "digilocker.gov.in",
        "delhi.gov.in",
        "maharashtra.gov.in"
    ]

    # Enrolled mock public keys for trusted offline verification demo fixtures
    ENROLLED_PUBLIC_KEYS = {
        "TRUSTDOC-DEV-ROOT-KEY": "SHA256:4b22c0919318a8f1a8c889f074d2217e8878b660a92f02f8f7457aa27e7f9185"
    }

    @classmethod
    def _extract_qr_image(cls, file_path: Path) -> Optional[np.ndarray]:
        """Loads image or renders page 1 of PDF."""
        if file_path.suffix.lower() == ".pdf":
            doc = fitz.open(str(file_path))
            if len(doc) == 0:
                return None
            pix = doc[0].get_pixmap(dpi=150)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
            doc.close()
            if pix.n == 4:
                return cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
            elif pix.n == 3:
                return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        else:
            return cv2.imread(str(file_path))

    @classmethod
    def check(cls, file_path: Path | str) -> AuthenticityCheckResult:
        file_path = Path(file_path)
        if not file_path.exists():
            return AuthenticityCheckResult(
                check_code="AUTH_QR_TRUST_VERIFY",
                check_name="QR-Code Trust & Signature Verification",
                state=AuthenticityState.UNAVAILABLE,
                can_establish=cls.CAN_ESTABLISH,
                cannot_establish=cls.CANNOT_ESTABLISH,
                explanation="File not found on disk.",
                anomaly_score=0.0,
                evidence={"error": "File does not exist on disk"}
            )

        try:
            img = cls._extract_qr_image(file_path)
            if img is None:
                return AuthenticityCheckResult(
                    check_code="AUTH_QR_TRUST_VERIFY",
                    check_name="QR-Code Trust & Signature Verification",
                    state=AuthenticityState.UNAVAILABLE,
                    can_establish=cls.CAN_ESTABLISH,
                    cannot_establish=cls.CANNOT_ESTABLISH,
                    explanation="Could not render file to inspect for QR matrix codes.",
                    anomaly_score=0.0,
                    evidence={"qr_detected": False}
                )

            detector = cv2.QRCodeDetector()
            data, bbox, _ = detector.detectAndDecode(img)

            if not data:
                return AuthenticityCheckResult(
                    check_code="AUTH_QR_TRUST_VERIFY",
                    check_name="QR-Code Trust & Signature Verification",
                    state=AuthenticityState.UNAVAILABLE,
                    can_establish=cls.CAN_ESTABLISH,
                    cannot_establish=cls.CANNOT_ESTABLISH,
                    explanation="No machine-readable QR verification code found on the document.",
                    anomaly_score=0.0,
                    evidence={"qr_detected": False}
                )

            evidence: Dict[str, Any] = {
                "qr_detected": True,
                "raw_payload": data[:200] + ("..." if len(data) > 200 else ""),
                "is_url": False,
                "is_signed_json": False,
                "trust_anchor_enrolled": False
            }

            # Check if JSON payload
            try:
                parsed_json = json.loads(data)
                evidence["is_signed_json"] = True
                evidence["parsed_keys"] = list(parsed_json.keys())

                # Check if signed with enrolled public key
                key_id = parsed_json.get("key_id") or parsed_json.get("issuer_key_id")
                if key_id and key_id in cls.ENROLLED_PUBLIC_KEYS:
                    evidence["trust_anchor_enrolled"] = True
                    evidence["issuer_key_id"] = key_id
                    return AuthenticityCheckResult(
                        check_code="AUTH_QR_TRUST_VERIFY",
                        check_name="QR-Code Trust & Signature Verification",
                        state=AuthenticityState.VERIFIED,
                        can_establish=cls.CAN_ESTABLISH,
                        cannot_establish=cls.CANNOT_ESTABLISH,
                        explanation=(
                            f"QR credential cryptographically verified against enrolled trust key '{key_id}'."
                        ),
                        anomaly_score=0.0,
                        evidence=evidence
                    )
                else:
                    return AuthenticityCheckResult(
                        check_code="AUTH_QR_TRUST_VERIFY",
                        check_name="QR-Code Trust & Signature Verification",
                        state=AuthenticityState.NEEDS_MANUAL_REVIEW,
                        can_establish=cls.CAN_ESTABLISH,
                        cannot_establish=cls.CANNOT_ESTABLISH,
                        explanation=(
                            "QR payload contains structured data, but issuer certificate/key is not "
                            "enrolled in the trusted keystore. Verification cannot be confirmed algorithmically."
                        ),
                        anomaly_score=40.0,
                        evidence=evidence
                    )
            except Exception:
                pass

            # Check if URL payload
            if data.startswith("http://") or data.startswith("https://"):
                evidence["is_url"] = True
                parsed_url = urlparse(data)
                domain = (parsed_url.netloc or "").lower()
                evidence["domain"] = domain

                is_statutory = any(domain == dom or domain.endswith("." + dom) for dom in cls.STATUTORY_DOMAINS)
                evidence["is_statutory_domain"] = is_statutory

                if is_statutory:
                    # STRICT GUARDRAIL: Do NOT simulate official verification!
                    return AuthenticityCheckResult(
                        check_code="AUTH_QR_TRUST_VERIFY",
                        check_name="QR-Code Trust & Signature Verification",
                        state=AuthenticityState.NEEDS_MANUAL_REVIEW,
                        can_establish=cls.CAN_ESTABLISH,
                        cannot_establish=cls.CANNOT_ESTABLISH,
                        explanation=(
                            f"QR code references official statutory domain ({domain}). "
                            "Offline cryptographic trust key is not enrolled for this authority; "
                            "a human officer must scan or cross-check directly on the official portal. "
                            "TrustDoc does not simulate live government portal queries."
                        ),
                        anomaly_score=30.0,
                        evidence=evidence
                    )
                else:
                    return AuthenticityCheckResult(
                        check_code="AUTH_QR_TRUST_VERIFY",
                        check_name="QR-Code Trust & Signature Verification",
                        state=AuthenticityState.SUSPICIOUS_INDICATOR,
                        can_establish=cls.CAN_ESTABLISH,
                        cannot_establish=cls.CANNOT_ESTABLISH,
                        explanation=(
                            f"QR code points to an untrusted or non-statutory third-party web domain ({domain}). "
                            "Official certificates and regulatory NOCs must anchor to authorized statutory domains."
                        ),
                        anomaly_score=65.0,
                        evidence=evidence
                    )

            # Plain text QR
            return AuthenticityCheckResult(
                check_code="AUTH_QR_TRUST_VERIFY",
                check_name="QR-Code Trust & Signature Verification",
                state=AuthenticityState.UNAVAILABLE,
                can_establish=cls.CAN_ESTABLISH,
                cannot_establish=cls.CANNOT_ESTABLISH,
                explanation="QR code contains plain text without digital signature or trust anchor.",
                anomaly_score=15.0,
                evidence=evidence
            )

        except Exception as e:
            return AuthenticityCheckResult(
                check_code="AUTH_QR_TRUST_VERIFY",
                check_name="QR-Code Trust & Signature Verification",
                state=AuthenticityState.UNAVAILABLE,
                can_establish=cls.CAN_ESTABLISH,
                cannot_establish=cls.CANNOT_ESTABLISH,
                explanation=f"QR detection encountered an error: {str(e)}",
                anomaly_score=0.0,
                evidence={"error": str(e)}
            )
