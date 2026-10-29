from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class AuthenticityState(str, Enum):
    VERIFIED = "VERIFIED"
    SUSPICIOUS_INDICATOR = "SUSPICIOUS_INDICATOR"
    MISMATCH = "MISMATCH"
    UNAVAILABLE = "UNAVAILABLE"
    NEEDS_MANUAL_REVIEW = "NEEDS_MANUAL_REVIEW"

class AuthenticityCheckResult(BaseModel):
    check_code: str
    check_name: str
    state: AuthenticityState
    can_establish: List[str]
    cannot_establish: List[str]
    explanation: str
    evidence: Dict[str, Any] = Field(default_factory=dict)
    anomaly_score: float = 0.0  # 0.0 to 100.0
    suspicious_regions: List[Dict[str, Any]] = Field(default_factory=list)

class DocumentAuthenticityDossier(BaseModel):
    document_id: str
    sha256_hash: str
    overall_verdict: AuthenticityState
    risk_level: str  # LOW, MEDIUM, HIGH
    risk_score: float  # 0.0 to 100.0
    checks: List[AuthenticityCheckResult]
    heatmap_generated: bool = False
    heatmap_path: Optional[str] = None
    heatmap_type: Optional[str] = None
    remarks: str
    disclaimer: str = (
        "Forensic integrity screening identifies technical anomalies, compression residuals, "
        "and software authoring tags. These findings serve as evidentiary indicators for human "
        "regulatory officers and do not independently constitute definitive legal proof of document tampering or fraud."
    )
