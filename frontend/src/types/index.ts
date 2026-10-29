export type Role = 'APPLICANT' | 'REVIEWER' | 'AUDITOR' | 'ADMIN';
export type Language = 'en' | 'hi' | 'te';

export type ScreenId =
  | 'landing'
  | 'login'
  | 'role_selection'
  | 'login_applicant'
  | 'login_officer'
  | 'login_admin'
  | 'register'
  | 'applicant_dashboard'
  | 'officer_dashboard'
  | 'admin_dashboard'
  | 'overview'
  | 'applications'
  | 'application_detail'
  | 'new_application'
  | 'document_split'
  | 'authenticity_dossier'
  | 'compliance_findings'
  | 'risk_summary'
  | 'chatbot'
  | 'reviewer_decision'
  | 'regulatory_rules'
  | 'audit_and_report'
  | 'admin_console';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  institution_name?: string;
  is_active?: boolean;
}

export interface AuthUser extends User {
  token?: string;
}

export type AuthenticityStateType =
  | 'VERIFIED'
  | 'SUSPICIOUS_INDICATOR'
  | 'MISMATCH'
  | 'UNAVAILABLE'
  | 'NEEDS_MANUAL_REVIEW';

export interface AuthenticityCheckItem {
  check_code: string;
  check_name: string;
  state: AuthenticityStateType;
  can_establish: string[];
  cannot_establish: string[];
  explanation: string;
  evidence: Record<string, any>;
  anomaly_score: number;
  suspicious_regions?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    area_pixels: number;
    relative_coords?: {
      x_norm: number;
      y_norm: number;
      width_norm: number;
      height_norm: number;
    };
  }>;
}

export interface DocumentForensics {
  id: string;
  ela_anomaly_score: number;
  metadata_mismatch_flag: boolean;
  metadata_dump: Record<string, any>;
  qr_detected: boolean;
  qr_payload?: any;
  digital_signature_present: boolean;
  signature_valid: boolean;
  signer_identity?: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  remarks?: string;
  screening_results?: AuthenticityCheckItem[];
  heatmap_generated?: boolean;
  heatmap_path?: string;
  heatmap_url?: string;
  disclaimer?: string;
  evaluated_at?: string;
}

export interface ExtractedEntities {
  id: string;
  structured_fields: Record<string, any>;
  confidence_score: number;
  ocr_engine: string;
  raw_text?: string;
}

export type FieldState = 'DETECTED' | 'MISSING_IN_DOCUMENT' | 'EXTRACTION_FAILED' | 'MANUALLY_ENTERED';

export interface ExtractedFieldItem {
  id: string;
  document_id: string;
  field_key: string;
  label?: string;
  field_value_normalized?: string;
  field_value_raw?: string;
  data_type: string;
  confidence_score: number;
  page_number: number;
  bounding_box?: Record<string, any>;
  ocr_engine: string;
  state: FieldState;
  is_manually_corrected: boolean;
  corrected_by_user_id?: string;
  correction_reason?: string;
  is_pii: boolean;
  created_at: string;
  updated_at?: string;
}

export interface DocumentStatusInfo {
  document_id: string;
  status: string;
  total_pages: number;
  ocr_engine: string;
  fields_extracted_count: number;
  fields_missing_count: number;
  fields_failed_count: number;
  needs_manual_review: boolean;
  updated_at: string;
}

export interface DocumentItem {
  id: string;
  application_id: string;
  document_type: string;
  file_name: string;
  sha256_hash: string;
  file_size_bytes: number;
  mime_type: string;
  extraction_status: string;
  created_at: string;
  forensics?: DocumentForensics;
  extracted_entities?: ExtractedEntities;
  extracted_fields?: ExtractedFieldItem[];
}

export type ValidationStatusType = 'PASS' | 'FAIL' | 'WARNING' | 'NEEDS_REVIEW';

export interface ComplianceFinding {
  id: string;
  application_id: string;
  source_document_id?: string;
  category: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  rule_code: string;
  title: string;
  description: string;
  evidence_quote?: string;
  suggested_remediation?: string;
  status?: string;
  finding_status?: ValidationStatusType;
  source_field_ref?: Record<string, any>;
  resolved_by_applicant: boolean;
  created_at: string;
}

export interface AssessmentSummary {
  id: string;
  application_id: string;
  authenticity_score: number;
  completeness_score: number;
  compliance_score: number;
  composite_score: number;
  recommendation: 'ELIGIBLE' | 'DEFICIENT' | 'REJECTED' | 'PROCESSING';
  evaluated_at: string;
}

export interface ApplicationDetail {
  id: string;
  applicant_id: string;
  application_number: string;
  institution_name?: string;
  program_name: string;
  institution_type: string;
  state?: string;
  district?: string;
  academic_year?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'PROCESSING' | 'FLAGGED' | 'APPROVED' | 'DEFICIENT';
  submitted_at?: string;
  created_at: string;
  summary?: AssessmentSummary;
  documents: DocumentItem[];
  findings: ComplianceFinding[];
}

export interface AuditLog {
  id: string;
  application_id: string;
  actor_id?: string;
  actor_role?: string;
  action: string;
  ip_address: string;
  diff_payload: Record<string, any>;
  event_hash?: string;
  previous_event_hash?: string;
  timestamp: string;
}

export interface CitedRuleReference {
  rule_code: string;
  title: string;
  page_number?: number;
  source_name?: string;
  official_url?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'USER' | 'AI_ADVISOR' | 'SYSTEM';
  message_text: string;
  cited_rule_references: CitedRuleReference[];
  timestamp?: string;
  created_at?: string;
}

export interface SuggestedQuestionItem {
  id: string;
  question_text: string;
  category: 'DEFICIENCY' | 'RAG_REQUIREMENT' | 'GENERAL';
  related_rule_code?: string;
}

export interface SuggestedQuestionsResponse {
  application_id: string;
  questions: SuggestedQuestionItem[];
}

export interface RegulatoryRuleItem {
  chapter: string;
  rule_code: string;
  title: string;
  threshold: string;
  description: string;
  mandatory_doc: string;
  severity: 'CRITICAL' | 'WARNING';
}

export type ComplianceState =
  | 'EXPLICITLY_SATISFIED'
  | 'APPARENTLY_VIOLATED'
  | 'AMBIGUOUS_REQUIREMENT'
  | 'OUTDATED_OR_UNAVAILABLE_SOURCE'
  | 'NEEDS_HUMAN_REVIEW';

export interface RegulatorySourceItem {
  id: string;
  source_name: string;
  authority: string;
  edition_year: string;
  version: string;
  official_url_or_ref?: string;
  published_date?: string;
  effective_date?: string;
  is_active: boolean;
  sha256_hash: string;
  chunks_count: number;
  created_at: string;
}

export interface RegulatoryChunkItem {
  id: string;
  source_id: string;
  chapter: string;
  section?: string;
  clause_number?: string;
  page_number: number;
  title: string;
  content: string;
  is_ambiguous: boolean;
  source_name?: string;
  official_url?: string;
}

export interface CitationVerificationResult {
  clause_number: string;
  is_verified: boolean;
  source_title: string;
  page_number?: number;
  matched_quote?: string;
  verification_status: 'VERIFIED' | 'UNVERIFIED' | 'OUTDATED';
}

export interface GroundedFindingItem {
  clause_number: string;
  rule_title: string;
  compliance_state: ComplianceState;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  explanation: string;
  evidence_found: Record<string, any>;
  regulatory_source_ref: Record<string, any>;
  citation_verified: boolean;
  suggested_remediation?: string;
}

export interface ComplianceEvaluationResponse {
  application_id: string;
  evaluated_at: string;
  overall_compliance_state: ComplianceState;
  compliance_score: number;
  total_evaluated_clauses: number;
  explicitly_satisfied_count: number;
  apparently_violated_count: number;
  ambiguous_count: number;
  outdated_source_count: number;
  needs_review_count: number;
  findings: GroundedFindingItem[];
  regulatory_sources_used: Array<Record<string, any>>;
  disclaimer: string;
}

export interface RegulatoryQueryResponse {
  query: string;
  answer: string;
  citations: Array<{
    clause_number?: string;
    rule_code?: string;
    title: string;
    page_number?: number;
    quote?: string;
    source_title?: string;
    official_url?: string;
    is_ambiguous?: boolean;
  }>;
  retrieved_chunks: RegulatoryChunkItem[];
  citation_verification: CitationVerificationResult[];
  vector_search_mode: string;
}

export interface PrioritizedQueueItem {
  application_id: string;
  application_number: string;
  institution_name: string;
  program_name: string;
  institution_type: string;
  status: 'DRAFT' | 'SUBMITTED' | 'PROCESSING' | 'FLAGGED' | 'APPROVED' | 'DEFICIENT';
  submitted_at?: string;
  created_at: string;
  composite_score: number;
  authenticity_score: number;
  completeness_score: number;
  compliance_score: number;
  priority_tier: 'CRITICAL_HIGH' | 'MODERATE_MEDIUM' | 'ROUTINE_CLEARANCE';
  authenticity_flags_count: number;
  completeness_flags_count: number;
  regulatory_flags_count: number;
  documents_count: number;
  missing_documents: string[];
  correction_status?: 'OPEN' | 'RESUBMITTED' | 'ACCEPTED' | 'REJECTED' | null;
}

export interface ReviewerQueueResponse {
  total_items: number;
  critical_count: number;
  moderate_count: number;
  routine_count: number;
  all_eligible_count?: number;
  queue: PrioritizedQueueItem[];
}

export interface CorrectionRequestItem {
  id: string;
  application_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  status: 'OPEN' | 'RESUBMITTED' | 'ACCEPTED' | 'REJECTED';
  requested_items: Array<{ field_key?: string; document_type?: string; reason: string }>;
  instructions: string;
  deadline_days: number;
  applicant_response_notes?: string;
  created_at: string;
  resolved_at?: string;
}

export interface ApplicationHistoryItem {
  event_id: string;
  event_type: string;
  title: string;
  actor_name?: string;
  actor_role: string;
  timestamp: string;
  diff_summary: Record<string, any>;
  sha256_hash?: string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  institution_name?: string;
  is_active: boolean;
  is_mfa_enabled: boolean;
  created_at: string;
}

export interface DataRetentionPolicyItem {
  id: string;
  policy_code: string;
  title: string;
  category: string;
  retention_days: number;
  is_legal_hold: boolean;
  auto_purge_enabled: boolean;
  description?: string;
  updated_at: string;
}

export interface MaskingConfigItem {
  id: string;
  identifier_type: string;
  label: string;
  pattern_regex: string;
  masking_mode: 'PARTIAL_MASK' | 'FULL_MASK' | 'HASH';
  is_active: boolean;
  unmask_requires_justification: boolean;
  session_timeout_minutes: number;
  updated_at: string;
}

export type RenewalStatus =
  | 'NOT_YET_ELIGIBLE'
  | 'RENEWAL_DUE'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CORRECTIONS_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export interface InstitutionRegistrationItem {
  id: string;
  institution_code: string;
  registration_number: string;
  institution_name: string;
  applicant_user_id: string;
  institution_type: string;
  affiliation_university: string;
  state: string;
  district: string;
  address: string;
  contact_email: string;
  contact_phone: string;
  head_of_institution: string;
  valid_from: string;
  valid_upto: string;
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  is_autonomous: boolean;
  accreditation_grade: string;
  created_at: string;
  updated_at: string;
}

export interface RegistrationRenewalItem {
  id: string;
  registration_id: string;
  applicant_id: string;
  application_type: 'RENEWAL' | 'NEW_REGISTRATION';
  renewal_reference_number: string;
  academic_year: string;
  status: RenewalStatus;
  institution_details: Record<string, any>;
  uploaded_documents: Array<{
    doc_type: string;
    file_name: string;
    sha256_hash: string;
    file_url?: string;
    uploaded_at?: string;
  }>;
  submitted_at?: string;
  reviewed_at?: string;
  decision_date?: string;
  new_valid_from?: string;
  new_valid_upto?: string;
  reviewer_id?: string;
  deficiency_notice?: string;
  deficiency_deadline_days: number;
  applicant_correction_notes?: string;
  applicant_correction_documents: Array<Record<string, any>>;
  resubmitted_at?: string;
  decision?: 'APPROVED' | 'REJECTED' | 'CORRECTIONS_REQUIRED';
  decision_notes?: string;
  digital_scrutiny_seal?: string;
  created_at: string;
  updated_at: string;
}

export interface CollegeRegistrationOverview {
  registration?: InstitutionRegistrationItem;
  active_renewal?: RegistrationRenewalItem;
  renewal_history: RegistrationRenewalItem[];
  eligibility_status: RenewalStatus;
  eligibility_message: string;
  days_until_expiry?: number;
  renewal_window_days: number;
  renewal_extension_years: number;
}



