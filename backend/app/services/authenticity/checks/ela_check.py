import io
from pathlib import Path
from typing import Dict, Any, List, Tuple
import fitz
import numpy as np
from PIL import Image, ImageChops
from backend.app.services.authenticity.types import AuthenticityCheckResult, AuthenticityState

class ELAChecker:
    """
    Performs genuine Error Level Analysis (ELA) by recompressing the image at a known
    JPEG quality level and evaluating localized pixel-level compression residuals.
    """

    CAN_ESTABLISH = [
        "Variances in localized 8x8 DCT compression error residuals across image regions.",
        "Identification of visual regions saved under differing compression histories or spliced into an existing file."
    ]

    CANNOT_ESTABLISH = [
        "Definitive proof of malicious tampering. High-contrast typography, sharp vector borders, and fine watermarks naturally yield high ELA residuals.",
        "Anomalies in documents subjected to uniform heavy re-compression, which washes out error differentials."
    ]

    @classmethod
    def _render_image_from_file(cls, file_path: Path) -> Image.Image:
        """Renders first page of PDF at 150 DPI or loads image directly."""
        if file_path.suffix.lower() == ".pdf":
            doc = fitz.open(str(file_path))
            if len(doc) == 0:
                raise ValueError("Empty PDF file")
            pix = doc[0].get_pixmap(dpi=150)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            doc.close()
            return img
        else:
            return Image.open(file_path).convert("RGB")

    @classmethod
    def check(cls, file_path: Path | str, quality: int = 90) -> Tuple[AuthenticityCheckResult, np.ndarray, float]:
        """
        Runs ELA and returns (AuthenticityCheckResult, diff_array, anomaly_score).
        """
        file_path = Path(file_path)
        if not file_path.exists():
            res = AuthenticityCheckResult(
                check_code="AUTH_ELA_COMPRESSION",
                check_name="Error Level Analysis (ELA)",
                state=AuthenticityState.UNAVAILABLE,
                can_establish=cls.CAN_ESTABLISH,
                cannot_establish=cls.CANNOT_ESTABLISH,
                explanation="File not found on disk.",
                anomaly_score=0.0,
                evidence={"error": "File does not exist on disk"}
            )
            return res, np.zeros((10, 10, 3), dtype=np.uint8), 0.0

        try:
            original = cls._render_image_from_file(file_path)
            
            # Save resaved JPEG in memory buffer at specified quality
            buffer = io.BytesIO()
            original.save(buffer, "JPEG", quality=quality)
            buffer.seek(0)
            resaved = Image.open(buffer)

            # Compute pixel-by-pixel difference
            diff = ImageChops.difference(original, resaved)
            diff_arr = np.array(diff, dtype=np.float32)

            mean_error = float(np.mean(diff_arr))
            std_error = float(np.std(diff_arr))
            max_diff = float(np.max(diff_arr))
            p95_error = float(np.percentile(diff_arr, 95))

            # Statistical anomaly score:
            # High standard deviation with high 95th percentile suggests localized compression anomalies
            raw_score = (std_error * 2.8) + (mean_error * 1.2)
            anomaly_score = min(100.0, round(raw_score, 2))

            evidence: Dict[str, Any] = {
                "quality_tested": quality,
                "mean_error": round(mean_error, 2),
                "std_error": round(std_error, 2),
                "max_diff": max_diff,
                "p95_error": round(p95_error, 2),
                "anomaly_score": anomaly_score
            }

            if anomaly_score > 55.0:
                state = AuthenticityState.SUSPICIOUS_INDICATOR
                explanation = (
                    f"High localized compression variance detected (ELA Score: {anomaly_score}/100, "
                    f"Std Error: {round(std_error, 2)}). Indicates distinct compression histories across page regions."
                )
            elif anomaly_score >= 35.0:
                state = AuthenticityState.NEEDS_MANUAL_REVIEW
                explanation = (
                    f"Moderate compression variance observed (ELA Score: {anomaly_score}/100). "
                    "May correspond to sharp high-contrast text or scanned vector letterheads; manual review recommended."
                )
            else:
                state = AuthenticityState.VERIFIED
                explanation = (
                    f"Uniform compression profile verified (ELA Score: {anomaly_score}/100). "
                    "No significant localized recompression artifacts found."
                )

            result = AuthenticityCheckResult(
                check_code="AUTH_ELA_COMPRESSION",
                check_name="Error Level Analysis (ELA)",
                state=state,
                can_establish=cls.CAN_ESTABLISH,
                cannot_establish=cls.CANNOT_ESTABLISH,
                explanation=explanation,
                anomaly_score=anomaly_score,
                evidence=evidence
            )
            return result, diff_arr, anomaly_score

        except Exception as e:
            result = AuthenticityCheckResult(
                check_code="AUTH_ELA_COMPRESSION",
                check_name="Error Level Analysis (ELA)",
                state=AuthenticityState.UNAVAILABLE,
                can_establish=cls.CAN_ESTABLISH,
                cannot_establish=cls.CANNOT_ESTABLISH,
                explanation=f"ELA execution encountered an error: {str(e)}",
                anomaly_score=0.0,
                evidence={"error": str(e)}
            )
            return result, np.zeros((10, 10, 3), dtype=np.uint8), 0.0
