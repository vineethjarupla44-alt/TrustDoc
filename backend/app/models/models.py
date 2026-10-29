import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Integer, BigInteger, Float, Boolean, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship
from backend.app.core.database import Base, JSONType

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

# ---------------------------------------------------------
# 1. Users and Roles
# ---------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="APPLICANT")  # APPLICANT, REVIEWER, AUDITOR, ADMIN
    institution_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_mfa_enabled = Column(Boolean, default=False, nullable=False)
    approval_status = Column(String(50), default="APPROVED", nullable=False)  # APPROVED, PENDING_APPROVAL, REJECTED
    employee_id = Column(String(100), nullable=True)
    department = Column(String(150), nullable=True)
    designation = Column(String(150), nullable=True)
    phone_number = Column(String(50), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    applications = relationship("Application", back_populates="applicant")
    audit_logs = relationship("ApplicationAuditEvent", back_populates="actor")
    reviewer_decisions = relationship("ReviewerDecision", back_populates="reviewer")
    reports_generated = relationship("ReportMetadata", back_populates="generated_by")
    institution_registrations = relationship("InstitutionRegistration", back_populates="applicant_user")


# ---------------------------------------------------------
# 2. Applications
# ---------------------------------------------------------
class Application(Base):
    __tablename__ = "applications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    applicant_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    application_number = Column(String(64), unique=True, index=True, nullable=False)
    institution_name = Column(String(255), nullable=False, default="Apex Institute of Technology")
    program_name = Column(String(150), default="Undergraduate Engineering & Technology")
    institution_type = Column(String(100), default="Private / Self-Financed")
    state = Column(String(100), default="Delhi")
    district = Column(String(100), default="New Delhi")
    academic_year = Column(String(20), default="2026-2027")
    status = Column(String(50), default="DRAFT", index=True)  # DRAFT, SUBMITTED, PROCESSING, FLAGGED, APPROVED, DEFICIENT
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    applicant = relationship("User", back_populates="applications")
    documents = relationship("Document", back_populates="application", cascade="all, delete-orphan")
    findings = relationship("ComplianceFinding", back_populates="application", cascade="all, delete-orphan")
    summary = relationship("AssessmentSummary", back_populates="application", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("ApplicationAuditEvent", back_populates="application", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="application", cascade="all, delete-orphan")
    decisions = relationship("ReviewerDecision", back_populates="application", cascade="all, delete-orphan")
    reports = relationship("ReportMetadata", back_populates="application", cascade="all, delete-orphan")
    correction_requests = relationship("CorrectionRequest", back_populates="application", cascade="all, delete-orphan")


# ---------------------------------------------------------
# 3. Documents and Extracted Fields
# ---------------------------------------------------------
class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    document_type = Column(String(100), nullable=False)  # LAND_DEED, BUILDING_PLAN, FIRE_NOC, FACULTY_LIST, OTHER
    file_name = Column(String(255), nullable=False)
    storage_path = Column(String(512), nullable=False)
    sha256_hash = Column(String(64), index=True, nullable=False)
    file_size_bytes = Column(BigInteger, default=0)
    mime_type = Column(String(100), default="application/pdf")
    extraction_status = Column(String(50), default="PENDING")  # PENDING, SUCCESS, FAILED
    version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    application = relationship("Application", back_populates="documents")
    forensics = relationship("AuthenticityFinding", back_populates="document", uselist=False, cascade="all, delete-orphan")
    extracted_entities = relationship("ExtractedEntities", back_populates="document", uselist=False, cascade="all, delete-orphan")
    extracted_fields = relationship("ExtractedField", back_populates="document", cascade="all, delete-orphan")
    findings = relationship("ComplianceFinding", back_populates="source_document")


class ExtractedField(Base):
    """Normalized atomic field extraction with coordinates, OCR engine, and PII flag."""
    __tablename__ = "extracted_fields"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), index=True, nullable=False)
    field_key = Column(String(100), index=True, nullable=False)
    label = Column(String(150), nullable=True)
    field_value_normalized = Column(Text, nullable=True)
    field_value_raw = Column(Text, nullable=True)
    data_type = Column(String(50), default="string")
    confidence_score = Column(Float, default=0.0)
    page_number = Column(Integer, default=1)
    bounding_box = Column(JSONType, nullable=True)
    ocr_engine = Column(String(50), default="PYMUPDF")
    state = Column(String(50), default="DETECTED", index=True)  # DETECTED, MISSING_IN_DOCUMENT, EXTRACTION_FAILED, MANUALLY_ENTERED
    is_manually_corrected = Column(Boolean, default=False, nullable=False)
    corrected_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    correction_reason = Column(Text, nullable=True)
    is_pii = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    document = relationship("Document", back_populates="extracted_fields")
    corrected_by = relationship("User", foreign_keys=[corrected_by_user_id])



class ExtractedEntities(Base):
    """Document-level JSON store retained for service compatibility."""
    __tablename__ = "extracted_entities"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), index=True, nullable=False)
    structured_fields = Column(JSONType, default=dict)
    confidence_score = Column(Float, default=0.0)
    ocr_engine = Column(String(50), default="PYMUPDF")
    raw_text = Column(Text, nullable=True)

    document = relationship("Document", back_populates="extracted_entities")


# ---------------------------------------------------------
# 4. Validation Rules and Rule Versions
# ---------------------------------------------------------
class ValidationRule(Base):
    __tablename__ = "validation_rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    rule_code = Column(String(64), unique=True, index=True, nullable=False)
    category = Column(String(50), index=True, nullable=False)  # AUTHENTICITY, COMPLETENESS, REGULATORY
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    default_severity = Column(String(50), nullable=False, default="CRITICAL")  # CRITICAL, WARNING, INFO
    authority = Column(String(100), default="AICTE / Statutory Regulatory Council")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    versions = relationship("RuleVersion", back_populates="rule", cascade="all, delete-orphan")


class RuleVersion(Base):
    __tablename__ = "rule_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    rule_id = Column(String(36), ForeignKey("validation_rules.id", ondelete="CASCADE"), index=True, nullable=False)
    version_tag = Column(String(50), nullable=False, default="v2026.1")
    parameters_json = Column(JSONType, default=dict, nullable=False)
    logic_handler = Column(String(100), nullable=False)
    effective_from = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    effective_to = Column(DateTime(timezone=True), nullable=True)

    rule = relationship("ValidationRule", back_populates="versions")
    findings = relationship("ComplianceFinding", back_populates="rule_version")


# ---------------------------------------------------------
# 5. Authenticity Screening Findings (Forensics)
# ---------------------------------------------------------
class AuthenticityFinding(Base):
    __tablename__ = "document_forensics"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), index=True, nullable=False)
    ela_anomaly_score = Column(Float, default=0.0)  # 0.0 to 100.0
    metadata_mismatch_flag = Column(Boolean, default=False)
    metadata_dump = Column(JSONType, default=dict)
    qr_detected = Column(Boolean, default=False)
    qr_payload = Column(JSONType, nullable=True)
    digital_signature_present = Column(Boolean, default=False)
    signature_valid = Column(Boolean, default=False)
    signer_identity = Column(String(255), nullable=True)
    risk_level = Column(String(50), default="LOW", index=True)  # LOW, MEDIUM, HIGH
    remarks = Column(Text, nullable=True)
    screening_results = Column(JSONType, default=list, nullable=True)
    heatmap_path = Column(String(500), nullable=True)
    heatmap_generated = Column(Boolean, default=False)
    evaluated_at = Column(DateTime(timezone=True), default=utc_now)

    document = relationship("Document", back_populates="forensics")

# Backward compatibility alias
DocumentForensics = AuthenticityFinding


# ---------------------------------------------------------
# 6. Compliance Findings
# ---------------------------------------------------------
class ComplianceFinding(Base):
    __tablename__ = "compliance_findings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    source_document_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    rule_version_id = Column(String(36), ForeignKey("rule_versions.id"), nullable=True)
    rule_code = Column(String(100), index=True, nullable=False)  # e.g., SYNTH-NORM-1.1.1
    category = Column(String(50), index=True, nullable=False)  # AUTHENTICITY, COMPLETENESS, REGULATORY
    severity = Column(String(50), index=True, nullable=False)  # CRITICAL, WARNING, INFO
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    evidence_quote = Column(Text, nullable=True)
    bounding_boxes = Column(JSONType, nullable=True)
    suggested_remediation = Column(Text, nullable=True)
    status = Column(String(50), default="OPEN", index=True)  # Lifecycle: OPEN, RESOLVED, WAIVED, REJECTED
    finding_status = Column(String(50), default="FAIL", index=True)  # Validation outcome: PASS, FAIL, WARNING, NEEDS_REVIEW
    source_field_ref = Column(JSONType, nullable=True)  # JSON provenance metadata
    overridden_by_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    override_reason = Column(Text, nullable=True)
    resolved_by_applicant = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    application = relationship("Application", back_populates="findings")
    source_document = relationship("Document", back_populates="findings")
    rule_version = relationship("RuleVersion", back_populates="findings")
    overridden_by = relationship("User", foreign_keys=[overridden_by_id])


# ---------------------------------------------------------
# Scorecard Assessment Summary
# ---------------------------------------------------------
class AssessmentSummary(Base):
    __tablename__ = "assessment_summaries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), unique=True, nullable=False)
    authenticity_score = Column(Float, default=100.0)
    completeness_score = Column(Float, default=0.0)
    compliance_score = Column(Float, default=0.0)
    composite_score = Column(Float, default=0.0)
    recommendation = Column(String(50), default="PROCESSING")  # ELIGIBLE, DEFICIENT, REJECTED, PROCESSING
    evaluated_at = Column(DateTime(timezone=True), default=utc_now)

    application = relationship("Application", back_populates="summary")


# ---------------------------------------------------------
# 7. Regulatory Sources and RAG Chunks
# ---------------------------------------------------------
class RegulatorySource(Base):
    __tablename__ = "regulatory_sources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_name = Column(String(255), nullable=False)  # AICTE Approval Process Handbook
    authority = Column(String(150), nullable=False)
    edition_year = Column(String(50), default="2026-2027")
    version = Column(String(50), default="v2026.1")
    official_url_or_ref = Column(String(512), nullable=True)
    published_date = Column(DateTime(timezone=True), nullable=True)
    effective_date = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    file_path = Column(String(512), nullable=True)
    sha256_hash = Column(String(64), unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    chunks = relationship("RegulatoryRAGChunk", back_populates="source", cascade="all, delete-orphan")


class RegulatoryRAGChunk(Base):
    __tablename__ = "rag_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_id = Column(String(36), ForeignKey("regulatory_sources.id", ondelete="CASCADE"), index=True, nullable=False)
    chapter = Column(String(150), index=True, nullable=False)
    section = Column(String(150), nullable=True)
    clause_number = Column(String(64), index=True, nullable=True)
    page_number = Column(Integer, default=1, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    token_count = Column(Integer, default=0)
    embedding_id = Column(Integer, nullable=True)
    embedding_metadata = Column(JSONType, default=dict)
    is_ambiguous = Column(Boolean, default=False, nullable=False)
    chunk_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    source = relationship("RegulatorySource", back_populates="chunks")


# ---------------------------------------------------------
# 8. Reviewer Decisions
# ---------------------------------------------------------
class ReviewerDecision(Base):
    __tablename__ = "reviewer_decisions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    reviewer_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    decision = Column(String(50), index=True, nullable=False)  # APPROVED, DEFICIENT, FLAGGED, REJECTED
    statutory_notes = Column(Text, nullable=False)
    deficiencies_json = Column(JSONType, default=list)
    stipulated_conditions_json = Column(JSONType, default=list)
    ip_address = Column(String(64), default="127.0.0.1", nullable=False)
    digital_seal_hash = Column(String(64), nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=utc_now)

    application = relationship("Application", back_populates="decisions")
    reviewer = relationship("User", back_populates="reviewer_decisions")


# ---------------------------------------------------------
# 9. Audit Events (Chained Cryptographic Audit Trail)
# ---------------------------------------------------------
class ApplicationAuditEvent(Base):
    __tablename__ = "application_audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    actor_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=True)
    actor_role = Column(String(50), default="SYSTEM")
    action = Column(String(100), index=True, nullable=False)  # DOCUMENT_UPLOAD, PII_UNMASK, REVIEWER_OVERRIDE, FINAL_DECISION_RECORDED, REPORT_DOWNLOAD
    ip_address = Column(String(64), default="127.0.0.1")
    user_agent = Column(String(255), nullable=True)
    diff_payload = Column(JSONType, default=dict)
    previous_event_hash = Column(String(64), nullable=True)
    event_hash = Column(String(64), index=True, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now)

    application = relationship("Application", back_populates="audit_logs")
    actor = relationship("User", back_populates="audit_logs")

# Backward compatibility alias
ApplicationAuditLog = ApplicationAuditEvent


# ---------------------------------------------------------
# 10. Report Metadata
# ---------------------------------------------------------
class ReportMetadata(Base):
    __tablename__ = "report_metadata"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    report_type = Column(String(50), default="PDF_SUMMARY", nullable=False)  # PDF_SUMMARY, PDF_FULL_DOSSIER
    file_path = Column(String(512), nullable=False)
    sha256_hash = Column(String(64), index=True, nullable=False)
    file_size_bytes = Column(BigInteger, default=0, nullable=False)
    generated_by_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    status = Column(String(50), default="READY", nullable=False)  # GENERATING, READY, FAILED
    download_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    application = relationship("Application", back_populates="reports")
    generated_by = relationship("User", back_populates="reports_generated")


# ---------------------------------------------------------
# Chat Messages (Remediation Advisor)
# ---------------------------------------------------------
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    sender = Column(String(50), default="USER")  # USER, AI_ADVISOR
    message_text = Column(Text, nullable=False)
    cited_rule_references = Column(JSONType, default=list)
    timestamp = Column(DateTime(timezone=True), default=utc_now)

    application = relationship("Application", back_populates="chat_messages")


# ---------------------------------------------------------
# 11. Request-Correction Workflow (Deficiency Notices)
# ---------------------------------------------------------
class CorrectionRequest(Base):
    __tablename__ = "correction_requests"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    reviewer_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    status = Column(String(50), default="OPEN", index=True)  # OPEN, RESUBMITTED, ACCEPTED, REJECTED
    requested_items = Column(JSONType, default=list, nullable=False)  # List of {field_key, document_type, reason}
    instructions = Column(Text, nullable=False)
    deadline_days = Column(Integer, default=15, nullable=False)
    applicant_response_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    application = relationship("Application", back_populates="correction_requests")
    reviewer = relationship("User", foreign_keys=[reviewer_id])


# ---------------------------------------------------------
# 12. Data Retention & Deletion Governance
# ---------------------------------------------------------
class DataRetentionPolicy(Base):
    __tablename__ = "data_retention_policies"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    policy_code = Column(String(64), unique=True, index=True, nullable=False)  # RETENTION_ACCREDITED, RETENTION_REJECTED, RETENTION_OCR_CACHE, RETENTION_DRAFTS
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    retention_days = Column(Integer, nullable=False)  # e.g. 2555 (7 yrs), 1095 (3 yrs), 90, 30
    is_legal_hold = Column(Boolean, default=False, nullable=False)
    auto_purge_enabled = Column(Boolean, default=True, nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    updated_by_id = Column(String(36), ForeignKey("users.id"), nullable=True)

    updated_by = relationship("User", foreign_keys=[updated_by_id])


# ---------------------------------------------------------
# 13. Sensitive-Data Masking Configuration
# ---------------------------------------------------------
class MaskingConfiguration(Base):
    __tablename__ = "masking_configurations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    identifier_type = Column(String(64), unique=True, index=True, nullable=False)  # AADHAAR, PAN, PHONE, EMAIL, BANK_ACCOUNT, PASSPORT
    label = Column(String(150), nullable=False)
    pattern_regex = Column(String(255), nullable=False)
    masking_mode = Column(String(50), default="PARTIAL_MASK", nullable=False)  # PARTIAL_MASK, FULL_MASK, HASH
    is_active = Column(Boolean, default=True, nullable=False)
    unmask_requires_justification = Column(Boolean, default=True, nullable=False)
    session_timeout_minutes = Column(Integer, default=15, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    updated_by_id = Column(String(36), ForeignKey("users.id"), nullable=True)

    updated_by = relationship("User", foreign_keys=[updated_by_id])


# ---------------------------------------------------------
# 14. Institution Registrations & Renewal Submissions
# ---------------------------------------------------------
class InstitutionRegistration(Base):
    __tablename__ = "institution_registrations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    institution_code = Column(String(64), unique=True, index=True, nullable=False)
    registration_number = Column(String(64), unique=True, index=True, nullable=False)
    institution_name = Column(String(255), nullable=False)
    applicant_user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    institution_type = Column(String(100), default="Private / Self-Financed")
    affiliation_university = Column(String(255), default="Delhi Technological University (DTU)")
    state = Column(String(100), default="Delhi")
    district = Column(String(100), default="New Delhi")
    address = Column(Text, default="Plot No. 12, Institutional Area, Sector 62, New Delhi - 110001")
    contact_email = Column(String(255), default="principal@apex.edu")
    contact_phone = Column(String(50), default="+91-11-28945601")
    head_of_institution = Column(String(255), default="Dr. K. S. Ramanujam (Principal)")

    # Validity & Status
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_upto = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), default="ACTIVE", index=True)  # ACTIVE, EXPIRED, SUSPENDED
    is_autonomous = Column(Boolean, default=False)
    accreditation_grade = Column(String(20), default="NAAC A+")

    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    renewals = relationship("RegistrationRenewal", back_populates="registration", cascade="all, delete-orphan")
    applicant_user = relationship("User", foreign_keys=[applicant_user_id], back_populates="institution_registrations")


class RegistrationRenewal(Base):
    __tablename__ = "registration_renewals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    registration_id = Column(String(36), ForeignKey("institution_registrations.id", ondelete="CASCADE"), index=True, nullable=False)
    applicant_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    application_type = Column(String(50), default="RENEWAL")  # RENEWAL, NEW_REGISTRATION
    renewal_reference_number = Column(String(64), unique=True, index=True, nullable=False)
    academic_year = Column(String(20), default="2026-2027")

    # Persistent status states:
    # NOT_YET_ELIGIBLE, RENEWAL_DUE, SUBMITTED, UNDER_REVIEW, CORRECTIONS_REQUIRED, APPROVED, REJECTED, EXPIRED
    status = Column(String(50), default="SUBMITTED", index=True)

    # Details payload (prefilled and updated)
    institution_details = Column(JSONType, default=dict)

    # Uploaded documents payload: list of {doc_type, file_name, sha256_hash, file_url, uploaded_at}
    uploaded_documents = Column(JSONType, default=list)

    # Workflow dates
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    decision_date = Column(DateTime(timezone=True), nullable=True)
    new_valid_from = Column(DateTime(timezone=True), nullable=True)
    new_valid_upto = Column(DateTime(timezone=True), nullable=True)

    # Reviewer decision & audit
    reviewer_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    deficiency_notice = Column(Text, nullable=True)
    deficiency_deadline_days = Column(Integer, default=15)
    applicant_correction_notes = Column(Text, nullable=True)
    applicant_correction_documents = Column(JSONType, default=list)
    resubmitted_at = Column(DateTime(timezone=True), nullable=True)
    decision = Column(String(50), nullable=True)  # APPROVED, REJECTED, CORRECTIONS_REQUIRED
    decision_notes = Column(Text, nullable=True)
    digital_scrutiny_seal = Column(String(64), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    registration = relationship("InstitutionRegistration", back_populates="renewals")
    applicant = relationship("User", foreign_keys=[applicant_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])



