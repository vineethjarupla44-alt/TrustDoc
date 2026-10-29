import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Mail,
  User,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  BadgeCheck,
  Building2,
  Clock,
  Briefcase,
  Search,
  RefreshCw,
  XCircle,
  Sparkles
} from 'lucide-react';
import { useRouter } from '../../router/Router';
import { requestOfficerAccount, checkOfficerRequestStatus } from '../../services/api';

type ConflictType =
  | 'ALREADY_PENDING'
  | 'APPROVED_EXISTS'
  | 'PREVIOUSLY_REJECTED'
  | 'CREDENTIAL_MISMATCH'
  | 'ROLE_CONFLICT'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR';

interface NoticeState {
  type: ConflictType;
  title: string;
  message: string;
  referenceId?: string;
  rejectionReason?: string;
  canResubmit?: boolean;
}

export const OfficerRequestScreen: React.FC = () => {
  const { navigate } = useRouter();

  // Active Screen View: Form vs Status Lookup
  const [activeTab, setActiveTab] = useState<'form' | 'status_lookup'>('form');

  // Form Fields (non-sensitive fields are preserved upon submission failure)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('Central Scrutiny Cell');
  const [designation, setDesignation] = useState('Senior Scrutiny Officer');
  const [organization, setOrganization] = useState('AICTE Statutory Regulatory Authority');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [conductAgreed, setConductAgreed] = useState(false);
  const [isResubmissionMode, setIsResubmissionMode] = useState(false);

  // Submission State
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [successData, setSuccessData] = useState<{
    reference_id: string;
    full_name: string;
    email: string;
    employee_id: string;
    department: string;
    organization: string;
    message: string;
  } | null>(null);

  // Status Lookup State
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<any | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent, forceResubmit = false) => {
    e.preventDefault();
    setNotice(null);

    const cleanName = fullName.trim();
    const cleanMail = email.trim().toLowerCase();
    const cleanEmp = employeeId.trim();
    const cleanOrg = organization.trim();

    // 1. Frontend validation
    if (!cleanName || !cleanMail || !cleanEmp || !cleanOrg) {
      setNotice({
        type: 'VALIDATION_ERROR',
        title: 'Missing Required Fields',
        message: 'Full name, official email, employee ID, and authority organization are required.',
      });
      return;
    }

    if (!cleanMail.includes('@') || !cleanMail.includes('.')) {
      setNotice({
        type: 'VALIDATION_ERROR',
        title: 'Invalid Official Email',
        message: 'Please provide a valid official government or regulatory authority email address.',
      });
      return;
    }

    if (!password) {
      setNotice({
        type: 'VALIDATION_ERROR',
        title: 'Password Required',
        message: 'Password is required to secure your officer portal account.',
      });
      return;
    }

    if (password.length < 6) {
      setNotice({
        type: 'VALIDATION_ERROR',
        title: 'Password Too Short',
        message: 'Password must be at least 6 characters long.',
      });
      return;
    }

    if (password !== confirmPassword) {
      setNotice({
        type: 'VALIDATION_ERROR',
        title: 'Password Mismatch',
        message: 'Passwords do not match. Please verify your entries.',
      });
      return;
    }

    if (!conductAgreed) {
      setNotice({
        type: 'VALIDATION_ERROR',
        title: 'Official Secrets Undertaking Required',
        message: 'You must agree to the Statutory Forensics Code of Conduct and Official Secrets provisions.',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await requestOfficerAccount({
        full_name: cleanName,
        email: cleanMail,
        employee_id: cleanEmp,
        department: department.trim(),
        designation: designation.trim(),
        organization: cleanOrg,
        phone_number: phone.trim() || undefined,
        password,
        resubmit: forceResubmit || isResubmissionMode,
      });

      // Clear passwords on success
      setPassword('');
      setConfirmPassword('');

      setSuccessData({
        reference_id: response.request_id || 'OFFICER-REQ-PENDING',
        full_name: cleanName,
        email: cleanMail,
        employee_id: cleanEmp,
        department: department.trim(),
        organization: cleanOrg,
        message: response.message || 'Security Officer credentials registered successfully.',
      });
    } catch (err: any) {
      console.error('Officer request submission error:', err);

      // SECURITY RULE: Never retain passwords on failed submission
      setPassword('');
      setConfirmPassword('');

      const detail = err.response?.data?.detail;
      const status = err.response?.status;
      const conflictHeader = err.response?.headers?.['x-conflict-code'];
      const rejectionHeader = err.response?.headers?.['x-rejection-reason'];
      const detailStr = typeof detail === 'string' ? detail : (detail?.message || '');

      // Case B: Identical pending request already exists
      if (
        conflictHeader === 'ALREADY_PENDING' ||
        detailStr.includes('already exists for these details') ||
        detailStr.includes('awaiting administrator review')
      ) {
        setNotice({
          type: 'ALREADY_PENDING',
          title: 'Request Already Pending Administrator Review',
          message: 'An officer account request already exists for these details and is awaiting administrator review.',
          referenceId: err.response?.headers?.['x-officer-ref'] || 'OFFICER-REQ-PENDING',
        });
      }
      // Case C: Officer account already exists and is approved
      else if (
        conflictHeader === 'APPROVED_EXISTS' ||
        detailStr.includes('already exists for this email. Please log in') ||
        detailStr.includes('already exists for this email')
      ) {
        setNotice({
          type: 'APPROVED_EXISTS',
          title: 'Officer Account Already Exists & Is Approved',
          message: 'An officer account already exists for this email. Please log in or use password recovery.',
        });
      }
      // Case D: An existing request was rejected
      else if (
        conflictHeader === 'PREVIOUSLY_REJECTED' ||
        detailStr.includes('rejected by administration')
      ) {
        setNotice({
          type: 'PREVIOUSLY_REJECTED',
          title: 'Previous Officer Request Was Not Approved',
          message: detailStr || 'A previous officer account request for this email was rejected by administration.',
          rejectionReason: rejectionHeader,
          canResubmit: true,
        });
      }
      // Case E: Conflict between email and employee ID or role mismatch
      else if (
        conflictHeader === 'CREDENTIAL_MISMATCH' ||
        conflictHeader === 'ROLE_CONFLICT' ||
        detailStr.includes('Conflict detected')
      ) {
        setNotice({
          type: 'CREDENTIAL_MISMATCH',
          title: 'Credential Discrepancy Detected',
          message: detailStr || 'Conflict detected: The submitted email or employee ID is already associated with another record. Please verify your credentials or contact Central Scrutiny Administration.',
        });
      }
      // Case F: Database or server error
      else if (status >= 500) {
        setNotice({
          type: 'SERVER_ERROR',
          title: 'Server Communication Alert',
          message: detailStr || 'An unexpected system error occurred while processing your officer account request. Safe diagnostic logs have been recorded on the server. Please try again later or contact administrator support.',
        });
      }
      // Fallback validation / request error
      else {
        setNotice({
          type: 'VALIDATION_ERROR',
          title: 'Registration Alert',
          message: detailStr || 'Officer account request could not be processed. Please verify your official details.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLookupStatus = async (explicitQuery?: string) => {
    const q = (explicitQuery || lookupQuery || email || employeeId).trim();
    if (!q) {
      setLookupError('Please enter your official email, employee ID, or request reference code.');
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const res = await checkOfficerRequestStatus({ identifier: q });
      setLookupResult(res);
      if (!res.found) {
        setLookupError(res.message || 'No matching officer account request found in the system registry.');
      }
    } catch (err: any) {
      console.error('Status lookup error:', err);
      setLookupError(
        err.response?.data?.detail || 'Unable to query officer status. Please check your network connectivity.'
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const handleTriggerQuickStatus = () => {
    const query = email.trim() || employeeId.trim() || (notice?.referenceId || '');
    setLookupQuery(query);
    setActiveTab('status_lookup');
    handleLookupStatus(query);
  };

  // =========================================================
  // SUCCESS CONFIRMATION VIEW (Case A)
  // =========================================================
  if (successData) {
    return (
      <div className="min-h-[85vh] flex flex-col justify-center max-w-xl mx-auto px-4 sm:px-6 py-10 text-[#111827]">
        <div className="bg-white rounded-2xl border border-blue-200 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center text-[#1D4ED8] mx-auto shadow-xs">
            <Clock className="w-9 h-9" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Request Submitted — Pending Administrator Approval
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-2">
              Security Officer Credential Request Recorded
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Your official credentials have been recorded with statutory integrity. Your account is gated and awaiting formal administrator verification.
            </p>
          </div>

          {/* Reference Summary Card */}
          <div className="bg-[#F4F7FB] border border-[#E2E8F0] rounded-xl p-4 text-left space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Request Reference Code:</span>
              <span className="font-mono font-bold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {successData.reference_id}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Officer Full Name:</span>
              <span className="font-bold text-slate-900">{successData.full_name}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Government / Employee ID:</span>
              <span className="font-mono font-bold text-slate-900">{successData.employee_id}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Assigned Department:</span>
              <span className="font-medium text-slate-700">{successData.department}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Official Email:</span>
              <span className="font-semibold text-slate-900">{successData.email}</span>
            </div>
          </div>

          {/* Statutory Security Disclaimer */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 text-left flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Strict Access Control:</span> To safeguard national regulatory scrutiny and evidence integrity, Security Officer accounts remain{' '}
              <span className="font-semibold underline">inactive by default</span>. An authenticated System Administrator will review and approve your credentials in the Administration Console before login is authorized.
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setLookupQuery(successData.reference_id);
                setSuccessData(null);
                setActiveTab('status_lookup');
                handleLookupStatus(successData.reference_id);
              }}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-slate-700 text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-300 transition flex items-center justify-center gap-2"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Track Request Status</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/login/officer')}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-white text-xs font-bold bg-[#1D4ED8] hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 shadow-md transition flex items-center justify-center gap-2"
            >
              <span>Return to Officer Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex flex-col justify-center max-w-2xl mx-auto px-4 sm:px-6 py-10 text-[#111827]">
      {/* Top Navigation Row */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/login/officer')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#111827] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-0.5 transition-transform" />
          <span>Return to Security Officer Login</span>
        </button>

        {/* View Switcher: Registration vs Status Lookup */}
        <div className="flex items-center bg-[#F4F7FB] border border-[#E2E8F0] p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-3 py-1 rounded-lg transition ${
              activeTab === 'form' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Request Account
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('status_lookup')}
            className={`px-3 py-1 rounded-lg transition ${
              activeTab === 'status_lookup' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Check Status
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden">
        {/* Card Header */}
        <div className="p-6 sm:p-7 bg-[#F4F7FB] border-b border-[#E2E8F0] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#0B1220] flex items-center justify-center text-white shadow-md">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  TrustDoc Statutory Scrutiny Cell
                </span>
                <h2 className="text-lg font-bold text-[#111827]">
                  {activeTab === 'form' ? 'Request Security Officer Account' : 'Officer Request Approval Status'}
                </h2>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md border bg-blue-50 text-blue-700 border-blue-200">
              OFFICER PROVISIONING
            </span>
          </div>

          <p className="text-xs text-[#64748B] leading-relaxed">
            {activeTab === 'form'
              ? 'Submit official credentials for institutional application scrutiny and forensic evidence authorization. All requests require statutory administrator approval before portal access is activated.'
              : 'Track the vetting status of an existing officer registration request by supplying your registered email address, employee ID, or request reference code.'}
          </p>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* STRUCTURED ALERTS FOR CASES B, C, D, E, F                     */}
        {/* ------------------------------------------------------------- */}
        {notice && (
          <div className="mx-6 sm:mx-7 mt-5">
            {/* Case B: An identical pending request already exists */}
            {notice.type === 'ALREADY_PENDING' && (
              <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-3 text-xs text-amber-950 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-amber-900">{notice.title}</h4>
                    <p className="leading-relaxed text-amber-800">{notice.message}</p>
                    <p className="text-[11px] text-amber-700 pt-0.5">
                      Your credentials are safe in the administrative review queue. A duplicate request is not required.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/80">
                  <button
                    type="button"
                    onClick={handleTriggerQuickStatus}
                    className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Check Live Request Status</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/login/officer')}
                    className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 font-semibold rounded-xl border border-amber-300 transition"
                  >
                    Return to Login
                  </button>
                </div>
              </div>
            )}

            {/* Case C: An officer account already exists and is approved */}
            {notice.type === 'APPROVED_EXISTS' && (
              <div className="p-4 bg-emerald-50/90 border border-emerald-300 rounded-2xl space-y-3 text-xs text-emerald-950 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-emerald-900">{notice.title}</h4>
                    <p className="leading-relaxed text-emerald-800">{notice.message}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-200">
                  <button
                    type="button"
                    onClick={() => navigate('/login/officer')}
                    className="px-3.5 py-1.5 bg-[#1D4ED8] hover:bg-blue-700 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Go to Security Officer Login</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Case D: An existing request was rejected */}
            {notice.type === 'PREVIOUSLY_REJECTED' && (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl space-y-3 text-xs text-rose-950 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0 mt-0.5">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-sm text-rose-900">{notice.title}</h4>
                    <p className="leading-relaxed text-rose-800">{notice.message}</p>
                    {notice.rejectionReason && (
                      <div className="p-2 bg-white/80 rounded-lg border border-rose-200 text-rose-900 font-mono text-[11px]">
                        <strong>Statutory Reason:</strong> {notice.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResubmissionMode(true);
                      setNotice(null);
                    }}
                    className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Submit Revised Credentials for Re-Review</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTriggerQuickStatus}
                    className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-900 font-semibold rounded-xl border border-rose-300 transition"
                  >
                    View Rejection History
                  </button>
                </div>
              </div>
            )}

            {/* Case E: Email / Employee ID Conflict */}
            {notice.type === 'CREDENTIAL_MISMATCH' && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-2 text-xs text-amber-950 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-amber-900">{notice.title}</h4>
                    <p className="leading-relaxed text-amber-800">{notice.message}</p>
                    <p className="text-[11px] text-amber-700">
                      Need assistance with credentials? Contact Central Administration at <span className="font-semibold underline">support@aicte.gov.in</span>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Case F: Server or validation error */}
            {(notice.type === 'SERVER_ERROR' || notice.type === 'VALIDATION_ERROR') && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <div className="flex-1 leading-relaxed">
                  <span className="font-bold">{notice.title}:</span> {notice.message}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resubmission Mode Banner */}
        {isResubmissionMode && activeTab === 'form' && (
          <div className="mx-6 sm:mx-7 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Re-Review Mode Enabled:</strong> Modifying and re-submitting your application to Central Administration.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsResubmissionMode(false)}
              className="text-[11px] font-bold text-blue-700 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 1: REGISTRATION / RE-SUBMISSION FORM                 */}
        {/* ========================================================= */}
        {activeTab === 'form' && (
          <form onSubmit={(e) => handleSubmit(e, isResubmissionMode)} className="p-6 sm:p-7 space-y-4">
            {/* Official Identification */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="officer-name">
                  Officer Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="officer-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Arvind Sharma"
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#1D4ED8] focus:bg-white focus:ring-1 focus:ring-[#1D4ED8] transition font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="employee-id">
                  Government / Employee ID *
                </label>
                <div className="relative">
                  <BadgeCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="employee-id"
                    type="text"
                    required
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="e.g. AICTE-SCR-8491"
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#1D4ED8] focus:bg-white focus:ring-1 focus:ring-[#1D4ED8] transition font-mono font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="officer-email">
                  Official Institutional Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="officer-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. a.sharma@aicte.gov.in"
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#1D4ED8] focus:bg-white focus:ring-1 focus:ring-[#1D4ED8] transition font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="officer-phone">
                  Contact Phone / Extension
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="officer-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 11 2958 1000"
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#1D4ED8] focus:bg-white focus:ring-1 focus:ring-[#1D4ED8] transition font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Department, Designation & Organization */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="officer-dept">
                  Scrutiny Department *
                </label>
                <select
                  id="officer-dept"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#1D4ED8] focus:bg-white transition font-medium"
                >
                  <option value="Central Scrutiny Cell">Central Scrutiny Cell</option>
                  <option value="Document Forensics Bureau">Document Forensics Bureau</option>
                  <option value="Vigilance & Integrity Wing">Vigilance & Integrity Wing</option>
                  <option value="Regional Office Inspection">Regional Office Inspection</option>
                  <option value="Legal & Appellate Cell">Legal & Appellate Cell</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="officer-desig">
                  Designation *
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="officer-desig"
                    type="text"
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Scrutiny Officer"
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#1D4ED8] focus:bg-white transition font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="officer-org">
                  Authority Organization *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="officer-org"
                    type="text"
                    required
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="e.g. AICTE Statutory Authority"
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#1D4ED8] focus:bg-white transition font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Password & Confirm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="officer-password">
                  Portal Password (Min 6 chars) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="officer-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create secure password"
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-10 py-2.5 rounded-xl focus:outline-none focus:border-[#1D4ED8] focus:bg-white transition font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="officer-confirm-pass">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="officer-confirm-pass"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#1D4ED8] focus:bg-white transition font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Code of Conduct Undertaking */}
            <div className="pt-2 border-t border-[#E2E8F0]">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={conductAgreed}
                  onChange={(e) => setConductAgreed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-[#1D4ED8] border-slate-300 focus:ring-[#1D4ED8]"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  I hereby declare that I am an authorized scrutiny/verification official. I agree to uphold the statutory confidentiality of applicant dossiers, forensic indicators, and AI evaluation findings under the Official Secrets Act and DPDP Act, 2023.
                </span>
              </label>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-white text-xs font-bold bg-[#1D4ED8] hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 shadow-md transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Transmitting Officer Credential Request...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isResubmissionMode ? 'Resubmit Officer Request for Re-Review' : 'Submit Security Officer Request'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Bottom Links */}
            <div className="pt-3 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
              <div>
                <span>Already requested an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('status_lookup');
                    if (email.trim() || employeeId.trim()) {
                      handleLookupStatus();
                    }
                  }}
                  className="font-bold text-[#1D4ED8] hover:underline"
                >
                  Check Approval Status
                </button>
              </div>

              <div>
                <span>Already approved? </span>
                <button
                  type="button"
                  onClick={() => navigate('/login/officer')}
                  className="font-bold text-[#1D4ED8] hover:underline"
                >
                  Sign in to Officer Console
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: LIVE STATUS INQUIRY                               */}
        {/* ========================================================= */}
        {activeTab === 'status_lookup' && (
          <div className="p-6 sm:p-7 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="lookup-input">
                Official Email, Government Employee ID, or Request Reference:
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="lookup-input"
                    type="text"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLookupStatus();
                    }}
                    placeholder="Enter email (e.g. officer@aicte.gov.in) or Employee ID"
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#1D4ED8] focus:bg-white font-medium"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleLookupStatus()}
                  disabled={lookupLoading}
                  className="px-4 py-2.5 bg-[#1D4ED8] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 disabled:opacity-50 shadow-xs"
                >
                  {lookupLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>Look Up Status</span>
                </button>
              </div>
            </div>

            {lookupError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <div className="leading-relaxed">{lookupError}</div>
              </div>
            )}

            {/* Status Result Card */}
            {lookupResult && lookupResult.found && (
              <div className="bg-[#F4F7FB] border border-[#E2E8F0] rounded-2xl p-5 space-y-4 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Officer Identity
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{lookupResult.full_name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{lookupResult.email}</p>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {lookupResult.approval_status === 'APPROVED' ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Approved & Active
                      </span>
                    ) : lookupResult.approval_status === 'REJECTED' ? (
                      <span className="px-3 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        Request Not Approved
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
                        <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        Pending Administrator Review
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium">Employee / Service ID:</span>
                    <div className="font-mono font-bold text-slate-900">{lookupResult.employee_id}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Scrutiny Department:</span>
                    <div className="font-semibold text-slate-900">{lookupResult.department || 'Central Scrutiny Cell'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Designation:</span>
                    <div className="font-semibold text-slate-900">{lookupResult.designation || 'Senior Scrutiny Officer'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Authority Organization:</span>
                    <div className="font-semibold text-slate-900">{lookupResult.organization || 'Central Scrutiny Authority'}</div>
                  </div>
                </div>

                {/* Status Explanation Banner */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                  <p>{lookupResult.message}</p>
                  {lookupResult.approval_status === 'REJECTED' && lookupResult.rejection_reason && (
                    <p className="mt-1 font-mono text-[11px] text-rose-800">
                      <strong>Rejection Reason:</strong> {lookupResult.rejection_reason}
                    </p>
                  )}
                </div>

                {/* Actions depending on status */}
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  {lookupResult.approval_status === 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => navigate('/login/officer')}
                      className="px-4 py-2 bg-[#1D4ED8] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                    >
                      <span>Proceed to Security Officer Login</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {lookupResult.approval_status === 'REJECTED' && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(lookupResult.email || '');
                        setEmployeeId(lookupResult.employee_id || '');
                        setFullName(lookupResult.full_name || '');
                        if (lookupResult.department) setDepartment(lookupResult.department);
                        if (lookupResult.designation) setDesignation(lookupResult.designation);
                        if (lookupResult.organization) setOrganization(lookupResult.organization);
                        setIsResubmissionMode(true);
                        setActiveTab('form');
                      }}
                      className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Prepare Revised Request</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTab('form')}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition"
                  >
                    Back to Request Form
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-[#E2E8F0] text-center">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="text-xs font-bold text-[#1D4ED8] hover:underline"
              >
                Need to submit a new officer request? Click here
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
