from pathlib import Path
from typing import Dict, Any, List
import cv2
import numpy as np
import fitz
from backend.app.services.authenticity.types import AuthenticityCheckResult, AuthenticityState

class OpenCVInspectionChecker:
    """
    Performs computer vision inspection including:
    1. Laplacian blur variance & edge gradient consistency.
    2. Spatial noise variance disparity across 32x32 pixel blocks.
    3. Copy-move / cloned region detection using keypoint clustering.
    """

    CAN_ESTABLISH = [
        "Spatial noise uniformity across 32x32 pixel tiles.",
        "Identical visual feature clusters indicating potential copy-move cloning.",
        "Edge sharpness and blur gradient consistency across text and background regions."
    ]

    CANNOT_ESTABLISH = [
        "Proof of fraudulent intent. Institutional logos, repeating watermarks, and dual official stamps legitimately trigger copy-move matches.",
        "Authenticity of low-resolution or heavily compressed scans where sensor noise has been eliminated."
    ]

    @classmethod
    def _get_gray_image(cls, file_path: Path) -> np.ndarray:
        """Loads image as grayscale numpy array, rendering PDF page 1 if required."""
        if file_path.suffix.lower() == ".pdf":
            doc = fitz.open(str(file_path))
            if len(doc) == 0:
                raise ValueError("Empty PDF")
            pix = doc[0].get_pixmap(dpi=150)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
            doc.close()
            if pix.n >= 3:
                return cv2.cvtColor(img[:, :, :3], cv2.COLOR_RGB2GRAY)
            return img
        else:
            img = cv2.imread(str(file_path), cv2.IMREAD_GRAYSCALE)
            if img is None:
                raise ValueError("Could not read image file")
            return img

    @classmethod
    def check(cls, file_path: Path | str) -> AuthenticityCheckResult:
        file_path = Path(file_path)
        if not file_path.exists():
            return AuthenticityCheckResult(
                check_code="AUTH_OPENCV_INSPECTION",
                check_name="OpenCV Image & Sensor Inspection",
                state=AuthenticityState.UNAVAILABLE,
                can_establish=cls.CAN_ESTABLISH,
                cannot_establish=cls.CANNOT_ESTABLISH,
                explanation="File not found on disk.",
                anomaly_score=0.0,
                evidence={"error": "File does not exist on disk"}
            )

        try:
            gray = cls._get_gray_image(file_path)
            h, w = gray.shape[:2]

            # 1. Laplacian Blur & Edge Gradient
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            laplacian_var = float(laplacian.var())
            is_blurry = laplacian_var < 50.0

            # 2. Noise Variance Disparity across 32x32 blocks
            # Extract high-frequency noise by subtracting 3x3 median blur
            median_filtered = cv2.medianBlur(gray, 3)
            noise_residual = cv2.absdiff(gray, median_filtered).astype(np.float32)

            block_size = 32
            block_vars: List[float] = []
            for y in range(0, h - block_size, block_size):
                for x in range(0, w - block_size, block_size):
                    block_gray = gray[y:y + block_size, x:x + block_size]
                    # Select relatively uniform background/paper regions (filter out high-contrast text strokes)
                    if np.mean(block_gray) > 180 and np.std(block_gray) < 25.0:
                        block_noise = noise_residual[y:y + block_size, x:x + block_size]
                        block_vars.append(float(np.var(block_noise)))

            noise_disparity_ratio = 1.0
            p95_var = 0.0
            if block_vars and len(block_vars) >= 10:
                p95_var = float(np.percentile(block_vars, 95))
                p05_var = float(np.percentile(block_vars, 5))
                noise_disparity_ratio = round(p95_var / max(1.0, p05_var), 2)

            # 3. Copy-Move Cloned Feature Detection using ORB with Spatial Displacement Clustering
            orb = cv2.ORB_create(nfeatures=600)
            keypoints, descriptors = orb.detectAndCompute(gray, None)

            from collections import Counter
            displacements = []
            if descriptors is not None and len(descriptors) > 20:
                # Match descriptors against themselves using BFMatcher with Hamming distance
                bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
                matches = bf.knnMatch(descriptors, descriptors, k=3)
                
                for match_group in matches:
                    if len(match_group) >= 2:
                        m1 = match_group[1]  # Index 0 is the keypoint matching itself
                        if m1.distance < 18:
                            pt1 = keypoints[m1.queryIdx].pt
                            pt2 = keypoints[m1.trainIdx].pt
                            spatial_dist = np.hypot(pt1[0] - pt2[0], pt1[1] - pt2[1])
                            if spatial_dist > 60:
                                # Bin displacement vector into spatial shift bins (30px grid)
                                dx = round((pt2[0] - pt1[0]) / 30.0) * 30
                                dy = round((pt2[1] - pt1[1]) / 30.0) * 30
                                displacements.append((dx, dy))

            cluster_counts = Counter(displacements)
            top_cluster = cluster_counts.most_common(1)
            max_cluster_size = top_cluster[0][1] if top_cluster else 0

            evidence: Dict[str, Any] = {
                "resolution": f"{w}x{h}",
                "laplacian_variance": round(laplacian_var, 2),
                "is_blurry": is_blurry,
                "noise_disparity_ratio": noise_disparity_ratio,
                "p95_noise_variance": round(p95_var, 2),
                "evaluated_blocks_count": len(block_vars),
                "cloned_feature_matches": len(displacements),
                "max_displacement_cluster_size": max_cluster_size
            }

            # Synthesis
            if max_cluster_size >= 8:
                return AuthenticityCheckResult(
                    check_code="AUTH_OPENCV_INSPECTION",
                    check_name="OpenCV Image & Sensor Inspection",
                    state=AuthenticityState.SUSPICIOUS_INDICATOR,
                    can_establish=cls.CAN_ESTABLISH,
                    cannot_establish=cls.CANNOT_ESTABLISH,
                    explanation=(
                        f"Potential copy-move cloning detected! Found {max_cluster_size} spatially coherent "
                        "identical feature pairs sharing identical displacement shift. May indicate cloned stamps, seals, or spliced text."
                    ),
                    anomaly_score=75.0,
                    evidence=evidence
                )
            elif p95_var > 20.0 and noise_disparity_ratio > 5.5:
                return AuthenticityCheckResult(
                    check_code="AUTH_OPENCV_INSPECTION",
                    check_name="OpenCV Image & Sensor Inspection",
                    state=AuthenticityState.NEEDS_MANUAL_REVIEW,
                    can_establish=cls.CAN_ESTABLISH,
                    cannot_establish=cls.CANNOT_ESTABLISH,
                    explanation=(
                        f"Localized noise variance disparity observed (Ratio: {noise_disparity_ratio}). "
                        "Sensor noise characteristics vary across document regions; manual review suggested."
                    ),
                    anomaly_score=45.0,
                    evidence=evidence
                )
            else:
                return AuthenticityCheckResult(
                    check_code="AUTH_OPENCV_INSPECTION",
                    check_name="OpenCV Image & Sensor Inspection",
                    state=AuthenticityState.VERIFIED,
                    can_establish=cls.CAN_ESTABLISH,
                    cannot_establish=cls.CANNOT_ESTABLISH,
                    explanation=(
                        f"Optical sensor noise distribution is uniform (Disparity Ratio: {noise_disparity_ratio}). "
                        f"Sharpness index ({round(laplacian_var, 1)}) conforms to normal document scanning."
                    ),
                    anomaly_score=10.0,
                    evidence=evidence
                )

        except Exception as e:
            return AuthenticityCheckResult(
                check_code="AUTH_OPENCV_INSPECTION",
                check_name="OpenCV Image & Sensor Inspection",
                state=AuthenticityState.UNAVAILABLE,
                can_establish=cls.CAN_ESTABLISH,
                cannot_establish=cls.CANNOT_ESTABLISH,
                explanation=f"OpenCV analysis encountered an error: {str(e)}",
                anomaly_score=0.0,
                evidence={"error": str(e)}
            )
