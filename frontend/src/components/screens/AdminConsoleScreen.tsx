import React, { useState, useEffect } from 'react';
import type {
  AdminUserItem,
  DataRetentionPolicyItem,
  MaskingConfigItem,
  AuditLog,
  Language,
  Role,
} from '../../types';
import {
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  fetchAdminRules,
  createRuleVersion,
  fetchRetentionPolicies,
  updateRetentionPolicy,
  executeRetentionSweep,
  fetchMaskingConfig,
  testMaskingText,
  fetchGlobalAuditLogs,
  fetchOfficerRequests,
  recordOfficerRequestDecision,
} from '../../services/api';
import {
  Users,
  BookOpen,
  Database,
  EyeOff,
  History,
  ShieldCheck,
  ShieldAlert,
  Plus,
  RefreshCw,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sliders,
  Check,
  X,
  Clock,
  UserCheck,
  UserX,
  BadgeAlert
} from 'lucide-react';

interface AdminConsoleScreenProps {
  language: Language;
  currentRole: Role;
}

export const AdminConsoleScreen: React.FC<AdminConsoleScreenProps> = ({
  language,
  currentRole,
}) => {
  void language;
  const [activeTab, setActiveTab] = useState<'rules' | 'users' | 'officer_requests' | 'audit' | 'retention' | 'masking'>('rules');
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Tab 1: Rules & Sources state
  const [rules, setRules] = useState<any[]>([]);
  const [selectedRule, setSelectedRule] = useState<any | null>(null);
  const [newVersionTag, setNewVersionTag] = useState('v2026.2-amended');
  const [newVersionParams, setNewVersionParams] = useState('{\n  "min_land_acres": 3.0,\n  "zone": "metro"\n}');

  // Tab 2: Users state
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userSearch, setUserSearch] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('REVIEWER');
  const [newUserInst, setNewUserInst] = useState('');

  // Tab: Officer Requests state
  const [officerRequests, setOfficerRequests] = useState<any[]>([]);
  const [officerRequestFilter, setOfficerRequestFilter] = useState<string>('PENDING_APPROVAL');
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [decisionLoading, setDecisionLoading] = useState<boolean>(false);

  // Tab 3: Global Audit state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditFilterAction, setAuditFilterAction] = useState<string>('ALL');

  // Tab 4: Retention state
  const [retentionPolicies, setRetentionPolicies] = useState<DataRetentionPolicyItem[]>([]);
  const [sweepResult, setSweepResult] = useState<any | null>(null);
  const [sweepRunning, setSweepRunning] = useState(false);

  // Tab 5: Masking state
  const [maskingConfigs, setMaskingConfigs] = useState<MaskingConfigItem[]>([]);
  const [testSampleText, setTestSampleText] = useState('Principal Aadhaar: 9876 5432 1098, PAN: ABCDE1234F, Contact: +91 9876543210, Email: principal@apex.edu');
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    loadTabData();
  }, [activeTab, officerRequestFilter]);

  const showNotification = (msg: string, isErr: boolean = false) => {
    if (isErr) {
      setActionError(msg);
      setActionSuccess(null);
    } else {
      setActionSuccess(msg);
      setActionError(null);
    }
    setTimeout(() => {
      setActionSuccess(null);
      setActionError(null);
    }, 4000);
  };

  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'rules') {
        const data = await fetchAdminRules();
        setRules(data || []);
      } else if (activeTab === 'users') {
        const data = await fetchAdminUsers(userRoleFilter === 'ALL' ? undefined : userRoleFilter, userSearch || undefined);
        setUsers(data || []);
      } else if (activeTab === 'officer_requests') {
        const data = await fetchOfficerRequests(officerRequestFilter === 'ALL' ? undefined : officerRequestFilter);
        setOfficerRequests(data || []);
      } else if (activeTab === 'audit') {
        const data = await fetchGlobalAuditLogs(auditFilterAction === 'ALL' ? undefined : auditFilterAction);
        setAuditLogs(data || []);
      } else if (activeTab === 'retention') {
        const data = await fetchRetentionPolicies();
        setRetentionPolicies(data || []);
      } else if (activeTab === 'masking') {
        const data = await fetchMaskingConfig();
        setMaskingConfigs(data || []);
      }
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      showNotification('Failed to load administrative data.', true);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveOfficer = async (userId: string) => {
    setDecisionLoading(true);
    try {
      await recordOfficerRequestDecision(userId, { action: 'APPROVE' });
      showNotification('Officer account approved successfully! Officer account is now activated.');
      loadTabData();
    } catch (err: any) {
      console.error('Approval failed:', err);
      showNotification(err.response?.data?.detail || 'Failed to approve officer request.', true);
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleRejectOfficer = async () => {
    if (!rejectingUserId) return;
    setDecisionLoading(true);
    try {
      await recordOfficerRequestDecision(rejectingUserId, {
        action: 'REJECT',
        rejection_reason: rejectionReason.trim() || undefined,
      });
      showNotification('Officer account request rejected.');
      setRejectingUserId(null);
      setRejectionReason('');
      loadTabData();
    } catch (err: any) {
      console.error('Rejection failed:', err);
      showNotification(err.response?.data?.detail || 'Failed to record officer rejection.', true);
    } finally {
      setDecisionLoading(false);
    }
  };

  // Rule version creation
  const handleDeployRuleVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRule) return;
    try {
      const parsed = JSON.parse(newVersionParams);
      await createRuleVersion(selectedRule.id, newVersionTag, parsed);
      showNotification(`Successfully deployed rule version ${newVersionTag} for ${selectedRule.rule_code}`);
      setSelectedRule(null);
      loadTabData();
    } catch (err: any) {
      showNotification('Invalid JSON parameters or server error.', true);
    }
  };

  // User management
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAdminUser({
        email: newUserEmail,
        password: newUserPass,
        full_name: newUserName,
        role: newUserRole,
        institution_name: newUserInst,
      });
      showNotification(`User ${newUserEmail} created successfully.`);
      setShowAddUserModal(false);
      setNewUserEmail('');
      setNewUserPass('');
      setNewUserName('');
      loadTabData();
    } catch (err: any) {
      showNotification(err?.response?.data?.detail || 'Failed to create user.', true);
    }
  };

  const handleToggleUserActive = async (user: AdminUserItem) => {
    try {
      await updateAdminUser(user.id, { is_active: !user.is_active });
      showNotification(`User ${user.email} status updated.`);
      loadTabData();
    } catch (err: any) {
      showNotification(err?.response?.data?.detail || 'Failed to update user status.', true);
    }
  };

  const handleToggleUserMFA = async (user: AdminUserItem) => {
    try {
      await updateAdminUser(user.id, { is_mfa_enabled: !user.is_mfa_enabled });
      showNotification(`MFA status toggled for ${user.email}.`);
      loadTabData();
    } catch (err: any) {
      showNotification('Failed to toggle MFA status.', true);
    }
  };

  // Retention
  const handleToggleLegalHold = async (policy: DataRetentionPolicyItem) => {
    try {
      await updateRetentionPolicy(policy.id, { is_legal_hold: !policy.is_legal_hold });
      showNotification(`Legal hold for ${policy.title} is now ${!policy.is_legal_hold ? 'ACTIVE' : 'INACTIVE'}.`);
      loadTabData();
    } catch (err) {
      showNotification('Failed to update legal hold.', true);
    }
  };

  const handleRunRetentionSweep = async () => {
    const confirmSweep = window.confirm(
      'Are you sure you want to execute a statutory retention sweep? Expired abandoned drafts will be purged and an immutable audit log entry will be created.'
    );
    if (!confirmSweep) return;
    setSweepRunning(true);
    try {
      const res = await executeRetentionSweep();
      setSweepResult(res);
      showNotification('Retention and deletion sweep executed successfully.');
      loadTabData();
    } catch (err) {
      showNotification('Failed to execute retention sweep.', true);
    } finally {
      setSweepRunning(false);
    }
  };

  // Masking
  const handleTestMasking = async () => {
    if (!testSampleText.trim()) return;
    setTestLoading(true);
    try {
      const res = await testMaskingText(testSampleText);
      setTestResult(res);
    } catch (err) {
      showNotification('Failed to test masking.', true);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 to-indigo-900 text-white flex items-center justify-center font-bold shadow-md">
            <Sliders className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">Compliance Administration Console</h1>
              <span className="text-[11px] bg-purple-100 text-purple-800 font-semibold px-2.5 py-0.5 rounded-full border border-purple-200">
                Governance Mode
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Statutory source catalog, rule versioning, RBAC user lifecycle, retention controls & PII security
            </p>
          </div>
        </div>

        <button
          onClick={loadTabData}
          disabled={loading}
          className="self-start md:self-auto px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-lg flex items-center gap-2 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-medium">{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-lg flex items-center gap-2 shadow-2xs animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span className="font-medium">{actionError}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'rules'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Regulatory Rules & Versions</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User & Role Governance</span>
        </button>

        <button
          onClick={() => setActiveTab('officer_requests')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'officer_requests'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Officer Requests & Vetting</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>System Audit Trail</span>
        </button>

        <button
          onClick={() => setActiveTab('retention')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'retention'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Data Retention & Deletion</span>
        </button>

        <button
          onClick={() => setActiveTab('masking')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === 'masking'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <EyeOff className="w-4 h-4" />
          <span>Sensitive-Data Masking</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: REGULATORY SOURCES & RULE VERSIONS                       */}
      {/* ============================================================== */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Configured Regulatory Rules & Active Parameter Sets</h3>
                <p className="text-xs text-slate-500">Statutory rules evaluated by the deterministic engine and RAG pipeline</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Rule Code</th>
                    <th className="py-2.5 px-3">Title & Authority</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Active Version</th>
                    <th className="py-2.5 px-3">Parameters Snapshot</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rules.map((rule) => {
                    const activeVer = rule.versions && rule.versions.length > 0 ? rule.versions[rule.versions.length - 1] : null;
                    return (
                      <tr key={rule.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-3 font-mono font-bold text-blue-900">{rule.rule_code}</td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-800">{rule.title}</p>
                          <p className="text-[11px] text-slate-500">{rule.authority}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {rule.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-indigo-700 font-semibold">
                          {activeVer ? activeVer.version_tag : 'v2026.1'}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                          {activeVer ? JSON.stringify(activeVer.parameters_json) : '{}'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedRule(rule)}
                            className="px-2.5 py-1 text-xs rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium transition"
                          >
                            New Version
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal for Deploying New Rule Version */}
          {selectedRule && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Deploy Rule Version: <span className="font-mono text-indigo-700">{selectedRule.rule_code}</span>
                </h3>
                <p className="text-xs text-slate-500 mb-4">{selectedRule.title}</p>

                <form onSubmit={handleDeployRuleVersion} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Version Tag</label>
                    <input
                      type="text"
                      value={newVersionTag}
                      onChange={(e) => setNewVersionTag(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Parameters (JSON)</label>
                    <textarea
                      rows={4}
                      value={newVersionParams}
                      onChange={(e) => setNewVersionParams(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRule(null)}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
                    >
                      Deploy Version
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: USER & ROLE MANAGEMENT (RBAC)                           */}
      {/* ============================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Institutional Users & Access Roles</h3>
                <p className="text-xs text-slate-500">Manage applicant accounts, scrutiny committee officers, and system administrators</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search user or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadTabData()}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 w-44 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <select
                  value={userRoleFilter}
                  onChange={(e) => {
                    setUserRoleFilter(e.target.value);
                    loadTabData();
                  }}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
                >
                  <option value="ALL">All Roles</option>
                  <option value="APPLICANT">Applicants</option>
                  <option value="REVIEWER">Reviewers</option>
                  <option value="AUDITOR">Auditors</option>
                  <option value="ADMIN">Admins</option>
                </select>

                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Enroll User</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Full Name & Email</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Institution / Cell</th>
                    <th className="py-2.5 px-3">MFA Status</th>
                    <th className="py-2.5 px-3">Account Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isSelf = u.role === 'ADMIN' && currentRole === 'ADMIN';
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{u.full_name}</p>
                          <p className="font-mono text-[11px] text-slate-500">{u.email}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-800'
                                : u.role === 'REVIEWER'
                                ? 'bg-blue-100 text-blue-800'
                                : u.role === 'AUDITOR'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700">{u.institution_name || '—'}</td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleToggleUserMFA(u)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              u.is_mfa_enabled
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}
                          >
                            <Lock className="w-3 h-3" />
                            <span>{u.is_mfa_enabled ? 'Enforced' : 'Disabled'}</span>
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                              u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {u.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            <span>{u.is_active ? 'Active' : 'Suspended'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleToggleUserActive(u)}
                            disabled={isSelf && u.is_active}
                            title={isSelf ? 'Cannot deactivate your own admin account' : undefined}
                            className={`px-2 py-1 rounded text-xs font-medium transition ${
                              u.is_active
                                ? 'text-rose-700 hover:bg-rose-50 disabled:opacity-30'
                                : 'text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add User Modal */}
          {showAddUserModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                <h3 className="text-base font-bold text-slate-900 mb-3">Enroll New User</h3>
                <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Initial Password</label>
                    <input
                      type="password"
                      value={newUserPass}
                      onChange={(e) => setNewUserPass(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">System Role</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as Role)}
                      className="w-full border border-slate-300 rounded-lg p-2 font-semibold"
                    >
                      <option value="APPLICANT">APPLICANT (Institution Principal / Rep)</option>
                      <option value="REVIEWER">REVIEWER (Scrutiny Committee Officer)</option>
                      <option value="AUDITOR">AUDITOR (Statutory Oversight / CAG)</option>
                      <option value="ADMIN">ADMIN (System Administrator)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Institution Name (Optional)</label>
                    <input
                      type="text"
                      value={newUserInst}
                      onChange={(e) => setNewUserInst(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddUserModal(false)}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                    >
                      Create User
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB: OFFICER ACCOUNT REQUESTS & VETTING                        */}
      {/* ============================================================== */}
      {activeTab === 'officer_requests' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#1D4ED8]" />
                  <span>Security Officer Credential Vetting Queue</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify government credentials and approve or reject access requests for scrutiny and forensics privileges.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">Filter:</span>
                <select
                  value={officerRequestFilter}
                  onChange={(e) => setOfficerRequestFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg p-1.5 bg-slate-50 text-slate-700 font-medium"
                >
                  <option value="PENDING_APPROVAL">Pending Approval Only</option>
                  <option value="APPROVED">Approved Officers</option>
                  <option value="REJECTED">Rejected Requests</option>
                  <option value="ALL">All Officer Accounts</option>
                </select>
              </div>
            </div>

            {/* Officer Requests Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Officer Name & Identity</th>
                    <th className="py-2.5 px-3">Employee ID</th>
                    <th className="py-2.5 px-3">Department & Designation</th>
                    <th className="py-2.5 px-3">Organization</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Vetting Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {officerRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No officer requests found matching filter &ldquo;{officerRequestFilter}&rdquo;.
                      </td>
                    </tr>
                  ) : (
                    officerRequests.map((req) => {
                      const isPending = req.approval_status === 'PENDING_APPROVAL';
                      const isApproved = req.approval_status === 'APPROVED';
                      const isRejected = req.approval_status === 'REJECTED';

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{req.full_name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{req.email}</div>
                            {req.phone_number && (
                              <div className="text-[10px] text-slate-400">{req.phone_number}</div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {req.employee_id || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-800">{req.designation || 'Scrutiny Officer'}</div>
                            <div className="text-[10px] text-slate-500">{req.department || 'Central Scrutiny Cell'}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 text-xs">
                            {req.institution_name || 'AICTE Statutory Authority'}
                          </td>
                          <td className="py-3 px-3">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Pending Approval</span>
                              </span>
                            )}
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Active / Approved</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <X className="w-3 h-3 text-rose-600" />
                                <span>Rejected</span>
                              </span>
                            )}
                            {req.rejection_reason && (
                              <div className="text-[10px] text-rose-600 mt-1 italic max-w-xs truncate" title={req.rejection_reason}>
                                Reason: {req.rejection_reason}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleApproveOfficer(req.id)}
                                  disabled={decisionLoading}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs flex items-center gap-1 transition disabled:opacity-50"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectingUserId(req.id);
                                    setRejectionReason('');
                                  }}
                                  disabled={decisionLoading}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold shadow-xs flex items-center gap-1 transition disabled:opacity-50"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            ) : isApproved ? (
                              <span className="text-[11px] text-slate-400 font-medium">Privileges Active</span>
                            ) : (
                              <button
                                onClick={() => handleApproveOfficer(req.id)}
                                disabled={decisionLoading}
                                className="px-2 py-0.5 rounded text-[11px] text-emerald-700 hover:underline font-bold"
                              >
                                Re-Approve
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rejection Modal */}
          {rejectingUserId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <BadgeAlert className="w-5 h-5 text-rose-600" />
                    <h3 className="text-sm font-bold text-slate-900">Reject Officer Account Request</h3>
                  </div>
                  <button
                    onClick={() => setRejectingUserId(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Provide an official justification for rejecting this security officer account request. The applicant will see this statutory notice upon attempting to log in.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Statutory Rejection Reason:
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Employee ID not found in vigilance roll or official authority mismatch..."
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRejectingUserId(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectOfficer}
                    disabled={decisionLoading}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
                  >
                    {decisionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: SYSTEM AUDIT TRAIL                                      */}
      {/* ============================================================== */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Global Tamper-Evident Audit Journal</h3>
                <p className="text-xs text-slate-500">Every scrutiny decision, document unmasking, and parameter change is cryptographically chained</p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={auditFilterAction}
                  onChange={(e) => {
                    setAuditFilterAction(e.target.value);
                    loadTabData();
                  }}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
                >
                  <option value="ALL">All Actions</option>
                  <option value="REVIEWER_OVERRIDE">Reviewer Overrides</option>
                  <option value="CORRECTION_REQUESTED">Correction Notices</option>
                  <option value="FINAL_DECISION_RECORDED">Final Determinations</option>
                  <option value="PII_UNMASK">PII Unmasks</option>
                  <option value="RETENTION_SWEEP_EXECUTED">Retention Sweeps</option>
                </select>

                <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  SHA-256 Chained Integrity Verified
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Timestamp (UTC)</th>
                    <th className="py-2.5 px-3">Action Type</th>
                    <th className="py-2.5 px-3">Actor Role</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Details / Diff Summary</th>
                    <th className="py-2.5 px-3">Chained Hash (SHA-256)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 font-mono">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-semibold">
                        {log.actor_role || 'SYSTEM'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">{log.ip_address}</td>
                      <td className="py-3 px-3 max-w-sm truncate text-slate-600 font-mono text-[11px]">
                        {JSON.stringify(log.diff_payload)}
                      </td>
                      <td className="py-3 px-3 font-mono text-[10px] text-blue-700 max-w-[120px] truncate" title={log.event_hash}>
                        {log.event_hash ? `${log.event_hash.substring(0, 16)}...` : 'genesis'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: DATA RETENTION & DELETION CONTROLS                      */}
      {/* ============================================================== */}
      {activeTab === 'retention' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Statutory Data Retention Schedules & Legal Holds</h3>
                <p className="text-xs text-slate-500">Configured schedules pursuant to AICTE Gazette regulations and DPDP Act standards</p>
              </div>

              <button
                onClick={handleRunRetentionSweep}
                disabled={sweepRunning}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{sweepRunning ? 'Running Sweep...' : 'Execute Retention Sweep'}</span>
              </button>
            </div>

            {sweepResult && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <p className="font-bold text-slate-800">Latest Retention Sweep Summary:</p>
                <p className="text-slate-600">
                  Purged Inactive Drafts: <span className="font-bold text-rose-700">{sweepResult.purged_drafts_count}</span> • Retained Institutional Records: <span className="font-bold text-emerald-700">{sweepResult.retained_records_count}</span>
                </p>
                <p className="text-[11px] font-mono text-slate-400">Audit Reference: {sweepResult.audit_event_id}</p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Policy Code & Title</th>
                    <th className="py-2.5 px-3">Statutory Retention Duration</th>
                    <th className="py-2.5 px-3">Auto Purge</th>
                    <th className="py-2.5 px-3">Legal Hold Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {retentionPolicies.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">{p.title}</p>
                        <p className="font-mono text-[10px] text-slate-500">{p.policy_code}</p>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {p.retention_days} days ({Math.round((p.retention_days / 365) * 10) / 10} years)
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${p.auto_purge_enabled ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                          {p.auto_purge_enabled ? 'Auto-Purge On' : 'Manual Review'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${p.is_legal_hold ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>
                          <Lock className="w-3 h-3" />
                          <span>{p.is_legal_hold ? 'LEGAL HOLD ACTIVE' : 'No Hold'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleToggleLegalHold(p)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                            p.is_legal_hold
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          {p.is_legal_hold ? 'Release Hold' : 'Impose Legal Hold'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: SENSITIVE-DATA MASKING CONFIGURATION                     */}
      {/* ============================================================== */}
      {activeTab === 'masking' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Zero-Knowledge PII Identifier Masking Rules</h3>
              <p className="text-xs text-slate-500">Pattern definitions for redacting sensitive Indian identifiers across UI and downloadable dossiers</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Identifier Type</th>
                    <th className="py-2.5 px-3">Label</th>
                    <th className="py-2.5 px-3">Regular Expression Pattern</th>
                    <th className="py-2.5 px-3">Masking Mode</th>
                    <th className="py-2.5 px-3">Unmask Justification</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {maskingConfigs.map((cfg) => (
                    <tr key={cfg.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-indigo-900">{cfg.identifier_type}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{cfg.label}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600 max-w-xs truncate">{cfg.pattern_regex}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 font-mono">
                          {cfg.masking_mode}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {cfg.unmask_requires_justification ? 'Audited Reason Required' : 'None'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Enforced
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Interactive Live Masking Tester Sandbox */}
            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>Interactive Privacy Masking Sandbox</span>
              </h4>
              <p className="text-[11px] text-slate-500">Test how raw input text is scrubbed by the zero-knowledge regex filter</p>

              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={testSampleText}
                  onChange={(e) => setTestSampleText(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 border border-slate-300 rounded-lg bg-white"
                />
                <button
                  onClick={handleTestMasking}
                  disabled={testLoading}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{testLoading ? 'Evaluating...' : 'Evaluate Masking'}</span>
                </button>
              </div>

              {testResult && (
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Masked Output:</span>
                    <span className="font-mono text-emerald-800 font-semibold">{testResult.masked_text}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>Detected & Scrubbed Identifiers:</span>
                    <span className="font-semibold text-indigo-700">
                      {testResult.matched_identifiers.length > 0 ? testResult.matched_identifiers.join(', ') : 'None'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
