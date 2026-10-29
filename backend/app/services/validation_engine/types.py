from enum import Enum
from typing import Any, Optional, Dict, List
from pydantic import BaseModel, Field

class ValidationStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    WARNING = "WARNING"
    NEEDS_REVIEW = "NEEDS_REVIEW"

class FindingCategory(str, Enum):
    REQUIRED_DOCS_AND_FIELDS = "REQUIRED_DOCS_AND_FIELDS"
    FIELD_FORMAT = "FIELD_FORMAT"
    DATE_AND_EXPIRY = "DATE_AND_EXPIRY"
    DUPLICATE_DETECTION = "DUPLICATE_DETECTION"
    CROSS_DOCUMENT = "CROSS_DOCUMENT"
    IDENTITY_CONSISTENCY = "IDENTITY_CONSISTENCY"
    CATEGORY_REQUIREMENTS = "CATEGORY_REQUIREMENTS"
    AUTHENTICITY = "AUTHENTICITY"

class RuleSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"

class ValidationFinding(BaseModel):
    rule_id: str = Field(..., description="Unique deterministic rule identifier, e.g. RULE-REQ-001")
    rule_name: str = Field(..., description="Human-readable title of the rule")
    category: FindingCategory = Field(..., description="One of the 7 validation categories")
    status: ValidationStatus = Field(..., description="Evaluation outcome: PASS, FAIL, WARNING, NEEDS_REVIEW")
    severity: RuleSeverity = Field(default=RuleSeverity.CRITICAL, description="Severity: CRITICAL, WARNING, INFO")
    explanation: str = Field(..., description="Clear explanation of the evaluation and result")
    evidence: Optional[str] = Field(None, description="Exact textual quote, compared values, or document hash")
    source_field_ref: Optional[Dict[str, Any]] = Field(None, description="Reference containing doc_id, doc_type, field_key, page_number, bounding_box")
    recommended_action: Optional[str] = Field(None, description="Corrective action for applicant or reviewer")

class RuleDefinition(BaseModel):
    rule_id: str
    rule_name: str
    category: FindingCategory
    default_severity: RuleSeverity = RuleSeverity.CRITICAL
    description: str
    authority: str = "AICTE / Statutory Regulatory Council"
    version: str = "v2026.1"
    parameters: Dict[str, Any] = Field(default_factory=dict)
