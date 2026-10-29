import hashlib
import io
import fitz
import cv2
import numpy as np
from PIL import Image, ImageChops, ImageEnhance
from pathlib import Path
from typing import Any

class ForensicService:
    @staticmethod
    def compute_sha256(file_path: Path | str) -> str:
        """Calculates the SHA-256 cryptographic checksum of a file."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()

    @staticmethod
    def analyze_pdf_metadata(file_path: Path | str) -> dict[str, Any]:
        """
        Inspects PDF internal metadata for editing tool footprints,
        anachronistic creation vs modification dates, and structure anomalies.
        """
        suspicious_producers = [
            "photoshop", "gimp", "canva", "illustrator", "paint.net",
            "inkscape", "coreldraw", "pdf-xchange editor", "nitro pro"
        ]
        
        result = {
            "metadata_mismatch_flag": False,
            "suspicious_tool_detected": False,
            "detected_tool": None,
            "creation_date": None,
            "mod_date": None,
            "producer": None,
            "creator": None,
            "flags": []
        }

        try:
            doc = fitz.open(str(file_path))
            meta = doc.metadata or {}
            doc.close()

            producer = (meta.get("producer") or "").lower()
            creator = (meta.get("creator") or "").lower()
            creation_date = meta.get("creationDate") or ""
            mod_date = meta.get("modDate") or ""

            result["creation_date"] = creation_date
            result["mod_date"] = mod_date
            result["producer"] = meta.get("producer")
            result["creator"] = meta.get("creator")

            # Check for graphic editing software markers
            for tool in suspicious_producers:
                if tool in producer or tool in creator:
                    result["suspicious_tool_detected"] = True
                    result["detected_tool"] = tool.title()
                    result["flags"].append(f"Document authored or modified using graphic editor ({tool.title()}).")

            # Check timestamp anomalies (Modified timestamp vastly different or present without creation)
            if creation_date and mod_date and creation_date != mod_date:
                result["metadata_mismatch_flag"] = True
                result["flags"].append("Modification timestamp differs from initial document creation timestamp.")

        except Exception as e:
            result["flags"].append(f"Metadata read error: {str(e)}")

        return result

    @staticmethod
    def perform_error_level_analysis(image_path: Path | str, quality: int = 90) -> dict[str, Any]:
        """
        Performs Error Level Analysis (ELA) to detect localized compression differences.
        Disclaimer: ELA detects pixel compression discrepancies which may suggest localized edits,
        not conclusive proof of malicious fraud.
        """
        try:
            original = Image.open(image_path).convert("RGB")
            
            # Save resaved JPEG in memory at specified quality
            buffer = io.BytesIO()
            original.save(buffer, "JPEG", quality=quality)
            buffer.seek(0)
            resaved = Image.open(buffer)

            # Compute difference between original and resaved
            diff = ImageChops.difference(original, resaved)
            extrema = diff.getextrema()
            max_diff = max([ex[1] for ex in extrema])

            # Scale difference for visual enhancement
            scale = 255.0 / max_diff if max_diff > 0 else 1.0
            enhanced_diff = ImageEnhance.Brightness(diff).enhance(scale)

            # Convert to numpy for statistical variance & anomaly detection
            diff_arr = np.array(diff, dtype=np.float32)
            mean_error = float(np.mean(diff_arr))
            std_error = float(np.std(diff_arr))
            
            # High standard deviation with localized high peaks indicates potential spliced text
            anomaly_score = min(100.0, round((std_error * 2.5) + (mean_error * 1.5), 2))
            
            return {
                "success": True,
                "anomaly_score": anomaly_score,
                "mean_error": round(mean_error, 2),
                "std_error": round(std_error, 2),
                "max_diff": max_diff,
                "is_suspicious": anomaly_score > 45.0
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "anomaly_score": 0.0,
                "is_suspicious": False
            }

    @staticmethod
    def detect_qr_code(file_path: Path | str) -> dict[str, Any]:
        """Scans for QR codes and decodes their verification payload."""
        result = {
            "qr_detected": False,
            "payload": None,
            "is_valid_json": False
        }

        try:
            # If PDF, render first page to image in memory
            file_path = Path(file_path)
            if file_path.suffix.lower() == ".pdf":
                doc = fitz.open(str(file_path))
                if len(doc) > 0:
                    pix = doc[0].get_pixmap(dpi=150)
                    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
                    if pix.n == 4:
                        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
                    elif pix.n == 3:
                        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
                else:
                    return result
                doc.close()
            else:
                img = cv2.imread(str(file_path))

            if img is None:
                return result

            detector = cv2.QRCodeDetector()
            data, bbox, _ = detector.detectAndDecode(img)

            if data:
                result["qr_detected"] = True
                result["payload"] = data
                import json
                try:
                    parsed = json.loads(data)
                    result["payload_json"] = parsed
                    result["is_valid_json"] = True
                except Exception:
                    result["payload_json"] = {"raw_text": data}

        except Exception as e:
            result["error"] = str(e)

        return result

    @staticmethod
    def inspect_digital_signatures(file_path: Path | str) -> dict[str, Any]:
        """Checks for standard PDF PKI X.509 digital signature byte-ranges without simulating CA verification."""
        from backend.app.services.authenticity.checks.digital_signature_check import DigitalSignatureChecker
        res = DigitalSignatureChecker.check(file_path)
        return {
            "digital_signature_present": res.evidence.get("digital_signature_present", False),
            "signature_valid": res.state.value == "VERIFIED",
            "signer_identity": res.evidence.get("signer_identity"),
            "details": res.explanation
        }

    @classmethod
    def full_screening(cls, file_path: Path | str) -> dict[str, Any]:
        """Runs the complete suite of forensic checks using AuthenticityScreeningService."""
        from backend.app.services.authenticity import AuthenticityScreeningService
        return AuthenticityScreeningService.full_screening(file_path)
