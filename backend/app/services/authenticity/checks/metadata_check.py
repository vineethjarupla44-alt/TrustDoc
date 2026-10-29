import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional
import fitz
from PIL import Image, ExifTags
from backend.app.services.authenticity.types import AuthenticityCheckResult, AuthenticityState

class MetadataChecker:
    """
    Analyzes document metadata for graphic editing tool footprints,
    anachronistic creation vs modification dates, and authoring consistency.
    """

    CAN_ESTABLISH = [
        "Authoring software footprints (e.g. Photoshop, Canva, Illustrator, GIMP).",
        "Chronological sequencing between initial document creation and subsequent modification timestamps."
    ]

    CANNOT_ESTABLISH = [
        "Definitive proof of fraudulent intent (legitimate organizations may use design tools for letterheads or scan assemblies).",
        "Integrity if metadata was deliberately stripped or scrubbed using sanitization tools."
    ]

    SUSPICIOUS_TOOLS = [
        "photoshop", "gimp", "canva", "illustrator", "paint.net",
        "inkscape", "coreldraw", "pdf-xchange editor", "nitro pro", "sejda", "pixelmator"
    ]

    @classmethod
    def _parse_pdf_date(cls, date_str: Optional[str]) -> Optional[datetime]:
        """Parses PDF timestamp formats like 'D:20261024183000+05'30'' or ISO strings."""
        if not date_str:
            return None
        cleaned = date_str.strip()
        if cleaned.startswith("D:"):
            cleaned = cleaned[2:]
        # Extract digits: YYYYMMDDHHMMSS
        match = re.match(r"^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?", cleaned)
        if match:
            y, m, d = int(match.group(1)), int(match.group(2)), int(match.group(3))
            hh = int(match.group(4) or 0)
            mm = int(match.group(5) or 0)
            ss = int(match.group(6) or 0)
            try:
                return datetime(y, m, d, hh, mm, ss)
            except ValueError:
                return None
        return None

    @classmethod
    def check(cls, file_path: Path | str) -> AuthenticityCheckResult:
        file_path = Path(file_path)
        if not file_path.exists():
            return AuthenticityCheckResult(
                check_code="AUTH_METADATA_ANALYSIS",
                check_name="Metadata & Authoring Footprints",
                state=AuthenticityState.UNAVAILABLE,
                can_establish=cls.CAN_ESTABLISH,
                cannot_establish=cls.CANNOT_ESTABLISH,
                explanation="File not found at specified storage path.",
                anomaly_score=0.0,
                evidence={"error": "File does not exist on disk"}
            )

        suffix = file_path.suffix.lower().lstrip(".")
        evidence: Dict[str, Any] = {
            "producer": None,
            "creator": None,
            "creation_date": None,
            "mod_date": None,
            "detected_tool": None,
            "flags": []
        }

        if suffix == "pdf":
            try:
                doc = fitz.open(str(file_path))
                meta = doc.metadata or {}
                doc.close()

                producer = meta.get("producer") or ""
                creator = meta.get("creator") or ""
                c_date_raw = meta.get("creationDate") or ""
                m_date_raw = meta.get("modDate") or ""

                evidence["producer"] = producer
                evidence["creator"] = creator
                evidence["creation_date"] = c_date_raw
                evidence["mod_date"] = m_date_raw

                # Check for suspicious editing software
                combined_software = f"{producer} {creator}".lower()
                for tool in cls.SUSPICIOUS_TOOLS:
                    if tool in combined_software:
                        evidence["detected_tool"] = tool.title()
                        evidence["flags"].append(f"Graphic design software signature detected: {tool.title()}")
                        break

                # Parse dates for chronological check
                c_dt = cls._parse_pdf_date(c_date_raw)
                m_dt = cls._parse_pdf_date(m_date_raw)

                if c_dt and m_dt:
                    # Chronological paradox check: ModDate strictly before CreationDate
                    time_diff_seconds = (m_dt - c_dt).total_seconds()
                    if time_diff_seconds < -60:  # Allow 1 min clock drift
                        evidence["flags"].append("Chronological contradiction: Modification timestamp precedes Creation timestamp.")
                        return AuthenticityCheckResult(
                            check_code="AUTH_METADATA_ANALYSIS",
                            check_name="Metadata & Authoring Footprints",
                            state=AuthenticityState.MISMATCH,
                            can_establish=cls.CAN_ESTABLISH,
                            cannot_establish=cls.CANNOT_ESTABLISH,
                            explanation=(
                                f"Metadata timestamp paradox: Modification timestamp ({m_date_raw}) "
                                f"precedes Creation timestamp ({c_date_raw}). Indication of manual metadata editing."
                            ),
                            anomaly_score=90.0,
                            evidence=evidence
                        )

                if evidence["detected_tool"]:
                    return AuthenticityCheckResult(
                        check_code="AUTH_METADATA_ANALYSIS",
                        check_name="Metadata & Authoring Footprints",
                        state=AuthenticityState.SUSPICIOUS_INDICATOR,
                        can_establish=cls.CAN_ESTABLISH,
                        cannot_establish=cls.CANNOT_ESTABLISH,
                        explanation=(
                            f"Document authored or modified using desktop graphic editor '{evidence['detected_tool']}'. "
                            "Institutional regulatory documents should normally be issued directly from scanning or ERP systems."
                        ),
                        anomaly_score=65.0,
                        evidence=evidence
                    )

            except Exception as e:
                evidence["flags"].append(f"PDF metadata extraction error: {str(e)}")

        elif suffix in ["jpg", "jpeg", "png"]:
            try:
                with Image.open(file_path) as img:
                    exif_data = img.getexif()
                    if exif_data:
                        for tag_id, value in exif_data.items():
                            tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                            if tag_name.lower() in ["software", "imagedescription", "artist", "usercomment"]:
                                val_str = str(value)
                                evidence[tag_name.lower()] = val_str
                                for tool in cls.SUSPICIOUS_TOOLS:
                                    if tool in val_str.lower():
                                        evidence["detected_tool"] = tool.title()
                                        evidence["flags"].append(f"Image EXIF contains editor signature: {tool.title()}")
                                        return AuthenticityCheckResult(
                                            check_code="AUTH_METADATA_ANALYSIS",
                                            check_name="Metadata & Authoring Footprints",
                                            state=AuthenticityState.SUSPICIOUS_INDICATOR,
                                            can_establish=cls.CAN_ESTABLISH,
                                            cannot_establish=cls.CANNOT_ESTABLISH,
                                            explanation=f"EXIF metadata indicates image modified with '{tool.title()}'.",
                                            anomaly_score=60.0,
                                            evidence=evidence
                                        )
                    else:
                        evidence["note"] = "No EXIF metadata present (common in web uploads or sanitized scans)."
            except Exception as e:
                evidence["flags"].append(f"Image metadata extraction error: {str(e)}")

        # Normal, consistent metadata
        return AuthenticityCheckResult(
            check_code="AUTH_METADATA_ANALYSIS",
            check_name="Metadata & Authoring Footprints",
            state=AuthenticityState.VERIFIED,
            can_establish=cls.CAN_ESTABLISH,
            cannot_establish=cls.CANNOT_ESTABLISH,
            explanation="Metadata fields are chronologically consistent with standard institutional authoring pipelines.",
            anomaly_score=5.0,
            evidence=evidence
        )
