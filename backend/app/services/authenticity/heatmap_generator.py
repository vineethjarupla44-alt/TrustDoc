import cv2
import numpy as np
import fitz
from PIL import Image
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple

class HeatmapGenerator:
    """
    Generates genuine suspicious-region heatmap overlays ONLY when an actual
    forensic analysis method (e.g., ELA localized compression variance or OpenCV
    spatial noise variance disparity) mathematically detects an anomaly.
    
    Adheres strictly to the guardrail: does not fabricate or simulate heatmaps.
    """

    @staticmethod
    def render_base_image(file_path: Path | str) -> Optional[np.ndarray]:
        """Loads or renders page 1 of a file into a BGR numpy array."""
        path = Path(file_path)
        if not path.exists():
            return None
        
        try:
            if path.suffix.lower() == ".pdf":
                doc = fitz.open(str(path))
                if len(doc) == 0:
                    return None
                pix = doc[0].get_pixmap(dpi=150)
                img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
                doc.close()
                if pix.n == 4:
                    return cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
                elif pix.n == 3:
                    return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
                elif pix.n == 1:
                    return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
                return img
            else:
                return cv2.imread(str(path))
        except Exception:
            return None

    @classmethod
    def generate_ela_heatmap(
        cls,
        file_path: Path | str,
        output_path: Path | str,
        diff_array: np.ndarray,
        anomaly_score: float,
        threshold_sigma: float = 2.0
    ) -> Dict[str, Any]:
        """
        Generates a JET colormap heatmap overlay based on genuine localized ELA difference residuals.
        Only generates an artifact if the anomaly score exceeds the suspicious threshold (> 35.0)
        and statistical outliers exist.
        """
        output_path = Path(output_path)
        base_img = cls.render_base_image(file_path)
        if base_img is None:
            return {"generated": False, "heatmap_path": None, "reason": "Failed to load base image"}

        h, w = base_img.shape[:2]
        
        # Ensure diff_array matches base image dimensions
        if diff_array.shape[:2] != (h, w):
            diff_array = cv2.resize(diff_array, (w, h), interpolation=cv2.INTER_LINEAR)

        # Convert diff to grayscale intensity
        if len(diff_array.shape) == 3:
            diff_gray = cv2.cvtColor(diff_array.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
        else:
            diff_gray = diff_array.astype(np.float32)

        mean_val = float(np.mean(diff_gray))
        std_val = float(np.std(diff_gray))
        cutoff = min(mean_val + (threshold_sigma * std_val), 25.0)

        # Statistical anomaly condition:
        # 1. Anomaly score must be >= 35.0 (borderline or suspicious)
        # 2. Outlier pixels must exist with significant residual (>= cutoff and > 10.0)
        anomalous_mask = (diff_gray >= cutoff) & (diff_gray > 10.0)
        outlier_count = int(np.sum(anomalous_mask))
        outlier_ratio = outlier_count / float(h * w)

        if anomaly_score < 35.0 or outlier_count < 50 or outlier_ratio < 0.0005:
            # Document is uniform; genuine analysis does NOT produce a heatmap
            return {
                "generated": False,
                "heatmap_path": None,
                "reason": "Uniform compression profile. No statistically significant anomalous regions detected.",
                "regions": []
            }

        # Smooth anomalous mask to form heat clusters
        mask_uint8 = (anomalous_mask * 255).astype(np.uint8)
        blurred_mask = cv2.GaussianBlur(mask_uint8, (21, 21), 0)
        
        # Normalize to 0-255 for colormap
        norm_mask = cv2.normalize(blurred_mask, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
        
        # Apply JET colormap
        heatmap_jet = cv2.applyColorMap(norm_mask, cv2.COLORMAP_JET)

        # Alpha blend with original image (40% heatmap, 60% base)
        blended = cv2.addWeighted(heatmap_jet, 0.45, base_img, 0.55, 0)

        # Detect contours of anomalous regions to extract bounding boxes
        contours, _ = cv2.findContours(cv2.threshold(norm_mask, 100, 255, cv2.THRESH_BINARY)[1], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        suspicious_regions: List[Dict[str, Any]] = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > 100:  # Filter out trivial noise specks
                x, y, bw, bh = cv2.boundingRect(cnt)
                # Draw subtle indicator box on heatmap
                cv2.rectangle(blended, (x, y), (x + bw, y + bh), (0, 0, 255), 2)
                suspicious_regions.append({
                    "x": int(x),
                    "y": int(y),
                    "width": int(bw),
                    "height": int(bh),
                    "area_pixels": int(area),
                    "relative_coords": {
                        "x_norm": round(x / w, 4),
                        "y_norm": round(y / h, 4),
                        "width_norm": round(bw / w, 4),
                        "height_norm": round(bh / h, 4)
                    }
                })

        # Ensure parent output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(output_path), blended)

        return {
            "generated": True,
            "heatmap_path": str(output_path),
            "outlier_count": outlier_count,
            "outlier_ratio": round(outlier_ratio, 5),
            "regions_count": len(suspicious_regions),
            "regions": suspicious_regions[:10]  # Cap at top 10
        }
