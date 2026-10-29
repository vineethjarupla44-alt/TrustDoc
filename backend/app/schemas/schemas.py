from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, Any, List, Dict
from datetime import datetime
from enum import Enum

# ---------------------------------------------------------
# Enums
# ---------------------------------------------------------
class UserRole(str, Enum):
    APPLICANT = "APPLICANT"
    REVIEWER = "REVIEWER"
    AUDITOR = "AUDITOR"
    ADMIN = "ADMIN"

class ApplicationStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    PROCESSING = "PROCESSING"
    APPROVED = "APPROVED"
    DEFICIENT = "DEFICIENT"
    FLAGGED = "FLAGGED"

class SeverityEnum(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"

class FindingStatus(str, Enum):
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"
    WAIVED = "WAIVED"
    REJECTED = "REJECTED"


# ---------------------------------------------------------
# Standard Error Envelope (RFC 7807 Aligned)
# ---------------------------------------------------------
class ProblemDetailResponse(BaseModel):
    type: str = "https://compliance.aicte.gov.in/errors/GENERAL_ERROR"
    title: str
    status: int
    detail: str
    instance: Optional[str] = None
    code: str
    correlation_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------
# 1. User Schemas
# ---------------------------------------------------------
class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    role: str = "APPLICANT"
    institution_name: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    expected_role: Optional[str] = None

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    is_active: bool = True
    is_mfa_enabled: bool = False
    approval_status: str = "APPROVED"
    employee_id: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    phone_number: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ---------------------------------------------------------
# Onboarding & Dedicated Registration Schemas
# ---------------------------------------------------------
class ApplicantRegistrationRequest(BaseModel):
    institution_name: str = Field(..., min_length=3, max_length=255)
    registration_number: Optional[str] = None
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    phone_number: str = Field(..., min_length=8, max_length=30)
    password: str = Field(..., min_length=6)
    address: str = Field(..., min_length=5)
    state: str = "Delhi"
    district: str = "New Delhi"
    institution_type: str = "Private / Self-Financed"
    affiliation_university: str = "Delhi Technological University (DTU)"
    uploaded_documents: List[Dict[str, Any]] = []
    terms_accepted: bool = True

class ApplicantRegistrationResponse(BaseModel):
    user: UserResponse
    registration_reference: str
    registration_number: str
    status: str
    message: str

class OfficerRegistrationRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    employee_id: str = Field(..., min_length=3, max_length=100)
    department: str = Field(..., min_length=2, max_length=150)
    designation: str = Field(..., min_length=2, max_length=150)
    organization: str = Field(..., min_length=2, max_length=255)
    phone_number: Optional[str] = None
    password: str = Field(..., min_length=6)
    resubmit: Optional[bool] = False

class OfficerRegistrationResponse(BaseModel):
    request_id: str
    full_name: str
    email: str
    employee_id: str
    organization: str
    status: str
    message: str
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None

class OfficerRequestStatusResponse(BaseModel):
    found: bool
    email: Optional[str] = None
    employee_id: Optional[str] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    organization: Optional[str] = None
    approval_status: Optional[str] = None  # PENDING_APPROVAL, APPROVED, REJECTED
    rejection_reason: Optional[str] = None
    submitted_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_active: bool = False
    message: str

class AdminSetupStatusResponse(BaseModel):
    has_admin: bool
    setup_allowed: bool
    admin_count: int

class InitialAdminSetupRequest(BaseModel):
    setup_secret: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6)
    institution_name: str = "Central Regulatory Council"

class OfficerApprovalDecisionRequest(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT)$")
    rejection_reason: Optional[str] = None


# ---------------------------------------------------------
# 3. Document Forensics, Extracted Fields & Documents
# ---------------------------------------------------------
class AuthenticityCheckResponse(BaseModel):
    check_code: str
    check_name: str
    state: str
    can_establish: List[str] = []
    cannot_establish: List[str] = []
    explanation: str
    evidence: Dict[str, Any] = {}
    anomaly_score: float = 0.0
    suspicious_regions: List[Dict[str, Any]] = []

class DocumentForensicsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    ela_anomaly_score: float
    metadata_mismatch_flag: bool
    metadata_dump: Dict[str, Any] = {}
    qr_detected: bool = False
    qr_payload: Optional[Dict[str, Any]] = None
    digital_signature_present: bool = False
    signature_valid: bool = False
    signer_identity: Optional[str] = None
    risk_level: str
    remarks: Optional[str] = None
    screening_results: Optional[List[Dict[str, Any]]] = []
    heatmap_generated: bool = False
    heatmap_path: Optional[str] = None
    heatmap_url: Optional[str] = None
    disclaimer: Optional[str] = None
    evaluated_at: Optional[datetime] = None

# Backward compatibility alias
AuthenticityFindingResponse = DocumentForensicsResponse

class ExtractedFieldResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    document_id: str
    field_key: str
    label: Optional[str] = None
    field_value_normalized: Optional[str] = None
    field_value_raw: Optional[str] = None
    data_type: str = "string"
    confidence_score: float = 0.0
    page_number: int = 1
    bounding_box: Optional[Dict[str, Any]] = None
    ocr_engine: str = "PYMUPDF"
    state: str = "DETECTED"  # DETECTED, MISSING_IN_DOCUMENT, EXTRACTION_FAILED, MANUALLY_ENTERED
    is_manually_corrected: bool = False
    corrected_by_user_id: Optional[str] = None
    correction_reason: Optional[str] = None
    is_pii: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

class ExtractedFieldCorrectionRequest(BaseModel):
    corrected_value: str = Field(..., min_length=1, max_length=500, description="The accurate corrected value.")
    correction_reason: str = Field(..., min_length=5, max_length=500, description="Audit justification for manual modification.")

class DocumentStatusResponse(BaseModel):
    document_id: str
    status: str
    total_pages: int
    ocr_engine: str
    fields_extracted_count: int
    fields_missing_count: int
    fields_failed_count: int
    needs_manual_review: bool
    updated_at: datetime

class ExtractedEntitiesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    structured_fields: Dict[str, Any] = {}
    confidence_score: float = 0.0
    ocr_engine: str = "PYMUPDF"
    raw_text: Optional[str] = None

class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    application_id: str
    document_type: str
    file_name: str
    sha256_hash: str
    file_size_bytes: int
    mime_type: str
    extraction_status: str
    version: int = 1
    created_at: datetime
    forensics: Optional[DocumentForensicsResponse] = None
    extracted_entities: Optional[ExtractedEntitiesResponse] = None
    extracted_fields: List[ExtractedFieldResponse] = []

class DocumentAccessTokenResponse(BaseModel):
    token: str
    document_id: str
    expires_in_seconds: int
    download_url: str

class ReportAccessTokenResponse(BaseModel):
    token: str
    application_id: str
    application_number: str
    expires_in_seconds: int
    pdf_url: str
    download_url: str




# ---------------------------------------------------------
# 4. Validation Rules & Rule Versions
# ---------------------------------------------------------
class RuleVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    rule_id: str
    version_tag: str
    parameters_json: Dict[str, Any] = {}
    logic_handler: str
    effective_from: datetime
    effective_to: Optional[datetime] = None

class ValidationRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    rule_code: str
    category: str
    title: str
    description: str
    default_severity: str
    authority: str
    is_active: bool
    created_at: datetime
    versions: List[RuleVersionResponse] = []


# ---------------------------------------------------------
# 5 & 6. Compliance Findings & Assessment Scorecard
# ---------------------------------------------------------
class ComplianceFindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    application_id: str
    source_document_id: Optional[str] = None
    rule_code: str
    category: str  # AUTHENTICITY, COMPLETENESS, REGULATORY
    severity: str  # CRITICAL, WARNING, INFO
    title: str
    description: str
    evidence_quote: Optional[str] = None
    bounding_boxes: Optional[List[Any]] = None
    suggested_remediation: Optional[str] = None
    status: str = "OPEN"  # OPEN, RESOLVED, WAIVED, REJECTED
    finding_status: str = "FAIL"  # PASS, FAIL, WARNING, NEEDS_REVIEW
    source_field_ref: Optional[Dict[str, Any]] = None
    overridden_by_id: Optional[str] = None
    override_reason: Optional[str] = None
    resolved_by_applicant: bool = False
    created_at: datetime

class AssessmentSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    application_id: str
    authenticity_score: float = Field(..., ge=0.0, le=100.0)
    completeness_score: float = Field(..., ge=0.0, le=100.0)
    compliance_score: float = Field(..., ge=0.0, le=100.0)
    composite_score: float = Field(..., ge=0.0, le=100.0)
    recommendation: str
    evaluated_at: datetime

# Backward compatibility alias
AssessmentScorecardResponse = AssessmentSummaryResponse


# ---------------------------------------------------------
# 2. Application Schemas
# ---------------------------------------------------------
class ApplicationCreate(BaseModel):
    institution_name: str = Field(..., min_length=3, max_length=255)
    program_name: str = Field(default="Undergraduate Engineering & Technology", max_length=150)
    institution_type: str = Field(default="Private / Self-Financed", max_length=100)
    state: str = Field(default="Delhi", max_length=100)
    district: str = Field(default="New Delhi", max_length=100)
    academic_year: str = Field(default="2026-2027", pattern=r"^20\d\d-20\d\d$")

class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    applicant_id: str
    application_number: str
    institution_name: str
    program_name: str
    institution_type: str
    state: str = "Delhi"
    district: str = "New Delhi"
    academic_year: str = "2026-2027"
    status: str
    submitted_at: Optional[datetime] = None
    created_at: datetime
    summary: Optional[AssessmentSummaryResponse] = None

class ApplicationSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    application_number: str
    institution_name: str
    institution_type: str
    program_name: str
    status: str
    created_at: datetime
    summary: Optional[AssessmentSummaryResponse] = None

class ApplicationDetailResponse(ApplicationResponse):
    documents: List[DocumentResponse] = []
    findings: List[ComplianceFindingResponse] = []


# ---------------------------------------------------------
# 7. Regulatory Sources & RAG Schemas
# ---------------------------------------------------------
class RegulatorySourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    source_name: str
    authority: str
    edition_year: str
    sha256_hash: str
    published_date: Optional[datetime] = None

class RegulatoryRAGChunkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    source_id: str
    chapter: str
    section: Optional[str] = None
    clause_number: Optional[str] = None
    title: str
    content: str
    token_count: int

class RAGSearchResultResponse(BaseModel):
    rule_code: str
    title: str
    chapter: str
    content: str
    score: float
    authority: str = "AICTE Statutory Council"


# ---------------------------------------------------------
# 8. Reviewer Decisions & Overrides
# ---------------------------------------------------------
class ReviewerOverrideRequest(BaseModel):
    finding_id: str
    status: str = Field(..., description="RESOLVED or WAIVED")
    justification: str = Field(..., min_length=10, max_length=1000)

class ReviewerDecisionRequest(BaseModel):
    decision: str = Field(..., description="APPROVED, DEFICIENT, FLAGGED, or REJECTED")
    remarks: Optional[str] = None
    statutory_notes: Optional[str] = None
    deficiencies: List[str] = Field(default_factory=list)
    conditions: List[str] = Field(default_factory=list)

class ReviewerDecisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    application_id: str
    reviewer_id: str
    decision: str
    statutory_notes: str
    deficiencies_json: List[str] = []
    stipulated_conditions_json: List[str] = []
    ip_address: str
    recorded_at: datetime

class UnmaskPIIRequest(BaseModel):
    reason: str = Field(..., min_length=10, max_length=500)

# Backward compatibility alias
PIIUnmaskRequest = UnmaskPIIRequest

class ReviewerDashboardStats(BaseModel):
    total_applications: int
    approved_count: int
    deficient_count: int
    flagged_tamper_count: int
    total_documents_screened: int
    recent_applications: List[Dict[str, Any]] = []


# ---------------------------------------------------------
# 9. Audit Events & Chain Verification
# ---------------------------------------------------------
class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    application_id: str
    actor_id: Optional[str] = None
    actor_role: str = "SYSTEM"
    action: str
    ip_address: str
    user_agent: Optional[str] = None
    diff_payload: Dict[str, Any] = {}
    previous_event_hash: Optional[str] = None
    event_hash: Optional[str] = None
    timestamp: datetime

# Backward compatibility alias
AuditEventResponse = AuditLogResponse

class AuditChainVerificationResponse(BaseModel):
    chain_valid: bool
    event_count: int
    head_hash: Optional[str] = None
    verified_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------
# 10. Report Metadata
# ---------------------------------------------------------
class ReportMetadataResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    application_id: str
    report_type: str
    file_path: str
    sha256_hash: str
    file_size_bytes: int
    status: str
    download_count: int
    created_at: datetime


# ---------------------------------------------------------
# Chat & Remediation Schemas
# ---------------------------------------------------------
class ChatMessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)

class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    sender: str
    message_text: str
    cited_rule_references: List[Dict[str, Any]] = []
    timestamp: datetime

class SuggestedQuestionItem(BaseModel):
    category: str  # FINDING_REMEDIATION, STATUTORY_NORM, MISSING_DOCUMENT, GENERAL_ADVISORY
    prompt: str
    label: str
    rule_code: Optional[str] = None

class SuggestedQuestionsResponse(BaseModel):
    application_id: str
    suggested_questions: List[SuggestedQuestionItem]


# ---------------------------------------------------------
# 11. Regulatory RAG & Compliance Evaluation Schemas
# ---------------------------------------------------------
class RegulatorySourceIngestRequest(BaseModel):
    source_name: str
    authority: str
    edition_year: str = "2026-2027"
    version: str = "v2026.1"
    official_url_or_ref: Optional[str] = None
    effective_date: Optional[datetime] = None
    is_active: bool = True
    file_path: Optional[str] = None

class RegulatorySourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    source_name: str
    authority: str
    edition_year: str
    version: str
    official_url_or_ref: Optional[str] = None
    published_date: Optional[datetime] = None
    effective_date: Optional[datetime] = None
    is_active: bool = True
    sha256_hash: str
    chunks_count: int = 0
    created_at: datetime

class RegulatoryChunkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    source_id: str
    chapter: str
    section: Optional[str] = None
    clause_number: Optional[str] = None
    page_number: int = 1
    title: str
    content: str
    token_count: int = 0
    is_ambiguous: bool = False
    source_name: Optional[str] = None
    official_url: Optional[str] = None

class CitationVerificationResult(BaseModel):
    clause_number: str
    is_verified: bool
    source_title: str
    page_number: Optional[int] = None
    matched_quote: Optional[str] = None
    verification_status: str  # VERIFIED, UNVERIFIED, OUTDATED

class GroundedComplianceFinding(BaseModel):
    clause_number: str
    rule_title: str
    compliance_state: str  # EXPLICITLY_SATISFIED, APPARENTLY_VIOLATED, AMBIGUOUS_REQUIREMENT, OUTDATED_OR_UNAVAILABLE_SOURCE, NEEDS_HUMAN_REVIEW
    severity: str  # CRITICAL, WARNING, INFO
    explanation: str
    evidence_found: Dict[str, Any] = {}
    regulatory_source_ref: Dict[str, Any] = {}
    citation_verified: bool = True
    suggested_remediation: Optional[str] = None

class ComplianceEvaluationResponse(BaseModel):
    application_id: str
    evaluated_at: datetime
    overall_compliance_state: str
    compliance_score: float
    total_evaluated_clauses: int
    explicitly_satisfied_count: int
    apparently_violated_count: int
    ambiguous_count: int
    outdated_source_count: int
    needs_review_count: int
    findings: List[GroundedComplianceFinding]
    regulatory_sources_used: List[Dict[str, Any]]
    disclaimer: str

class RegulatoryQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=1000)
    top_k: int = Field(default=3, ge=1, le=10)
    language: str = Field(default="en", pattern="^(en|hi|te)$")
    application_id: Optional[str] = None

class RegulatoryQueryResponse(BaseModel):
    query: str
    answer: str
    citations: List[Dict[str, Any]]
    retrieved_chunks: List[RegulatoryChunkResponse]
    citation_verification: List[CitationVerificationResult]
    vector_search_mode: str = "HYBRID_FAISS_BM25"


# ---------------------------------------------------------
# 11. Reviewer Queue & Scrutiny Schemas
# ---------------------------------------------------------
class PrioritizedQueueItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    application_id: str
    application_number: str
    institution_name: str = "Registered Institution"
    program_name: str = "General Category"
    institution_type: str = "Private / Self-Financed"
    status: str = "DRAFT"
    submitted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    composite_score: float = 0.0
    authenticity_score: float = 100.0
    completeness_score: float = 0.0
    compliance_score: float = 0.0
    priority_tier: str = "ROUTINE_CLEARANCE"  # CRITICAL_HIGH, MODERATE_MEDIUM, ROUTINE_CLEARANCE
    authenticity_flags_count: int = 0
    completeness_flags_count: int = 0
    regulatory_flags_count: int = 0
    documents_count: int = 0
    missing_documents: List[str] = []
    correction_status: Optional[str] = None

class ReviewerQueueResponse(BaseModel):
    total_items: int
    critical_count: int
    moderate_count: int
    routine_count: int
    all_eligible_count: int = 0
    queue: List[PrioritizedQueueItem]


# ---------------------------------------------------------
# 12. Request-Correction Workflow Schemas
# ---------------------------------------------------------
class RequestedItem(BaseModel):
    field_key: Optional[str] = None
    document_type: Optional[str] = None
    reason: str

class CorrectionRequestCreate(BaseModel):
    requested_items: List[RequestedItem]
    instructions: str
    deadline_days: int = 15

class CorrectionRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    application_id: str
    reviewer_id: str
    reviewer_name: Optional[str] = None
    status: str  # OPEN, RESUBMITTED, ACCEPTED, REJECTED
    requested_items: List[Dict[str, Any]]
    instructions: str
    deadline_days: int
    applicant_response_notes: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

class CorrectionResolveRequest(BaseModel):
    action: str = Field(..., pattern="^(ACCEPT|REJECT)$")
    reviewer_remarks: str = Field(..., min_length=3)


# ---------------------------------------------------------
# 13. Application History Timeline Schemas
# ---------------------------------------------------------
class ApplicationHistoryItem(BaseModel):
    event_id: str
    event_type: str
    title: str
    actor_name: Optional[str] = None
    actor_role: str
    timestamp: datetime
    diff_summary: Dict[str, Any] = {}
    sha256_hash: Optional[str] = None

class ApplicationHistoryResponse(BaseModel):
    application_id: str
    application_number: str
    events: List[ApplicationHistoryItem]


# ---------------------------------------------------------
# 14. Admin User Management Schemas
# ---------------------------------------------------------
class AdminUserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)
    role: str = Field(..., pattern="^(APPLICANT|REVIEWER|AUDITOR|ADMIN)$")
    institution_name: Optional[str] = None
    is_mfa_enabled: bool = False

class AdminUserUpdateRequest(BaseModel):
    role: Optional[str] = Field(None, pattern="^(APPLICANT|REVIEWER|AUDITOR|ADMIN)$")
    is_active: Optional[bool] = None
    is_mfa_enabled: Optional[bool] = None
    institution_name: Optional[str] = None

class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str
    role: str
    institution_name: Optional[str] = None
    is_active: bool
    is_mfa_enabled: bool
    approval_status: Optional[str] = "APPROVED"
    employee_id: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    phone_number: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime


# ---------------------------------------------------------
# 15. Admin Rule Versioning Schemas
# ---------------------------------------------------------
class CreateRuleVersionRequest(BaseModel):
    version_tag: str
    parameters_json: Dict[str, Any]
    logic_handler: Optional[str] = None


# ---------------------------------------------------------
# 16. Admin Data Retention & Deletion Schemas
# ---------------------------------------------------------
class DataRetentionPolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    policy_code: str
    title: str
    category: str
    retention_days: int
    is_legal_hold: bool
    auto_purge_enabled: bool
    description: Optional[str] = None
    updated_at: datetime

class UpdateRetentionPolicyRequest(BaseModel):
    retention_days: Optional[int] = Field(None, ge=1)
    is_legal_hold: Optional[bool] = None
    auto_purge_enabled: Optional[bool] = None
    description: Optional[str] = None

class RetentionSweepResponse(BaseModel):
    status: str
    purged_drafts_count: int
    cleaned_artifacts_count: int
    retained_records_count: int
    sweep_timestamp: datetime
    audit_event_id: str


# ---------------------------------------------------------
# 17. Admin Masking Configuration Schemas
# ---------------------------------------------------------
class MaskingConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    identifier_type: str
    label: str
    pattern_regex: str
    masking_mode: str  # PARTIAL_MASK, FULL_MASK, HASH
    is_active: bool
    unmask_requires_justification: bool
    session_timeout_minutes: int
    updated_at: datetime

class UpdateMaskingConfigRequest(BaseModel):
    pattern_regex: Optional[str] = None
    masking_mode: Optional[str] = Field(None, pattern="^(PARTIAL_MASK|FULL_MASK|HASH)$")
    is_active: Optional[bool] = None
    unmask_requires_justification: Optional[bool] = None
    session_timeout_minutes: Optional[int] = Field(None, ge=1, le=120)

class MaskingTestRequest(BaseModel):
    sample_text: str

class MaskingTestResponse(BaseModel):
    original_text: str
    masked_text: str
    matched_identifiers: List[str]


# ---------------------------------------------------------
# 18. Institution Registration & Renewal Schemas
# ---------------------------------------------------------
class InstitutionRegistrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    institution_code: str
    registration_number: str
    institution_name: str
    applicant_user_id: str
    institution_type: str
    affiliation_university: str
    state: str
    district: str
    address: str
    contact_email: str
    contact_phone: str
    head_of_institution: str
    valid_from: datetime
    valid_upto: datetime
    status: str
    is_autonomous: bool
    accreditation_grade: str
    created_at: datetime
    updated_at: datetime

class RegistrationRenewalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    registration_id: str
    applicant_id: str
    application_type: str
    renewal_reference_number: str
    academic_year: str
    status: str
    institution_details: Dict[str, Any] = {}
    uploaded_documents: List[Dict[str, Any]] = []
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    decision_date: Optional[datetime] = None
    new_valid_from: Optional[datetime] = None
    new_valid_upto: Optional[datetime] = None
    reviewer_id: Optional[str] = None
    deficiency_notice: Optional[str] = None
    deficiency_deadline_days: int = 15
    applicant_correction_notes: Optional[str] = None
    applicant_correction_documents: List[Dict[str, Any]] = []
    resubmitted_at: Optional[datetime] = None
    decision: Optional[str] = None
    decision_notes: Optional[str] = None
    digital_scrutiny_seal: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class RenewalSubmissionRequest(BaseModel):
    institution_details: Dict[str, Any]
    uploaded_documents: List[Dict[str, Any]]
    academic_year: str = "2026-2027"

class NewRegistrationRequest(BaseModel):
    institution_name: str
    institution_type: str = "Private / Self-Financed"
    affiliation_university: str = "Delhi Technological University (DTU)"
    state: str = "Delhi"
    district: str = "New Delhi"
    address: str
    contact_email: str
    contact_phone: str
    head_of_institution: str
    uploaded_documents: List[Dict[str, Any]] = []

class RenewalDecisionRequest(BaseModel):
    decision: str = Field(..., pattern="^(APPROVED|CORRECTIONS_REQUIRED|REJECTED)$")
    statutory_notes: str
    deficiency_notice: Optional[str] = None
    deficiency_deadline_days: int = 15
    extension_years: int = 3

class RenewalCorrectionRequest(BaseModel):
    correction_notes: str
    correction_documents: List[Dict[str, Any]] = []

class CollegeRegistrationOverview(BaseModel):
    registration: Optional[InstitutionRegistrationResponse] = None
    active_renewal: Optional[RegistrationRenewalResponse] = None
    renewal_history: List[RegistrationRenewalResponse] = []
    eligibility_status: str  # NOT_YET_ELIGIBLE, RENEWAL_DUE, SUBMITTED, UNDER_REVIEW, CORRECTIONS_REQUIRED, APPROVED, REJECTED, EXPIRED
    eligibility_message: str
    days_until_expiry: Optional[int] = None
    renewal_window_days: int = 90
    renewal_extension_years: int = 3





