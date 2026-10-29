from pathlib import Path
from typing import Dict, Any, List
import fitz
from backend.app.services.authenticity.types import AuthenticityCheckResult, AuthenticityState

class FormatSignatureChecker:
    """
    Validates file signatures (magic bytes) against declared extensions,
    and inspects container structural integrity (EOF markers, multiple stream trailers).
    """

    CAN_ESTABLISH = [
        "Binary magic byte signature alignment with declared file container format.",
        "Syntactic compliance of file container (valid headers, object tables, and termination markers)."
    ]

    CANNOT_ESTABLISH = [
        "Whether a syntactically valid container was generated legitimately or modified prior to export.",
        "The semantic truthfulness or regulatory validity of content inside the container."
    ]

    MAGIC_SIGNATURES = {
        "pdf": [b"%PDF-"],
        "png": [b"\x89PNG\r\n\x1a\n"],
        "jpg": [b"\xff\xd8\xff"],
        "jpeg": [b"\xff\xd8\xff"]
    }

    @classmethod
    def check(cls, file_path: Path | str) -> AuthenticityCheckResult:
        file_path = Path(file_path)
        if not file_path.exists():
            return AuthenticityCheckResult(
                check_code="AUTH_FORMAT_INTEGRITY",
                check_name="File Signature & Container Integrity",
                state=AuthenticityState.UNAVAILABLE,
                can_establish=cls.CAN_ESTABLISH,
                cannot_establish=cls.CANNOT_ESTABLISH,
                explanation="File not found at specified storage path.",
                anomaly_score=0.0,
                evidence={"error": "File does not exist on disk"}
            )

        suffix = file_path.suffix.lower().lstrip(".")
        file_size = file_path.stat().st_size

        if file_size < 8:
            return AuthenticityCheckResult(
                check_code="AUTH_FORMAT_INTEGRITY",
                check_name="File Signature & Container Integrity",
                state=AuthenticityState.MISMATCH,
                can_establish=cls.CAN_ESTABLISH,
                cannot_establish=cls.CANNOT_ESTABLISH,
                explanation="File is truncated or empty (< 8 bytes).",
                anomaly_score=100.0,
                evidence={"file_size": file_size}
            )

        with open(file_path, "rb") as f:
            header_bytes = f.read(16)
            f.seek(max(0, file_size - 2048))
            tail_bytes = f.read(2048)

        # Detect actual binary format from header
        detected_format = None
        for fmt, sigs in cls.MAGIC_SIGNATURES.items():
            for sig in sigs:
                if header_bytes.startswith(sig) or (fmt == "pdf" and b"%PDF-" in header_bytes[:8]):
                    detected_format = fmt
                    break
            if detected_format:
                break

        evidence: Dict[str, Any] = {
            "declared_extension": suffix,
            "detected_format": detected_format,
            "header_hex": header_bytes[:8].hex(),
            "file_size_bytes": file_size
        }

        # Format mismatch check (e.g. .png extension but %PDF- magic bytes, or vice-versa)
        expected_format = "jpeg" if suffix in ["jpg", "jpeg"] else suffix
        detected_normalized = "jpeg" if detected_format in ["jpg", "jpeg"] else detected_format

        if detected_normalized != expected_format:
            return AuthenticityCheckResult(
                check_code="AUTH_FORMAT_INTEGRITY",
                check_name="File Signature & Container Integrity",
                state=AuthenticityState.MISMATCH,
                can_establish=cls.CAN_ESTABLISH,
                cannot_establish=cls.CANNOT_ESTABLISH,
                explanation=(
                    f"Binary signature mismatch! Declared extension is '.{suffix}', but "
                    f"binary magic bytes match '{detected_format or 'UNKNOWN'}'. Potential file extension spoofing."
                ),
                anomaly_score=95.0,
                evidence=evidence
            )

        # Container integrity inspection
        if expected_format == "pdf":
            eof_count = tail_bytes.count(b"%%EOF")
            evidence["eof_marker_found"] = eof_count > 0
            evidence["eof_marker_count"] = eof_count

            if eof_count == 0:
                return AuthenticityCheckResult(
                    check_code="AUTH_FORMAT_INTEGRITY",
                    check_name="File Signature & Container Integrity",
                    state=AuthenticityState.MISMATCH,
                    can_establish=cls.CAN_ESTABLISH,
                    cannot_establish=cls.CANNOT_ESTABLISH,
                    explanation="PDF container is malformed: missing required '%%EOF' termination marker in trailing bytes.",
                    anomaly_score=80.0,
                    evidence=evidence
                )
            
            # Multiple EOF markers can indicate append-mode tampering or incremental overlay
            if eof_count > 1:
                evidence["incremental_updates_detected"] = True
                return AuthenticityCheckResult(
                    check_code="AUTH_FORMAT_INTEGRITY",
                    check_name="File Signature & Container Integrity",
                    state=AuthenticityState.NEEDS_MANUAL_REVIEW,
                    can_establish=cls.CAN_ESTABLISH,
                    cannot_establish=cls.CANNOT_ESTABLISH,
                    explanation=(
                        f"PDF container has {eof_count} '%%EOF' markers, indicating incremental revision updates "
                        "or post-generation append streams. Review document revision history."
                    ),
                    anomaly_score=45.0,
                    evidence=evidence
                )

            # Test PyMuPDF container parsing
            try:
                doc = fitz.open(str(file_path))
                page_count = len(doc)
                is_encrypted = doc.is_encrypted
                doc.close()
                evidence["page_count"] = page_count
                evidence["is_encrypted"] = is_encrypted
            except Exception as e:
                return AuthenticityCheckResult(
                    check_code="AUTH_FORMAT_INTEGRITY",
                    check_name="File Signature & Container Integrity",
                    state=AuthenticityState.MISMATCH,
                    can_establish=cls.CAN_ESTABLISH,
                    cannot_establish=cls.CANNOT_ESTABLISH,
                    explanation=f"Corrupt PDF structure: Document parser failed to read PDF cross-reference table ({str(e)}).",
                    anomaly_score=90.0,
                    evidence=evidence
                )

        elif expected_format == "jpeg":
            has_eoi = tail_bytes.endswith(b"\xff\xd9") or b"\xff\xd9" in tail_bytes[-16:]
            evidence["eoi_marker_found"] = has_eoi
            if not has_eoi:
                return AuthenticityCheckResult(
                    check_code="AUTH_FORMAT_INTEGRITY",
                    check_name="File Signature & Container Integrity",
                    state=AuthenticityState.NEEDS_MANUAL_REVIEW,
                    can_establish=cls.CAN_ESTABLISH,
                    cannot_establish=cls.CANNOT_ESTABLISH,
                    explanation="JPEG image is missing standard End-of-Image (EOI 0xFFD9) termination marker; possibly truncated.",
                    anomaly_score=50.0,
                    evidence=evidence
                )

        elif expected_format == "png":
            has_iend = b"IEND" in tail_bytes[-32:]
            evidence["iend_chunk_found"] = has_iend
            if not has_iend:
                return AuthenticityCheckResult(
                    check_code="AUTH_FORMAT_INTEGRITY",
                    check_name="File Signature & Container Integrity",
                    state=AuthenticityState.MISMATCH,
                    can_establish=cls.CAN_ESTABLISH,
                    cannot_establish=cls.CANNOT_ESTABLISH,
                    explanation="PNG container missing standard IEND trailer chunk; container corrupted or truncated.",
                    anomaly_score=75.0,
                    evidence=evidence
                )

        return AuthenticityCheckResult(
            check_code="AUTH_FORMAT_INTEGRITY",
            check_name="File Signature & Container Integrity",
            state=AuthenticityState.VERIFIED,
            can_establish=cls.CAN_ESTABLISH,
            cannot_establish=cls.CANNOT_ESTABLISH,
            explanation=f"Binary magic bytes and container structure strictly conform to '{expected_format.upper()}' specifications.",
            anomaly_score=0.0,
            evidence=evidence
        )
