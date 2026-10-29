import React, { useState } from 'react';
import type { ApplicationDetail, Role, ScreenId } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { DocumentViewer } from '../common/DocumentViewer';
import { getPDFReportUrl, runValidation } from '../../services/api';
import {
  FileText,
  Download,
  Play,
  Bot,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  Eye,
  RefreshCw,
  Hash,
  Scale,
  Building,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';

interface ApplicationDetailScreenProps {
  application: ApplicationDetail | null;
  userRole: Role;
  onNavigateToScreen: (screen: ScreenId) => void;
  onRefresh: () => void;
}

export const ApplicationDetailScreen: React.FC<ApplicationDetailScreenProps> = ({
  application,
  userRole,
  onNavigateToScreen,
  onRefresh,
}) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  if (!application) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center text-[#64748B] bg-white border border-[#E2E8F0] rounded-2xl my-6 shadow-sm">
        <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <h3 className="text-base font-bold text-[#111827]">No Application Selected</h3>
        <p className="text-xs text-[#64748B] mt-1">
          Select an application from the applications registry or overview dashboard.
        </p>
      </div>
    );
  }

  const isDemo = application.application_number.startsWith('APP-2026-CASE-');
  const summary = application.summary;
  const documents = application.documents || [];
  const findings = application.findings || [];
  const criticalFindings = findings.filter((f) => f.severity === 'CRITICAL');
  const warningFindings = findings.filter((f) => f.severity === 'WARNING');

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleRunValidationClick = async () => {
    setIsValidating(true);
    try {
      await runValidation(application.id);
      onRefresh();
    } catch (err) {
      console.error('Validation error:', err);
      alert('Failed to execute automated validation pipeline.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 text-[#111827]">
      {/* Header Banner & Metadata Card */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xl font-black text-[#111827]">
                {application.application_number}
              </span>
              <StatusBadge status={application.status} size="md" />
              {isDemo ? (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wide">
                  Standard Benchmark Case
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1D4ED8] border border-blue-200 uppercase tracking-wide">
                  Live Institutional Filing
                </span>
              )}
            </div>

            <h2 className="text-base font-extrabold text-[#111827] flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              <span>{application.institution_name}</span>
            </h2>
            <p className="text-xs text-[#64748B]">
              Program: <strong className="text-[#111827]">{application.program_name}</strong> • Type: <strong className="text-[#111827]">{application.institution_type}</strong> • Registered: <strong className="text-[#111827]">{new Date(application.created_at).toLocaleDateString()}</strong>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunValidationClick}
              disabled={isValidating}
              className="px-4 py-2 bg-[#1D4ED8] hover:bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-900/30 transition flex items-center gap-1.5 disabled:bg-slate-300"
            >
              {isValidating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Auditing Dossier...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Compliance Audit</span>
                </>
              )}
            </button>

            <a
              href={getPDFReportUrl(application.id)}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-[#0B1220] hover:bg-[#111C30] text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Statutory PDF Report</span>
            </a>

            <button
              onClick={() => onNavigateToScreen('chatbot')}
              className="px-4 py-2 bg-[#F4F7FB] hover:bg-slate-200 text-[#111827] text-xs font-semibold rounded-xl border border-[#E2E8F0] transition flex items-center gap-1.5"
            >
              <Bot className="w-3.5 h-3.5 text-[#1D4ED8]" />
              <span>Ask AI Advisor</span>
            </button>

            {userRole === 'REVIEWER' && (
              <button
                onClick={() => onNavigateToScreen('reviewer_decision')}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Reviewer Decision</span>
              </button>
            )}
          </div>
        </div>

        {/* Investigation Workflow Tabs Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mr-2">
            Scrutiny Modules:
          </span>
          <button
            onClick={() => onNavigateToScreen('document_split')}
            className="px-3 py-1.5 bg-[#F4F7FB] hover:bg-slate-100 text-xs font-semibold text-[#111827] rounded-xl border border-[#E2E8F0] transition flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Document & Fields</span>
          </button>
          <button
            onClick={() => onNavigateToScreen('authenticity_dossier')}
            className="px-3 py-1.5 bg-[#F4F7FB] hover:bg-slate-100 text-xs font-semibold text-[#111827] rounded-xl border border-[#E2E8F0] transition flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Forensics Dossier</span>
          </button>
          <button
            onClick={() => onNavigateToScreen('compliance_findings')}
            className="px-3 py-1.5 bg-[#F4F7FB] hover:bg-slate-100 text-xs font-semibold text-[#111827] rounded-xl border border-[#E2E8F0] transition flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Compliance Findings ({findings.length})</span>
          </button>
          <button
            onClick={() => onNavigateToScreen('risk_summary')}
            className="px-3 py-1.5 bg-[#F4F7FB] hover:bg-slate-100 text-xs font-semibold text-[#111827] rounded-xl border border-[#E2E8F0] transition flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Risk Scorecard</span>
          </button>
        </div>

        {/* Tripartite Scorecard Strip */}
        {summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-[#F4F7FB] p-4 rounded-xl border border-[#E2E8F0] text-center">
              <span className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider">Document Authenticity</span>
              <div className="text-2xl font-extrabold font-mono text-[#111827] mt-1">
                {summary.authenticity_score}%
              </div>
            </div>

            <div className="bg-[#F4F7FB] p-4 rounded-xl border border-[#E2E8F0] text-center">
              <span className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider">Application Completeness</span>
              <div className="text-2xl font-extrabold font-mono text-[#111827] mt-1">
                {summary.completeness_score}%
              </div>
            </div>

            <div className="bg-[#F4F7FB] p-4 rounded-xl border border-[#E2E8F0] text-center">
              <span className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider">Regulatory Compliance</span>
              <div className="text-2xl font-extrabold font-mono text-[#111827] mt-1">
                {summary.compliance_score}%
              </div>
            </div>

            <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-200 text-center">
              <span className="text-[11px] text-[#1D4ED8] font-bold uppercase tracking-wider">Composite Triage Rating</span>
              <div className="text-2xl font-extrabold font-mono text-[#1D4ED8] mt-1">
                {summary.composite_score}%
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Automated assessment summary pending. Click <strong>Run Compliance Audit</strong> above to evaluate.</span>
          </div>
        )}
      </div>

      {/* Main Document List Section */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/80">
          <div>
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#1D4ED8]" />
              <span>Mandatory Statutory Document Inventory</span>
              <span className="text-xs bg-slate-200 text-[#111827] px-2.5 py-0.5 rounded-full font-mono font-bold">
                {documents.length} Files Ingested
              </span>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Inspected via PyMuPDF OCR, cryptographic SHA-256 validation, and OpenCV Error Level Analysis.
            </p>
          </div>

          <button
            onClick={() => onNavigateToScreen('document_split')}
            className="text-xs font-semibold text-[#1D4ED8] hover:text-blue-800 flex items-center gap-1 self-start sm:self-auto transition"
          >
            <span>Open Split-Screen OCR Workbench</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center text-[#64748B] text-xs">
            No documents uploaded for this application yet.
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {documents.map((doc) => {
              const forensics = doc.forensics;
              const isHighRisk = forensics?.risk_level === 'HIGH';
              const isMedRisk = forensics?.risk_level === 'MEDIUM';

              return (
                <div key={doc.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileText className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                        <span className="text-xs font-bold text-[#111827]">
                          {doc.document_type.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] font-mono text-[#64748B] bg-[#F4F7FB] px-2 py-0.5 rounded-md border border-[#E2E8F0]">
                          {doc.file_name}
                        </span>
                        <span className="text-[10px] text-[#64748B] font-mono">
                          ({(doc.file_size_bytes / 1024).toFixed(1)} KB)
                        </span>
                      </div>

                      {/* Forensics & Hash Details */}
                      <div className="flex items-center gap-3 text-[11px] text-[#64748B] font-mono pt-1 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3 text-slate-400" />
                          <span>SHA-256: {doc.sha256_hash.substring(0, 16)}...</span>
                          <button
                            onClick={() => handleCopyHash(doc.sha256_hash)}
                            title="Copy full cryptographic SHA-256 hash"
                            className="text-slate-400 hover:text-slate-700 ml-0.5"
                          >
                            {copiedHash === doc.sha256_hash ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {forensics && (
                          <span
                            className={`px-2 py-0.5 rounded-md font-sans font-bold text-[10px] ${
                              isHighRisk
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : isMedRisk
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            Forensics: {forensics.risk_level} (ELA Noise: {forensics.ela_anomaly_score.toFixed(1)})
                          </span>
                        )}

                        <span className="text-[#64748B]">
                          OCR Extraction: <strong className="text-[#111827]">{doc.extraction_status}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Document Preview & Action */}
                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <button
                        onClick={() => setPreviewDocId(previewDocId === doc.id ? null : doc.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-[#111827] hover:text-[#1D4ED8] bg-white hover:bg-blue-50 border border-[#E2E8F0] rounded-xl transition flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>{previewDocId === doc.id ? 'Hide Preview' : 'Preview'}</span>
                      </button>

                      <button
                        onClick={() => onNavigateToScreen('authenticity_dossier')}
                        className="px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] hover:text-white bg-blue-50 hover:bg-[#1D4ED8] rounded-xl transition flex items-center gap-1 border border-blue-200 hover:border-transparent"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Forensics Dossier</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Document Preview Drawer */}
                  {previewDocId === doc.id && (
                    <div className="mt-3">
                      <DocumentViewer
                        documentId={doc.id}
                        fileName={doc.file_name}
                        mimeType={doc.mime_type}
                        heightClass="h-96"
                        onClose={() => setPreviewDocId(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Findings & Deficiencies Panel */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
          <div>
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Inspection Findings & Compliance Remarks</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              {criticalFindings.length} Critical Issues • {warningFindings.length} Warnings Detected
            </p>
          </div>

          <button
            onClick={() => onNavigateToScreen('compliance_findings')}
            className="text-xs font-semibold text-[#1D4ED8] hover:text-blue-800 flex items-center gap-1 transition"
          >
            <span>View All Detailed Findings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {findings.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#64748B] bg-[#F4F7FB] rounded-xl border border-[#E2E8F0]">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1.5" />
            <span className="font-bold text-emerald-800">Clean Dossier:</span> Zero compliance discrepancies or tampering anomalies detected.
          </div>
        ) : (
          <div className="space-y-2.5">
            {findings.slice(0, 3).map((f) => (
              <div
                key={f.id}
                className="p-3.5 rounded-xl border border-[#E2E8F0] bg-[#F4F7FB] text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        f.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {f.severity}
                    </span>
                    <span className="font-mono font-bold text-[#1D4ED8]">{f.rule_code}</span>
                    <strong className="text-[#111827]">{f.title}</strong>
                  </div>
                </div>
                <p className="text-[#64748B] leading-relaxed">{f.description}</p>
                {f.suggested_remediation && (
                  <p className="text-[11px] text-[#1D4ED8] bg-blue-50/60 p-2 rounded-lg border border-blue-100">
                    <span className="font-bold">Recommended Correction:</span>{' '}
                    {f.suggested_remediation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
