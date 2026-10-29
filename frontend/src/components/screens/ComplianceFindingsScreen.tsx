import React, { useState } from 'react';
import { ArrowRight, Bookmark, ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, FileText, HelpCircle, Bot, Scale } from 'lucide-react';
import type { ApplicationDetail, ComplianceFinding, Role, Language, ValidationStatusType } from '../../types';
import { StateView } from '../common/StateView';

interface ComplianceFindingsScreenProps {
  application: ApplicationDetail | null;
  role?: Role;
  language?: Language;
  onRefresh?: () => void;
  onOverride?: (findingId: string, status: string, justification: string) => void;
  onNavigateToRemediation?: () => void;
  onAskChatbot?: (clause: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  ALL: 'All Modules',
  REQUIRED_DOCS_AND_FIELDS: '1. Required Docs & Fields',
  FIELD_FORMAT: '2. Field Formats',
  DATE_AND_EXPIRY: '3. Dates & Expiry',
  DUPLICATE_DETECTION: '4. Duplicate Checks',
  CROSS_DOCUMENT: '5. Cross-Document',
  IDENTITY_CONSISTENCY: '6. Identity & Names',
  CATEGORY_REQUIREMENTS: '7. Category Norms',
  AUTHENTICITY: 'Forensic Screening',
  COMPLETENESS: 'Completeness',
  REGULATORY: 'Regulatory Standards'
};

export const ComplianceFindingsScreen: React.FC<ComplianceFindingsScreenProps> = ({
  application,
  role = 'REVIEWER',
  onOverride,
  onAskChatbot,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedFinding, setSelectedFinding] = useState<ComplianceFinding | null>(null);
  const [overrideStatus, setOverrideStatus] = useState('WAIVED');
  const [justification, setJustification] = useState('');

  if (!application) {
    return (
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center text-[#64748B] max-w-7xl mx-auto m-6">
        No application selected.
      </div>
    );
  }

  const findings = application.findings || [];

  const filteredFindings = findings.filter((f) => {
    const fStatus = f.finding_status || (f.severity === 'CRITICAL' ? 'FAIL' : 'WARNING');
    if (statusFilter !== 'ALL' && fStatus !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && f.category !== categoryFilter) return false;
    return true;
  });

  const handleConfirmOverride = () => {
    if (!selectedFinding || !onOverride || !justification.trim()) return;
    onOverride(selectedFinding.id, overrideStatus, justification);
    setSelectedFinding(null);
    setJustification('');
  };

  const renderStatusBadge = (status?: ValidationStatusType, severity?: string) => {
    const effective = status || (severity === 'CRITICAL' ? 'FAIL' : 'WARNING');
    switch (effective) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>PASS</span>
          </span>
        );
      case 'FAIL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>FAIL</span>
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>WARNING</span>
          </span>
        );
      case 'NEEDS_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-300">
            <HelpCircle className="w-3 h-3 text-indigo-600" />
            <span>NEEDS REVIEW</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 text-[#111827]">
      {/* 1. Engine Notice Banner */}
      <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-950 shadow-sm">
        <ShieldCheck className="w-5 h-5 text-[#1D4ED8] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-blue-900">Deterministic Statutory Engine (TrustDoc v2.4): </strong>
          Evaluated via 7 modular deterministic rule pipelines. Uncertain OCR extractions (&lt;70% confidence) are automatically isolated into <strong>NEEDS REVIEW</strong> rather than false negative rejections.
        </div>
      </div>

      {/* 2. Top Header and Filters */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[#111827] tracking-tight">Compliance Deficiencies & Rule Audits</h2>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-50 text-[#1D4ED8] rounded-full border border-blue-200">
                {findings.length} Evaluation{findings.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Deterministic statutory verification findings linked to verbatim evidence and prescribed remediations.
            </p>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 bg-[#F4F7FB] p-1 rounded-xl border border-[#E2E8F0] text-xs font-semibold self-start sm:self-auto overflow-x-auto">
            {['ALL', 'FAIL', 'WARNING', 'NEEDS_REVIEW', 'PASS'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap text-xs ${
                  statusFilter === st
                    ? 'bg-white text-[#1D4ED8] shadow-sm font-bold border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Category Horizontal Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-3 border-t border-[#E2E8F0] text-xs">
          {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
            <button
              key={catKey}
              onClick={() => setCategoryFilter(catKey)}
              className={`px-3 py-1 rounded-lg transition whitespace-nowrap text-[11px] font-semibold ${
                categoryFilter === catKey
                  ? 'bg-[#1D4ED8] text-white shadow-sm'
                  : 'bg-[#F4F7FB] hover:bg-slate-200 text-[#64748B] border border-[#E2E8F0]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Findings List or Empty View */}
      {filteredFindings.length === 0 ? (
        <StateView
          state="empty"
          title="No Matching Audit Findings"
          description={
            findings.length === 0
              ? 'Application satisfies all deterministic statutory criteria and shows zero compliance deficiencies.'
              : 'No evaluations match the active filter criteria.'
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredFindings.map((f) => {
            const isCrit = f.severity === 'CRITICAL';
            const isWarn = f.severity === 'WARNING';

            return (
              <div
                key={f.id}
                className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm hover:border-slate-300 transition space-y-3.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {renderStatusBadge(f.finding_status, f.severity)}

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isCrit
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : isWarn
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-50 text-[#64748B] border-slate-200'
                      }`}
                    >
                      {f.severity}
                    </span>

                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#F4F7FB] text-[#64748B] border border-[#E2E8F0]">
                      {CATEGORY_LABELS[f.category] || f.category.replace(/_/g, ' ')}
                    </span>

                    <span className="text-xs font-mono font-bold text-[#1D4ED8] bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200 flex items-center gap-1">
                      <Bookmark className="w-3 h-3 text-[#1D4ED8]" />
                      {f.rule_code}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {onAskChatbot && (
                      <button
                        onClick={() => onAskChatbot(f.rule_code)}
                        className="px-3 py-1.5 text-xs font-semibold text-[#111827] hover:text-[#1D4ED8] bg-[#F4F7FB] hover:bg-blue-50 rounded-xl border border-[#E2E8F0] transition flex items-center gap-1"
                      >
                        <Bot className="w-3.5 h-3.5 text-[#1D4ED8]" />
                        <span>Ask AI Advisor</span>
                      </button>
                    )}
                    {role === 'REVIEWER' && (
                      <button
                        onClick={() => setSelectedFinding(f)}
                        className="px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] hover:text-white bg-blue-50 hover:bg-[#1D4ED8] rounded-xl border border-blue-200 hover:border-transparent transition flex items-center gap-1"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>Reviewer Override</span>
                      </button>
                    )}
                  </div>
                </div>

                <h4 className="text-sm font-bold text-[#111827]">{f.title}</h4>
                <p className="text-xs text-[#64748B] leading-relaxed">{f.description}</p>

                {/* Evidence Quote */}
                {f.evidence_quote && (
                  <div className="p-3.5 bg-[#F4F7FB] rounded-xl border-l-4 border-[#1D4ED8] text-xs text-[#111827] font-mono border border-[#E2E8F0]">
                    <strong className="text-[#111827] block mb-1 font-bold">Extracted Deterministic Evidence:</strong>
                    {f.evidence_quote}
                  </div>
                )}

                {/* Provenance Source Reference */}
                {f.source_field_ref && (
                  <div className="flex items-center gap-2 text-[11px] text-[#64748B] font-mono bg-[#F4F7FB] p-2.5 rounded-xl border border-[#E2E8F0]">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Provenance: {f.source_field_ref.doc_type || 'Document'}
                      {f.source_field_ref.field_key ? ` • Field: ${f.source_field_ref.field_key}` : ''}
                      {f.source_field_ref.page_number ? ` • Page ${f.source_field_ref.page_number}` : ''}
                    </span>
                  </div>
                )}

                {/* Actionable Remediation Guidance */}
                {f.suggested_remediation && (
                  <div className="flex items-start text-xs text-emerald-950 bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200">
                    <ArrowRight className="w-4 h-4 mr-2 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-emerald-950 font-bold">Actionable Remediation Guidance:</strong>
                      <span className="mt-0.5 block leading-relaxed">{f.suggested_remediation}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reviewer Override Modal */}
      {selectedFinding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-[#E2E8F0] space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#111827]">Reviewer Scrutiny Override</h3>
              <p className="text-xs text-[#64748B] mt-1">
                Applying a human-in-the-loop override to rule <strong>{selectedFinding.rule_code}</strong>.
                All overrides are immutably logged for statutory audit.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#111827] block mb-1">Override Action</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full text-xs p-2.5 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] bg-[#F4F7FB]"
                >
                  <option value="WAIVED">Waive Defect (Relaxation Justified)</option>
                  <option value="RESOLVED">Mark Resolved (Offline Verification Provided)</option>
                  <option value="REJECTED">Uphold Rejection (Critical Defect)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#111827] block mb-1">
                  Mandatory Reviewer Justification
                </label>
                <textarea
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="State the legal justification for overriding this deterministic finding..."
                  className="w-full text-xs p-2.5 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] bg-[#F4F7FB]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setSelectedFinding(null)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOverride}
                disabled={!justification.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1D4ED8] hover:bg-blue-600 disabled:bg-blue-300 rounded-xl transition shadow-md shadow-blue-900/30"
              >
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
