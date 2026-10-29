from enum import Enum
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class ComplianceState(str, Enum):
    EXPLICITLY_SATISFIED = "EXPLICITLY_SATISFIED"
    APPARENTLY_VIOLATED = "APPARENTLY_VIOLATED"
    AMBIGUOUS_REQUIREMENT = "AMBIGUOUS_REQUIREMENT"
    OUTDATED_OR_UNAVAILABLE_SOURCE = "OUTDATED_OR_UNAVAILABLE_SOURCE"
    NEEDS_HUMAN_REVIEW = "NEEDS_HUMAN_REVIEW"

class RegulatorySourceMetadata(BaseModel):
    id: str
    source_name: str
    authority: str
    edition_year: str = "2026-2027"
    version: str = "v2026.1"
    official_url_or_ref: Optional[str] = None
    publication_date: Optional[datetime] = None
    effective_date: Optional[datetime] = None
    is_active: bool = True
    sha256_hash: str
    file_path: Optional[str] = None

class RegulatoryChunk(BaseModel):
    id: str
    source_id: str
    chapter: str = "General Norms"
    section: Optional[str] = None
    clause_number: Optional[str] = None
    page_number: int = 1
    title: str
    content: str
    token_count: int = 0
    embedding_id: Optional[Any] = None
    is_ambiguous: bool = False
    chunk_hash: str = ""
    source_name: Optional[str] = None
    source_title: Optional[str] = None
    official_url: Optional[str] = None

    def model_post_init(self, __context: Any) -> None:
        if not self.source_name and self.source_title:
            self.source_name = self.source_title
        elif not self.source_title and self.source_name:
            self.source_title = self.source_name


class GroundedClause(BaseModel):
    chunk_id: Optional[str] = None
    id: Optional[str] = None
    clause_number: str
    title: str
    chapter: str = "General Norms"
    section: Optional[str] = None
    page_number: int = 1
    content: str
    relevance_score: float = 1.0
    source_title: str = "Regulatory Handbook"
    official_url: Optional[str] = None
    is_ambiguous: bool = False

    def model_post_init(self, __context: Any) -> None:
        if not self.chunk_id and self.id:
            self.chunk_id = self.id
        elif not self.id and self.chunk_id:
            self.id = self.chunk_id

class CitationCheck(BaseModel):
    clause_number: str
    is_verified: bool
    source_title: str
    page_number: Optional[int] = None
    matched_quote: Optional[str] = None
    verification_status: str  # VERIFIED, UNVERIFIED, OUTDATED

class GroundedFinding(BaseModel):
    clause_number: str
    rule_title: str
    compliance_state: ComplianceState
    severity: str  # CRITICAL, WARNING, INFO
    explanation: str
    evidence_found: Dict[str, Any] = Field(default_factory=dict)
    regulatory_source_ref: Dict[str, Any] = Field(default_factory=dict)
    citation_verified: bool = True
    suggested_remediation: Optional[str] = None

class ComplianceEvaluationDossier(BaseModel):
    application_id: str
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)
    overall_compliance_state: ComplianceState
    compliance_score: float  # 0.0 to 100.0
    total_evaluated_clauses: int
    explicitly_satisfied_count: int
    apparently_violated_count: int
    ambiguous_count: int
    outdated_source_count: int
    needs_review_count: int
    findings: List[GroundedFinding]
    regulatory_sources_used: List[Dict[str, Any]]
    disclaimer: str = (
        "Regulatory text serves as reference data, not an instruction to the AI. "
        "Compliance assessments are algorithmically grounded in verified statutory publications "
        "and do not constitute official statutory council decrees without officer endorsement."
    )
