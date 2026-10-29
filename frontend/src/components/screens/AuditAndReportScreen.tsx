import React, { useState, useEffect } from 'react';
import type { ApplicationDetail, AuditLog, Role } from '../../types';
import {
  fetchAuditLogs,
  getPDFReportUrl,
  fetchReportPDFBlob,
  downloadReportPDF,
  openReportInNewTab,
  unmaskPII
} from '../../services/api';
import {
  History,
  ShieldCheck,
  FileText,
  Download,
  Lock,
  Unlock,
  RefreshCw,
  ExternalLink,
  UserCheck,
  FileCheck
} from 'lucide-react';

interface AuditAndReportScreenProps {
  application: ApplicationDetail | null;
  userRole: Role;
  initialTab?: 'audit' | 'privacy' | 'report';
  onRefreshApplication: () => void;
}

export const AuditAndReportScreen: React.FC<AuditAndReportScreenProps> = ({
  application,
  userRole,
  initialTab = 'audit',
  onRefreshApplication,
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'privacy' | 'report'>(initialTab);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // PII Unmasking state
  const [unmaskModalOpen, setUnmaskModalOpen] = useState(false);
  const [unmaskReason, setUnmaskReason] = useState('');
  const [unmaskingLoading, setUnmaskingLoading] = useState(false);
  const [isPIIUnmasked, setIsPIIUnmasked] = useState(false);

  // Authenticated Report Blob state
  const [reportBlobUrl, setReportBlobUrl] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    if (activeTab === 'report' && application?.id) {
      setLoadingReport(true);
      fetchReportPDFBlob(application.id, 'inline')
        .then(({ url }) => {
          if (active) setReportBlobUrl(url);
        })
        .catch((err) => {
          console.error('Failed to load authenticated report blob:', err);
        })
        .finally(() => {
          if (active) setLoadingReport(false);
        });
    }
    return () => {
      active = false;
      if (reportBlobUrl) {
        URL.revokeObjectURL(reportBlobUrl);
      }
    };
  }, [activeTab, application?.id]);

  useEffect(() => {
    if (application?.id) {
      loadLogs();
    }
  }, [application?.id]);

  const loadLogs = async () => {
    if (!application?.id) return;
    setLoadingLogs(true);
    try {
      const logs = await fetchAuditLogs(application.id);
      setAuditLogs(logs || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleUnmaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!application?.id || !unmaskReason.trim()) return;
    setUnmaskingLoading(true);
    try {
      await unmaskPII(application.id, unmaskReason);
      setIsPIIUnmasked(true);
      setUnmaskModalOpen(false);
      setUnmaskReason('');
      loadLogs();
      onRefreshApplication();
    } catch (err) {
      console.error('Failed to unmask PII:', err);
      alert('Failed to authorize unmasking.');
    } finally {
      setUnmaskingLoading(false);
    }
  };

  if (!application) {
    return (
      <div className="max-w-7xl mx-auto p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-xl my-6">
        <FileCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <h3 className="text-base font-bold text-slate-700">No Application Selected</h3>
        <p className="text-xs text-slate-500 mt-1">Please select an application from the top bar or overview dashboard.</p>
      </div>
    );
  }

  const pdfUrl = getPDFReportUrl(application.id);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header & Meta */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-900 text-blue-200 flex items-center justify-center font-bold">
              <History className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                Audit Trail, Privacy & Report Preview
              </h1>
              <p className="text-xs md:text-sm text-slate-500">
                Application: <span className="font-mono font-medium text-slate-800">{application.application_number}</span> | Program: <span className="font-medium text-slate-800">{application.program_name}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'privacy'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Privacy & PII</span>
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'report'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF Dossier</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Immutable Audit Ledger */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Immutable Verification & Scrutiny Log</span>
                <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
                  {auditLogs.length} events
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every forensic extraction, scoring event, PII unmasking, and reviewer decision is logged with actor metadata.
              </p>
            </div>
            <button
              onClick={loadLogs}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

          {loadingLogs ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-xs">Loading ledger entries...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg text-xs">
              No audit records generated for this application yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {auditLogs.map((log) => {
                const isDecision = log.action === 'FINAL_DECISION_RECORDED';
                const isOverride = log.action === 'REVIEWER_OVERRIDE';
                const isUnmask = log.action === 'PII_UNMASK';

                return (
                  <div key={log.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            isDecision
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : isOverride
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : isUnmask
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {log.action}
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          IP: {log.ip_address}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    {/* Diff Payload / Payload Viewer */}
                    <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs font-mono text-slate-700 overflow-x-auto">
                      {typeof log.diff_payload === 'object' ? (
                        <div className="space-y-1">
                          {Object.entries(log.diff_payload).map(([k, v]) => (
                            <div key={k} className="flex gap-2 text-[11px]">
                              <span className="text-slate-500 font-semibold">{k}:</span>
                              <span className="text-slate-800 font-medium">
                                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span>{String(log.diff_payload)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Privacy & PII Governance */}
      {activeTab === 'privacy' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Privacy-First PII Protection Policy</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adheres to DPDP Act norms. Sensitive identifiers (PAN, Aadhaar, Mobile, Bank Details) are masked by default across all screens.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    isPIIUnmasked
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {isPIIUnmasked ? 'PII Unmasked for Session' : 'PII Strict Masking Active'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Masked Identifier Fields</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1">
                  <li>• Principal Aadhaar / National ID: <span className="font-mono text-slate-500">XXXX-XXXX-8921</span></li>
                  <li>• Society PAN: <span className="font-mono text-slate-500">AAACT****K</span></li>
                  <li>• Institutional Contact Phone: <span className="font-mono text-slate-500">+91 98765 *****</span></li>
                  <li>• Encumbrance Certificate Owner Details</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Scrutiny Access Protocol</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Reviewers with verified credentials can request an unmasking token. Access requires a written statutory justification that is permanently preserved in the audit log.
                </p>
              </div>
            </div>

            {/* Unmask Trigger Button */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Current Session Elevation: <span className="text-blue-700">{userRole}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Authorized for statutory audit inspection.
                </p>
              </div>

              {isPIIUnmasked ? (
                <button
                  onClick={() => setIsPIIUnmasked(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Re-engage Masking</span>
                </button>
              ) : (
                <button
                  onClick={() => setUnmaskModalOpen(true)}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Request Authorized PII Unmask</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Embedded ReportLab PDF Previewer */}
      {activeTab === 'report' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" />
                <span>Statutory Compliance Inspection Dossier (PDF)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-page forensic report generated using ReportLab with SHA-256 signatures, ELA maps, and rule references.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadReportPDF(application.id)}
                className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF Report</span>
              </button>
              <button
                onClick={() => openReportInNewTab(application.id)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Tab</span>
              </button>
            </div>
          </div>

          {/* Embedded PDF iframe */}
          <div className="w-full h-[700px] border border-slate-300 rounded-lg overflow-hidden bg-slate-100 shadow-inner relative">
            {loadingReport && !reportBlobUrl ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 backdrop-blur-2xs z-10 text-xs text-slate-500 font-semibold">
                Authenticating &amp; rendering dossier...
              </div>
            ) : null}
            <iframe
              src={reportBlobUrl || pdfUrl}
              title="Statutory PDF Report Preview"
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* PII Request Modal */}
      {unmaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-900 mb-2">
              <Lock className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-bold">Authorized PII Unmask Request</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Pursuant to institutional scrutiny policy, unmasking sensitive personal identifiers requires an explicit, audited statement of purpose.
            </p>

            <form onSubmit={handleUnmaskSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Statutory Purpose / Scrutiny Justification:
                </label>
                <textarea
                  rows={3}
                  required
                  value={unmaskReason}
                  onChange={(e) => setUnmaskReason(e.target.value)}
                  placeholder="e.g. Scrutiny Committee physical spot verification of Society PAN and registered title deed bounds..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setUnmaskModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!unmaskReason.trim() || unmaskingLoading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:bg-slate-300 shadow-sm"
                >
                  {unmaskingLoading ? 'Logging & Authorizing...' : 'Authorize & Unmask'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
