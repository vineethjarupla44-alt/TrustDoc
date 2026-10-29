import axios from 'axios';
import type {
  ApplicationDetail, AuditLog, ChatMessage, AssessmentSummary, RegulatoryRuleItem,
  ExtractedFieldItem, DocumentStatusInfo, DocumentForensics,
  RegulatorySourceItem, ComplianceEvaluationResponse, RegulatoryQueryResponse,
  SuggestedQuestionsResponse, ReviewerQueueResponse, CorrectionRequestItem,
  ApplicationHistoryItem, AdminUserItem, DataRetentionPolicyItem, MaskingConfigItem
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1';

const getHeaderString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Authentication storage keys
const AUTH_TOKEN_KEY = 'trustdoc_auth_token';
const AUTH_USER_KEY = 'trustdoc_auth_user';

export const getStoredAuth = (): { token: string | null; user: any | null } => {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
    const userJson = localStorage.getItem(AUTH_USER_KEY) || sessionStorage.getItem(AUTH_USER_KEY);
    const user = userJson ? JSON.parse(userJson) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

export const saveStoredAuth = (token: string, user: any, rememberMe: boolean = true) => {
  const target = rememberMe ? localStorage : sessionStorage;
  target.setItem(AUTH_TOKEN_KEY, token);
  target.setItem(AUTH_USER_KEY, JSON.stringify(user));
  setAuthToken(token);
};

export const clearStoredAuth = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
  setAuthToken(null);
};

// Set auth token if needed
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Auto-initialize auth token from local/session storage on app boot
const initialAuth = getStoredAuth();
if (initialAuth.token) {
  setAuthToken(initialAuth.token);
}

export const loginUser = async (credentials: {
  email: string;
  password: string;
  expected_role?: string;
}): Promise<{ access_token: string; user: any; token_type: string }> => {
  const res = await api.post('/auth/login', credentials);
  return res.data;
};

export const registerApplicant = async (data: {
  email: string;
  password: string;
  full_name: string;
  institution_name: string;
  role?: string;
}): Promise<any> => {
  const res = await api.post('/auth/register', {
    ...data,
    role: 'APPLICANT',
  });
  return res.data;
};

export const registerApplicantComprehensive = async (payload: {
  institution_name: string;
  registration_number?: string;
  full_name: string;
  email: string;
  phone_number: string;
  password: string;
  address: string;
  state?: string;
  district?: string;
  institution_type?: string;
  affiliation_university?: string;
  uploaded_documents?: Array<Record<string, any>>;
  terms_accepted?: boolean;
}): Promise<any> => {
  const res = await api.post('/auth/register-applicant', payload);
  return res.data;
};

export const requestOfficerAccount = async (payload: {
  full_name: string;
  email: string;
  employee_id: string;
  department: string;
  designation: string;
  organization: string;
  phone_number?: string;
  password: string;
  resubmit?: boolean;
}): Promise<any> => {
  const res = await api.post('/auth/request-officer', payload);
  return res.data;
};

export const checkOfficerRequestStatus = async (params: {
  email?: string;
  employee_id?: string;
  reference_id?: string;
  identifier?: string;
}): Promise<{
  found: boolean;
  email?: string;
  employee_id?: string;
  full_name?: string;
  department?: string;
  designation?: string;
  organization?: string;
  approval_status?: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | string;
  rejection_reason?: string;
  submitted_at?: string;
  updated_at?: string;
  is_active: boolean;
  message: string;
}> => {
  const res = await api.get('/auth/officer-request-status', { params });
  return res.data;
};

export const fetchAdminSetupStatus = async (): Promise<{
  has_admin: boolean;
  setup_allowed: boolean;
  admin_count: number;
}> => {
  const res = await api.get('/auth/admin-setup-status');
  return res.data;
};

export const initialAdminSetup = async (payload: {
  setup_secret: string;
  full_name: string;
  email: string;
  password: string;
  institution_name?: string;
}): Promise<any> => {
  const res = await api.post('/auth/initial-admin-setup', payload);
  return res.data;
};

export const fetchOfficerRequests = async (statusFilter: string = 'PENDING_APPROVAL'): Promise<any[]> => {
  const res = await api.get('/admin/officer-requests', { params: { status_filter: statusFilter } });
  return res.data;
};

export const recordOfficerRequestDecision = async (
  userId: string,
  payload: { action: 'APPROVE' | 'REJECT'; rejection_reason?: string }
): Promise<any> => {
  const res = await api.post(`/admin/officer-requests/${userId}/decision`, payload);
  return res.data;
};

export const getMe = async (): Promise<any> => {
  const res = await api.get('/auth/me');
  return res.data;
};

export const logoutUser = async (): Promise<void> => {
  try {
    await api.post('/auth/logout');
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    clearStoredAuth();
  }
};

export const fetchApplications = async (): Promise<ApplicationDetail[]> => {
  const res = await api.get('/applications');
  return res.data;
};

export const createApplication = async (data: {
  institution_name: string;
  program_name: string;
  institution_type: string;
}): Promise<ApplicationDetail> => {
  const res = await api.post('/applications', data);
  return res.data;
};

export const fetchApplicationDetail = async (id: string, unmask: boolean = false): Promise<ApplicationDetail> => {
  const res = await api.get(`/applications/${id}`, { params: { unmask } });
  return res.data;
};

export const submitApplication = async (id: string): Promise<any> => {
  const res = await api.post(`/applications/${id}/submit`);
  return res.data;
};

export const runValidation = async (id: string): Promise<AssessmentSummary> => {
  const res = await api.post(`/validation/${id}/run`);
  return res.data;
};

export const uploadDocument = async (
  appId: string,
  docType: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<any> => {
  const formData = new FormData();
  formData.append('document_type', docType);
  formData.append('file', file);
  const res = await api.post(`/documents/upload/${appId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });
  return res.data;
};

export const sendChatMessage = async (appId: string, message: string, lang: string = 'en'): Promise<ChatMessage> => {
  const res = await api.post(`/chat/${appId}`, { message }, { params: { lang } });
  return res.data;
};

export const fetchChatHistory = async (appId: string): Promise<ChatMessage[]> => {
  const res = await api.get(`/chat/${appId}/history`);
  return res.data;
};

export const fetchSuggestedQuestions = async (appId: string): Promise<SuggestedQuestionsResponse> => {
  const res = await api.get(`/chat/${appId}/suggested-questions`);
  return res.data;
};

export const clearChatHistory = async (appId: string): Promise<{ status: string; cleared_count: number; message: string }> => {
  const res = await api.delete(`/chat/${appId}/history`);
  return res.data;
};

export const overrideFinding = async (appId: string, findingId: string, status: string, justification: string) => {
  const res = await api.post(`/reviewer/applications/${appId}/override`, {
    finding_id: findingId,
    status,
    justification,
  });
  return res.data;
};

export const recordReviewerDecision = async (appId: string, decision: string, remarks: string) => {
  const res = await api.post(`/reviewer/applications/${appId}/decision`, {
    decision,
    remarks,
  });
  return res.data;
};

export const unmaskPII = async (appId: string, reason: string) => {
  const res = await api.post(`/reviewer/applications/${appId}/unmask-pii`, { reason });
  return res.data;
};

export const fetchAuditLogs = async (appId: string): Promise<AuditLog[]> => {
  const res = await api.get(`/reviewer/applications/${appId}/audit-logs`);
  return res.data;
};

export const fetchReviewerDashboard = async () => {
  const res = await api.get('/reviewer/dashboard');
  return res.data;
};

export const fetchRegulatoryRules = async (chapter?: string, search?: string): Promise<{ handbook_version: string; disclaimer: string; total_rules: number; rules: RegulatoryRuleItem[] }> => {
  const res = await api.get('/regulations/rules', { params: { chapter, search } });
  return res.data;
};

export const searchRegulatoryRAG = async (query: string) => {
  const res = await api.get('/regulations/search', { params: { query } });
  return res.data;
};

export const seedDemoCases = async () => {
  const res = await api.post('/demo/seed-samples');
  return res.data;
};

export interface ReportAccessTokenInfo {
  token: string;
  application_id: string;
  application_number: string;
  expires_in_seconds: number;
  pdf_url: string;
  download_url: string;
}

export const createReportAccessToken = async (appId: string): Promise<ReportAccessTokenInfo> => {
  const res = await api.post(`/reports/${appId}/token`);
  return res.data;
};

export const getPDFReportUrl = (appId: string, token?: string, mode: 'inline' | 'attachment' = 'inline') => {
  const activeToken = token || getStoredAuth().token;
  const modeParam = `mode=${mode}`;
  return activeToken
    ? `${API_BASE_URL}/reports/${appId}/pdf?token=${activeToken}&${modeParam}`
    : `${API_BASE_URL}/reports/${appId}/pdf?${modeParam}`;
};

/**
 * Fetches the statutory PDF dossier raw bytes via authenticated Axios client (with Authorization header),
 * creates a scoped browser Blob object URL, and returns metadata for rendering in the viewer.
 */
export const fetchReportPDFBlob = async (
  appId: string,
  mode: 'inline' | 'attachment' = 'inline'
): Promise<{ blob: Blob; contentType: string; url: string; filename: string; sha256?: string }> => {
  const res = await api.get(`/reports/${appId}/pdf`, {
    params: { mode },
    responseType: 'blob',
  });
  const contentType = getHeaderString(res.headers['content-type'], 'application/pdf');
  const sha256Header = res.headers['x-report-sha256'];
  const sha256 = typeof sha256Header === 'string' ? sha256Header : undefined;
  let filename = `TrustDoc_Dossier_${appId}.pdf`;
  const disposition = getHeaderString(res.headers['content-disposition'], '');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) filename = match[1];
  }
  const blob = new Blob([res.data], { type: contentType });
  const url = URL.createObjectURL(blob);
  return { blob, contentType, url, filename, sha256 };
};

/**
 * Downloads the official report PDF securely by fetching the authenticated blob and triggering browser download.
 */
export const downloadReportPDF = async (appId: string, customFilename?: string): Promise<void> => {
  const { blob, filename } = await fetchReportPDFBlob(appId, 'attachment');
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = customFilename || filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
};

/**
 * Opens the official report PDF in a new tab securely via an authenticated Blob URL or tokenized URL.
 */
export const openReportInNewTab = async (appId: string): Promise<void> => {
  try {
    const { url } = await fetchReportPDFBlob(appId, 'inline');
    const win = window.open(url, '_blank');
    if (!win) {
      const token = getStoredAuth().token;
      window.open(getPDFReportUrl(appId, token || undefined), '_blank');
    } else {
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    }
  } catch (err) {
    console.error('Failed to open report PDF in new tab via blob:', err);
    const token = getStoredAuth().token;
    window.open(getPDFReportUrl(appId, token || undefined), '_blank');
  }
};


export const getDocumentPreviewUrl = (docId: string, token?: string) => {
  const activeToken = token || getStoredAuth().token;
  return activeToken ? `${API_BASE_URL}/documents/${docId}/preview?token=${activeToken}` : `${API_BASE_URL}/documents/${docId}/preview`;
};

export const getDocumentDownloadUrl = (docId: string, token?: string) => {
  const activeToken = token || getStoredAuth().token;
  return activeToken ? `${API_BASE_URL}/documents/${docId}/download?token=${activeToken}` : `${API_BASE_URL}/documents/${docId}/download`;
};

export const getDocumentHeatmapUrl = (docId: string, token?: string) => {
  const activeToken = token || getStoredAuth().token;
  return activeToken ? `${API_BASE_URL}/documents/${docId}/heatmap?token=${activeToken}` : `${API_BASE_URL}/documents/${docId}/heatmap`;
};

/**
 * Fetches the document raw file bytes via authenticated Axios client (with Authorization header),
 * creates a scoped browser Blob object URL, and returns metadata for rendering in the viewer.
 */
export const fetchDocumentBlob = async (
  docId: string
): Promise<{ blob: Blob; contentType: string; url: string }> => {
  const res = await api.get(`/documents/${docId}/preview`, {
    responseType: 'blob',
  });
  const contentType = getHeaderString(res.headers['content-type'], 'application/pdf');
  const blob = new Blob([res.data], { type: contentType });
  const url = URL.createObjectURL(blob);
  return { blob, contentType, url };
};

/**
 * Downloads a document securely by fetching the authenticated blob and triggering browser download.
 */
export const downloadDocumentFile = async (docId: string, filename?: string): Promise<void> => {
  const res = await api.get(`/documents/${docId}/download`, {
    responseType: 'blob',
  });
  const contentType = getHeaderString(res.headers['content-type'], 'application/pdf');
  const blob = new Blob([res.data], { type: contentType });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename || `document_${docId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
};

/**
 * Opens the original document in a new tab securely via an authenticated Blob URL or tokenized URL.
 */
export const openDocumentInNewTab = async (docId: string): Promise<void> => {
  try {
    const { url } = await fetchDocumentBlob(docId);
    const win = window.open(url, '_blank');
    if (!win) {
      const token = getStoredAuth().token;
      window.open(getDocumentPreviewUrl(docId, token || undefined), '_blank');
    } else {
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  } catch (err) {
    console.error('Failed to open document in new tab:', err);
    const token = getStoredAuth().token;
    window.open(getDocumentPreviewUrl(docId, token || undefined), '_blank');
  }
};

export const fetchDocumentStatus = async (docId: string): Promise<DocumentStatusInfo> => {
  const res = await api.get(`/documents/${docId}/status`);
  return res.data;
};

export const fetchDocumentFields = async (docId: string): Promise<ExtractedFieldItem[]> => {
  const res = await api.get(`/documents/${docId}/fields`);
  return res.data;
};

export const correctDocumentField = async (
  docId: string,
  fieldId: string,
  correctedValue: string,
  correctionReason: string
): Promise<ExtractedFieldItem> => {
  const res = await api.patch(`/documents/${docId}/fields/${fieldId}`, {
    corrected_value: correctedValue,
    correction_reason: correctionReason,
  });
  return res.data;
};

export const createDocumentAccessToken = async (docId: string): Promise<{ token: string; document_id: string; expires_in_seconds: number; download_url: string }> => {
  const res = await api.post(`/documents/${docId}/token`);
  return res.data;
};

export const fetchDocumentForensics = async (docId: string): Promise<DocumentForensics> => {
  const res = await api.get(`/documents/${docId}/forensics`);
  return res.data;
};

export const fetchRegulatorySources = async (): Promise<RegulatorySourceItem[]> => {
  const res = await api.get('/regulations/sources');
  return res.data;
};

export const evaluateApplicationCompliance = async (appId: string): Promise<ComplianceEvaluationResponse> => {
  const res = await api.post(`/regulations/evaluate/${appId}`);
  return res.data;
};

export const queryRegulationsGrounded = async (
  query: string,
  topK: number = 3,
  language: string = 'en',
  applicationId?: string
): Promise<RegulatoryQueryResponse> => {
  const res = await api.post('/regulations/query', {
    query,
    top_k: topK,
    language,
    application_id: applicationId
  });
  return res.data;
};

export const ingestRegulatorySource = async (payload: {
  source_name: string;
  authority: string;
  edition_year?: string;
  version?: string;
  official_url_or_ref?: string;
  is_active?: boolean;
  file_path?: string;
}): Promise<any> => {
  const res = await api.post('/regulations/sources/ingest', payload);
  return res.data;
};

// =========================================================
// Reviewer Queue & Correction Workflow APIs
// =========================================================
export const fetchReviewerQueue = async (
  tier?: string,
  status?: string,
  search?: string
): Promise<ReviewerQueueResponse> => {
  const res = await api.get('/reviewer/queue', { params: { tier, status, search } });
  return res.data;
};

export const requestApplicationCorrection = async (
  appId: string,
  requestedItems: Array<{ field_key?: string; document_type?: string; reason: string }>,
  instructions: string,
  deadlineDays: number = 15
): Promise<CorrectionRequestItem> => {
  const res = await api.post(`/reviewer/applications/${appId}/request-correction`, {
    requested_items: requestedItems,
    instructions,
    deadline_days: deadlineDays,
  });
  return res.data;
};

export const resolveApplicationCorrection = async (
  appId: string,
  action: 'ACCEPT' | 'REJECT',
  reviewerRemarks: string
) => {
  const res = await api.post(`/reviewer/applications/${appId}/resolve-correction`, {
    action,
    reviewer_remarks: reviewerRemarks,
  });
  return res.data;
};

export const fetchApplicationHistory = async (appId: string): Promise<{ application_id: string; application_number: string; events: ApplicationHistoryItem[] }> => {
  const res = await api.get(`/reviewer/applications/${appId}/history`);
  return res.data;
};

// =========================================================
// Administrator Governance APIs
// =========================================================
export const fetchAdminUsers = async (role?: string, search?: string): Promise<AdminUserItem[]> => {
  const res = await api.get('/admin/users', { params: { role, search } });
  return res.data;
};

export const createAdminUser = async (data: {
  email: string;
  password: string;
  full_name: string;
  role: string;
  institution_name?: string;
  is_mfa_enabled?: boolean;
}): Promise<AdminUserItem> => {
  const res = await api.post('/admin/users', data);
  return res.data;
};

export const updateAdminUser = async (
  userId: string,
  data: { role?: string; is_active?: boolean; is_mfa_enabled?: boolean; institution_name?: string }
): Promise<AdminUserItem> => {
  const res = await api.patch(`/admin/users/${userId}`, data);
  return res.data;
};

export const fetchAdminRules = async (category?: string): Promise<any[]> => {
  const res = await api.get('/admin/rules', { params: { category } });
  return res.data;
};

export const createRuleVersion = async (
  ruleId: string,
  versionTag: string,
  parametersJson: Record<string, any>,
  logicHandler?: string
) => {
  const res = await api.post(`/admin/rules/${ruleId}/versions`, {
    version_tag: versionTag,
    parameters_json: parametersJson,
    logic_handler: logicHandler,
  });
  return res.data;
};

export const toggleRegulatorySource = async (sourceId: string) => {
  const res = await api.patch(`/admin/sources/${sourceId}/toggle`);
  return res.data;
};

export const fetchRetentionPolicies = async (): Promise<DataRetentionPolicyItem[]> => {
  const res = await api.get('/admin/retention/policies');
  return res.data;
};

export const updateRetentionPolicy = async (
  policyId: string,
  data: { retention_days?: number; is_legal_hold?: boolean; auto_purge_enabled?: boolean; description?: string }
): Promise<DataRetentionPolicyItem> => {
  const res = await api.put(`/admin/retention/policies/${policyId}`, data);
  return res.data;
};

export const executeRetentionSweep = async () => {
  const res = await api.post('/admin/retention/execute-sweep');
  return res.data;
};

export const fetchMaskingConfig = async (): Promise<MaskingConfigItem[]> => {
  const res = await api.get('/admin/masking/config');
  return res.data;
};

export const updateMaskingConfig = async (
  configId: string,
  data: { pattern_regex?: string; masking_mode?: string; is_active?: boolean; unmask_requires_justification?: boolean; session_timeout_minutes?: number }
): Promise<MaskingConfigItem> => {
  const res = await api.put(`/admin/masking/config/${configId}`, data);
  return res.data;
};

export const testMaskingText = async (sampleText: string): Promise<{ original_text: string; masked_text: string; matched_identifiers: string[] }> => {
  const res = await api.post('/admin/masking/test', { sample_text: sampleText });
  return res.data;
};

export const fetchGlobalAuditLogs = async (action?: string, actorRole?: string, limit: number = 50): Promise<AuditLog[]> => {
  const res = await api.get('/admin/audit/system-logs', { params: { action, actor_role: actorRole, limit } });
  return res.data;
};

// -------------------------------------------------------------
// College Registration & Renewal APIs
// -------------------------------------------------------------
export const fetchCollegeRegistrationOverview = async (): Promise<any> => {
  const res = await api.get('/registrations/overview');
  return res.data;
};

export const submitCollegeRegistrationRenewal = async (payload: {
  institution_details: Record<string, any>;
  uploaded_documents: Array<Record<string, any>>;
  academic_year?: string;
}): Promise<any> => {
  const res = await api.post('/registrations/renewal', payload);
  return res.data;
};

export const submitNewCollegeRegistration = async (payload: {
  institution_name: string;
  institution_type?: string;
  affiliation_university?: string;
  state?: string;
  district?: string;
  address: string;
  contact_email: string;
  contact_phone: string;
  head_of_institution: string;
  uploaded_documents?: Array<Record<string, any>>;
}): Promise<any> => {
  const res = await api.post('/registrations/new', payload);
  return res.data;
};

export const fetchRegistrationScrutinyQueue = async (statusFilter?: string): Promise<any[]> => {
  const res = await api.get('/registrations/queue', { params: { status_filter: statusFilter } });
  return res.data;
};

export const recordRenewalDecision = async (
  renewalId: string,
  payload: {
    decision: 'APPROVED' | 'CORRECTIONS_REQUIRED' | 'REJECTED';
    statutory_notes: string;
    deficiency_notice?: string;
    deficiency_deadline_days?: number;
    extension_years?: number;
  }
): Promise<any> => {
  const res = await api.post(`/registrations/renewal/${renewalId}/decision`, payload);
  return res.data;
};

export const resubmitRenewalCorrections = async (
  renewalId: string,
  payload: {
    correction_notes: string;
    correction_documents: Array<Record<string, any>>;
  }
): Promise<any> => {
  const res = await api.post(`/registrations/renewal/${renewalId}/resubmit-corrections`, payload);
  return res.data;
};

export const fetchRenewalRules = async (): Promise<any> => {
  const res = await api.get('/registrations/rules');
  return res.data;
};






