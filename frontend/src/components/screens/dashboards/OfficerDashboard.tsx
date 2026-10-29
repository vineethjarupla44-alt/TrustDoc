import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Scale,
  Gavel,
  FileSearch,
  CheckCircle2,
  RefreshCw,
  Layers,
  SplitSquareVertical,
  Building2,
  X
} from 'lucide-react';
import type { ApplicationDetail, Language, ScreenId } from '../../../types';
import { StatusBadge } from '../../common/StatusBadge';
import { fetchRegistrationScrutinyQueue, recordRenewalDecision } from '../../../services/api';

interface OfficerDashboardProps {
  applications: ApplicationDetail[];
  currentApp: ApplicationDetail | null;
  onSelectApplication: (id: string) => void;
  onNavigateToScreen: (screen: ScreenId) => void;
  onRefresh: () => void;
  language?: Language;
}

export const OfficerDashboard: React.FC<OfficerDashboardProps> = ({
  applications = [],
  onSelectApplication,
  onNavigateToScreen,
  onRefresh,
}) => {
  const [activeQueueType, setActiveQueueType] = useState<'APPLICATIONS' | 'RENEWALS'>('APPLICATIONS');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'CRITICAL' | 'MODERATE' | 'ROUTINE'>('ALL');
  const [renewalQueue, setRenewalQueue] = useState<any[]>([]);
  const [renewalLoading, setRenewalLoading] = useState<boolean>(false);

  // Renewal Decision Modal State
  const [selectedRenewal, setSelectedRenewal] = useState<any | null>(null);
  const [decisionModalMode, setDecisionModalMode] = useState<'APPROVE' | 'CORRECTIONS' | 'REJECT' | null>(null);
  const [statutoryNotes, setStatutoryNotes] = useState('');
  const [deficiencyNoticeText, setDeficiencyNoticeText] = useState('');
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);

  const loadRenewalQueue = async () => {
    setRenewalLoading(true);
    try {
      const data = await fetchRegistrationScrutinyQueue();
      setRenewalQueue(data);
    } catch (err) {
      console.error('Error fetching renewal queue:', err);
    } finally {
      setRenewalLoading(false);
    }
  };

  useEffect(() => {
    loadRenewalQueue();
  }, []);

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRenewal || !decisionModalMode) return;
    setDecisionSubmitting(true);
    try {
      await recordRenewalDecision(selectedRenewal.id, {
        decision: decisionModalMode === 'APPROVE' ? 'APPROVED' : decisionModalMode === 'CORRECTIONS' ? 'CORRECTIONS_REQUIRED' : 'REJECTED',
        statutory_notes: statutoryNotes,
        deficiency_notice: decisionModalMode === 'CORRECTIONS' ? deficiencyNoticeText : undefined,
        extension_years: 3
      });
      setDecisionModalMode(null);
      setSelectedRenewal(null);
      setStatutoryNotes('');
      setDeficiencyNoticeText('');
      await loadRenewalQueue();
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to record scrutiny decision.');
    } finally {
      setDecisionSubmitting(false);
    }
  };

  const totalApps = applications.length;
  const criticalApps = applications.filter((a) => a.status === 'FLAGGED' || (a.summary && a.summary.composite_score < 70));
  const moderateApps = applications.filter((a) => a.status === 'DEFICIENT' || a.status === 'SUBMITTED' || (a.summary && a.summary.composite_score >= 70 && a.summary.composite_score < 90));
  const routineApps = applications.filter((a) => a.status === 'APPROVED' || (a.summary && a.summary.composite_score >= 90));

  const filteredApps = applications.filter((app) => {
    if (tierFilter === 'CRITICAL') return criticalApps.some((c) => c.id === app.id);
    if (tierFilter === 'MODERATE') return moderateApps.some((m) => m.id === app.id);
    if (tierFilter === 'ROUTINE') return routineApps.some((r) => r.id === app.id);
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 text-[#111827]">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-br from-[#0B1220] via-[#111C30] to-[#0B1220] text-white rounded-2xl p-6 shadow-xl border border-[#1E293B]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-[#1D4ED8]/30 text-blue-300 rounded-full border border-blue-500/40 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Statutory Scrutiny & Forensics Intelligence
              </span>
              <span className="text-xs text-slate-400 font-mono">ROLE: SENIOR SCRUTINY OFFICER</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white">
              Institutional Forensics & Prioritized Scrutiny Queue
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Examine 7-layer document authenticity evidence, verify cross-document acreage consistency, evaluate statutory handbook clauses, and record legally binding scrutiny determinations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <button
              onClick={onRefresh}
              className="p-2.5 bg-[#16233B] hover:bg-[#1E293B] text-slate-300 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold transition"
              title="Refresh Scrutiny Queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigateToScreen('reviewer_decision')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D4ED8] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-900/40 transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <Gavel className="w-4 h-4" />
              <span>Record Scrutiny Decision</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Scrutiny Queue</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1D4ED8] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-[#111827]">{totalApps}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Active Files in Pipeline</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Critical Priority Flags</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-rose-600">{criticalApps.length}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Tamper Anomalies / Score &lt; 70</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Moderate Deficiencies</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-amber-600">{moderateApps.length}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Missing Docs / Mismatch (70-90)</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Routine Clearance</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-emerald-600">{routineApps.length}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Compliant Candidates (&ge; 90)</span>
          </div>
        </div>
      </div>

      {/* Prioritized Scrutiny Queue Table */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        {/* Scrutiny Queue Type Selector Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveQueueType('APPLICATIONS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                activeQueueType === 'APPLICATIONS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <FileSearch className="w-4 h-4" />
              <span>Academic Applications ({totalApps})</span>
            </button>
            <button
              onClick={() => {
                setActiveQueueType('RENEWALS');
                loadRenewalQueue();
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                activeQueueType === 'RENEWALS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Registration Renewals ({renewalQueue.length})</span>
            </button>
          </div>

          {/* Tier Filter Pills (for applications) */}
          {activeQueueType === 'APPLICATIONS' && (
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setTierFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  tierFilter === 'ALL' ? 'bg-[#0B1220] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All ({totalApps})
              </button>
              <button
                onClick={() => setTierFilter('CRITICAL')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  tierFilter === 'CRITICAL' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                Critical ({criticalApps.length})
              </button>
              <button
                onClick={() => setTierFilter('MODERATE')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  tierFilter === 'MODERATE' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                Moderate ({moderateApps.length})
              </button>
              <button
                onClick={() => setTierFilter('ROUTINE')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  tierFilter === 'ROUTINE' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Routine ({routineApps.length})
              </button>
            </div>
          )}
        </div>

        {activeQueueType === 'RENEWALS' ? (
          <div className="divide-y divide-[#E2E8F0]">
            {renewalLoading ? (
              <div className="p-8 text-center text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                <span className="text-xs">Loading registration renewal submissions...</span>
              </div>
            ) : renewalQueue.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-xs">No registration renewal filings currently in scrutiny queue.</p>
              </div>
            ) : (
              renewalQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 hover:bg-slate-50 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-extrabold text-[#111827]">
                        {item.renewal_reference_number}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {item.application_type === 'RENEWAL' ? 'Renewal Filing' : 'New Registration'}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        item.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : item.status === 'CORRECTIONS_REQUIRED'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-purple-50 text-purple-800 border-purple-300'
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800">
                      {item.institution_details?.institution_name || 'Apex Institute of Technology'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Academic Year: {item.academic_year} • Submitted: {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : 'Recorded'} • Attached Deeds: {item.uploaded_documents?.length || 4} Files
                    </p>

                    {item.deficiency_notice && (
                      <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded border border-rose-200 font-mono mt-1">
                        Active Deficiency: "{item.deficiency_notice}"
                      </p>
                    )}
                  </div>

                  {/* Scrutiny Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedRenewal(item);
                        setDecisionModalMode('APPROVE');
                        setStatutoryNotes(`Approved following inspection of submitted deeds pursuant to AICTE Approval Process Handbook (2026-27 Norms).`);
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition"
                    >
                      Approve (+3 Yrs)
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRenewal(item);
                        setDecisionModalMode('CORRECTIONS');
                        setDeficiencyNoticeText(`Deficiency in Fire NOC: Certificate validity expired prior to commencement of current academic year. Please submit current NOC.`);
                        setStatutoryNotes(`Deficiency notice issued with 15-day rectification window.`);
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition"
                    >
                      Request Corrections
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (

        <div className="divide-y divide-[#E2E8F0]">
          {filteredApps.map((app) => {
            const composite = app.summary?.composite_score ?? 75;
            const isCritical = composite < 70 || app.status === 'FLAGGED';
            const isModerate = !isCritical && (composite < 90 || app.status === 'DEFICIENT');

            return (
              <div
                key={app.id}
                className="p-4 sm:p-5 hover:bg-slate-50 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-[#111827]">
                      {app.application_number}
                    </span>
                    <StatusBadge status={app.status} />
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        isCritical
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : isModerate
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {isCritical ? 'CRITICAL PRIORITY' : isModerate ? 'MODERATE PRIORITY' : 'ROUTINE CLEARANCE'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-800">{app.institution_name}</h4>
                  <p className="text-[11px] text-slate-500">
                    Program: {app.program_name} • State: {app.state || 'National Territory'} • Submissions Screened: {app.documents?.length || 4} Deeds
                  </p>
                </div>

                {/* Score Breakdown Pillar */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-center min-w-[90px]">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Triage Score
                    </span>
                    <span
                      className={`text-sm font-extrabold block ${
                        isCritical ? 'text-rose-600' : isModerate ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {composite.toFixed(1)}%
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        onSelectApplication(app.id);
                        onNavigateToScreen('authenticity_dossier');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition flex items-center gap-1"
                      title="Inspect ELA & Authenticity Forensics"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Forensics</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectApplication(app.id);
                        onNavigateToScreen('document_split');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-[#1D4ED8] hover:bg-blue-100 transition flex items-center gap-1"
                      title="Inspect Document OCR & Field Extraction"
                    >
                      <SplitSquareVertical className="w-3.5 h-3.5" />
                      <span>Split View</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectApplication(app.id);
                        onNavigateToScreen('reviewer_decision');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0B1220] hover:bg-[#111C30] text-white transition flex items-center gap-1"
                    >
                      <Gavel className="w-3.5 h-3.5 text-blue-400" />
                      <span>Decide</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* RENEWAL DETERMINATION MODAL */}
      {decisionModalMode && selectedRenewal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  decisionModalMode === 'APPROVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  <Gavel className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {decisionModalMode === 'APPROVE' ? 'Approve Institutional Renewal' : 'Issue Deficiency Notice'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Filing Ref: {selectedRenewal.renewal_reference_number}</p>
                </div>
              </div>
              <button
                onClick={() => setDecisionModalMode(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDecisionSubmit} className="space-y-4 pt-4">
              {decisionModalMode === 'CORRECTIONS' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Specific Deficiency Notice to Applicant:
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={deficiencyNoticeText}
                    onChange={(e) => setDeficiencyNoticeText(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Statutory Scrutiny Officer Notes (Audited):
                </label>
                <textarea
                  rows={3}
                  required
                  value={statutoryNotes}
                  onChange={(e) => setStatutoryNotes(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              {decisionModalMode === 'APPROVE' && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                  <span>Accreditation Validity Extension:</span>
                  <strong className="font-bold">+3 Academic Years (Until 2029)</strong>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDecisionModalMode(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={decisionSubmitting}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-md ${
                    decisionModalMode === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {decisionSubmitting ? 'Recording & Signing...' : 'Confirm Scrutiny Determination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Inspection Panels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Panel 1: Forensics Evidence Summary */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>7-Layer Document Forensics Pipeline</span>
            </h4>
            <button
              onClick={() => onNavigateToScreen('authenticity_dossier')}
              className="text-[11px] font-bold text-[#1D4ED8] hover:underline"
            >
              Open Dossier →
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="font-medium text-slate-700">Cryptographic Hash Collision</span>
              <span className="font-bold text-emerald-600">PASSED (Unique SHA-256)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="font-medium text-slate-700">Magic Bytes Container Screening</span>
              <span className="font-bold text-emerald-600">VERIFIED (PDF-1.7 standard)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="font-medium text-slate-700">Error Level Analysis (ELA Splicing)</span>
              <span className="font-bold text-rose-600">88.4% ANOMALY (Case C Fire NOC)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="font-medium text-slate-700">Statutory QR & PKI Trust Chain</span>
              <span className="font-bold text-blue-700">VALIDATED DOMAIN (firedept.delhi.gov.in)</span>
            </div>
          </div>
        </div>

        {/* Panel 2: Regulatory Handbook Evaluation */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#1D4ED8]" />
              <span>AICTE Handbook 2026-27 Norm Checks</span>
            </h4>
            <button
              onClick={() => onNavigateToScreen('compliance_findings')}
              className="text-[11px] font-bold text-[#1D4ED8] hover:underline"
            >
              All Findings →
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Clause 1.1: Minimum Land Norms</span>
                <span className="text-[10px] text-slate-500">Declared: 3.2 acres • Required: 2.5 acres</span>
              </div>
              <span className="font-bold text-emerald-600">SATISFIED</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Clause 2.3: Cross-Doc Acreage Match</span>
                <span className="text-[10px] text-slate-500">Deed shows 4.5 acres vs Declared 3.2 acres</span>
              </div>
              <span className="font-bold text-amber-600">DEFICIENT</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Clause 3.1: Fire NOC Expiry Check</span>
                <span className="text-[10px] text-slate-500">Certificate valid through Academic Year</span>
              </div>
              <span className="font-bold text-emerald-600">SATISFIED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
