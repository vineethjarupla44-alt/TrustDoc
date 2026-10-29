import React from 'react';
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  TrendingUp,
  Plus,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileSearch,
  KeyRound,
  GraduationCap,
  Sliders,
  ArrowRight,
} from 'lucide-react';
import type { ApplicationDetail, Language, ScreenId } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { useRouter } from '../../router/Router';

interface OverviewDashboardProps {
  applications: ApplicationDetail[];
  onSelectApplication: (id: string) => void;
  onSelectCase: (appNum: string) => void;
  language?: Language;
  onNavigateToScreen?: (screen: ScreenId) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  applications = [],
  onSelectApplication,
  onSelectCase,
  onNavigateToScreen,
}) => {
  const { navigate } = useRouter();
  const apps = applications || [];
  const totalApps = apps.length;
  const approvedApps = apps.filter((a) => a.status === 'APPROVED').length;
  const deficientApps = apps.filter((a) => a.status === 'DEFICIENT').length;
  const flaggedApps = apps.filter((a) => a.status === 'FLAGGED').length;
  const processingApps = apps.filter(
    (a) => a.status === 'PROCESSING' || a.status === 'DRAFT' || a.status === 'SUBMITTED'
  ).length;

  const passRate = totalApps > 0 ? Math.round((approvedApps / totalApps) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 text-[#111827]">
      {/* Top Hero & Context Banner */}
      <div className="bg-gradient-to-br from-[#0B1220] via-[#111C30] to-[#0B1220] text-white rounded-2xl p-6 shadow-xl border border-[#1E293B]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-[#1D4ED8]/30 text-blue-300 rounded-full border border-blue-500/40 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                TrustDoc Central Scrutiny Desk
              </span>
              <span className="text-xs text-slate-400 font-mono">STATUS: OPERATIONAL</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white">
              Regulatory Compliance & Document Forensics Intelligence
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Automated multi-tier verification engine for institutional accreditation dossiers. Combines
              cryptographic container forensics, deterministic rule-checking, and regulatory vector retrieval.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <div className="bg-[#080E18]/80 p-3.5 rounded-xl border border-slate-800 text-left sm:text-right">
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                Regulatory Benchmark
              </span>
              <span className="text-xs font-bold text-amber-300 block mt-0.5">
                AICTE Handbook (v2026-27 Norms)
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                FAISS RAG & Deterministic Engine Active
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#16233B] hover:bg-[#1E293B] text-white border border-slate-700 rounded-xl text-xs font-semibold shadow-md transition hover:scale-[1.02] active:scale-[0.98]"
              >
                <KeyRound className="w-4 h-4 text-blue-400" />
                <span>Portal Login</span>
              </button>

              {onNavigateToScreen && (
                <button
                  onClick={() => onNavigateToScreen('new_application')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D4ED8] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-900/40 transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Submission</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3 Role-Based Access Portals Strip */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#1D4ED8]" />
              <span>Role-Based Portal Access</span>
            </h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Secure dedicated workspaces for College Applicants, Security Officers, and Compliance Administrators.
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-bold text-[#1D4ED8] hover:underline flex items-center gap-1"
          >
            <span>All Portals</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Portal 1 */}
          <div
            onClick={() => navigate('/login/applicant')}
            className="p-3.5 rounded-xl border border-[#E2E8F0] hover:border-emerald-400 bg-[#F4F7FB] hover:bg-emerald-50/40 cursor-pointer transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">College Applicant</span>
                <span className="text-xs font-bold text-slate-800">Filing & Upload Portal</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
          </div>

          {/* Portal 2 */}
          <div
            onClick={() => navigate('/login/officer')}
            className="p-3.5 rounded-xl border border-[#E2E8F0] hover:border-blue-400 bg-[#F4F7FB] hover:bg-blue-50/40 cursor-pointer transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-blue-800 uppercase block">Security Officer</span>
                <span className="text-xs font-bold text-slate-800">Scrutiny Queue & Forensics</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#1D4ED8] group-hover:translate-x-1 transition" />
          </div>

          {/* Portal 3 */}
          <div
            onClick={() => navigate('/login/admin')}
            className="p-3.5 rounded-xl border border-[#E2E8F0] hover:border-purple-400 bg-[#F4F7FB] hover:bg-purple-50/40 cursor-pointer transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-700 text-white flex items-center justify-center shadow-xs">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-purple-800 uppercase block">Administrator</span>
                <span className="text-xs font-bold text-slate-800">Control Plane & Governance</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-700 group-hover:translate-x-1 transition" />
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Ingested */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Total Ingested</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1D4ED8] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#111827] mt-2">{totalApps} Applications</div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>100% Optical Extraction Complete</span>
          </div>
        </div>

        {/* Metric 2: Approval Rate */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Approval Rate</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-2">{passRate}%</div>
          <div className="text-[11px] text-[#64748B] font-medium mt-1">
            {approvedApps} approved of {totalApps} dossiers
          </div>
        </div>

        {/* Metric 3: Scrutiny Deficiencies */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Scrutiny Deficiencies</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-700 mt-2">{deficientApps} Cases</div>
          <div className="text-[11px] text-amber-700 font-semibold mt-1">
            Remedial notice generation required
          </div>
        </div>

        {/* Metric 4: Forensic Anomalies */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Forensic Anomalies</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-700 mt-2">{flaggedApps} Critical</div>
          <div className="text-[11px] text-rose-600 font-semibold mt-1">
            Elevated ELA variance or metadata alteration
          </div>
        </div>
      </div>

      {/* Review Statuses Distribution Bar */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
          <span className="font-bold text-[#111827]">Scrutiny Lifecycle Status Distribution</span>
          <span className="text-[#64748B] font-mono text-[11px]">
            {approvedApps} Approved • {deficientApps} Deficient • {flaggedApps} Flagged • {processingApps} In Scrutiny
          </span>
        </div>

        {/* Multi-segment progress bar */}
        <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100">
          <div
            style={{ width: `${totalApps > 0 ? (approvedApps / totalApps) * 100 : 0}%` }}
            className="bg-emerald-500 h-full transition-all"
            title={`Approved: ${approvedApps}`}
          />
          <div
            style={{ width: `${totalApps > 0 ? (deficientApps / totalApps) * 100 : 0}%` }}
            className="bg-amber-500 h-full transition-all"
            title={`Deficient: ${deficientApps}`}
          />
          <div
            style={{ width: `${totalApps > 0 ? (flaggedApps / totalApps) * 100 : 0}%` }}
            className="bg-rose-500 h-full transition-all"
            title={`Flagged: ${flaggedApps}`}
          />
          <div
            style={{ width: `${totalApps > 0 ? (processingApps / totalApps) * 100 : 0}%` }}
            className="bg-[#1D4ED8] h-full transition-all"
            title={`In Scrutiny: ${processingApps}`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs pt-1 text-[#64748B]">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Compliant / Approved ({approvedApps})
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            Deficient Checklist ({deficientApps})
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            Tamper Anomaly Flagged ({flaggedApps})
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1D4ED8] inline-block" />
            Active Scrutiny ({processingApps})
          </span>
        </div>
      </div>

      {/* Demonstration Scenarios Showcase */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#111827] flex items-center">
                <Sparkles className="w-4 h-4 mr-1.5 text-blue-600" />
                Benchmark Verification Scenarios
              </h3>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
                1-Click Inspection
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Launch pre-calibrated institutional dossiers to observe distinct automated scrutiny and forensic pathways.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Demo Case A */}
          <div
            onClick={() => onSelectCase('APP-2026-CASE-A')}
            className="p-5 rounded-2xl border border-emerald-200 hover:border-emerald-500 bg-emerald-50/20 hover:bg-emerald-50/60 transition cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-full">
                  CASE A
                </span>
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  100% Compliant
                </span>
              </div>
              <h4 className="text-sm font-bold text-[#111827] mt-2.5">Apex Institute of Technology</h4>
              <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                Clean 3.20-acre Title Deed, matching Building Plan with valid COA license <code className="font-mono text-emerald-800">CA/2016/48201</code>, active Fire NOC, 1:15 Faculty Ratio.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-emerald-200/60 flex items-center justify-between text-xs font-bold text-emerald-700">
              <span>Inspect Dossier</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>
          </div>

          {/* Demo Case B */}
          <div
            onClick={() => onSelectCase('APP-2026-CASE-B')}
            className="p-5 rounded-2xl border border-amber-200 hover:border-amber-500 bg-amber-50/20 hover:bg-amber-50/60 transition cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-600 text-white rounded-full">
                  CASE B
                </span>
                <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Acreage Mismatch
                </span>
              </div>
              <h4 className="text-sm font-bold text-[#111827] mt-2.5">Bharti Technical Institute</h4>
              <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                Land Deed states 2.50 acres, but Master Site Plan states only 1.85 acres (<strong className="text-amber-900">0.65-acre discrepancy</strong>). Missing architect COA registration.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-center justify-between text-xs font-bold text-amber-700">
              <span>Inspect Dossier</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>
          </div>

          {/* Demo Case C */}
          <div
            onClick={() => onSelectCase('APP-2026-CASE-C')}
            className="p-5 rounded-2xl border border-rose-200 hover:border-rose-500 bg-rose-50/20 hover:bg-rose-50/60 transition cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded-full">
                  CASE C
                </span>
                <span className="text-xs font-bold text-rose-800 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  Photoshop Tampered
                </span>
              </div>
              <h4 className="text-sm font-bold text-[#111827] mt-2.5">Crestview Polytechnic</h4>
              <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                Fire Safety NOC modified in <strong className="text-rose-900">Adobe Photoshop 2023</strong> with localized ELA pixel variance anomaly (78.4) and expired validity date.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-rose-200/60 flex items-center justify-between text-xs font-bold text-rose-700">
              <span>Inspect Dossier</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>
          </div>
        </div>
      </div>

      {/* Applications Quick Registry Table */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="text-sm font-bold text-[#111827]">Institutional Accreditation Submissions</h3>
            <p className="text-xs text-[#64748B]">Live registry of active statutory filings and automated compliance grades.</p>
          </div>
          {onNavigateToScreen && (
            <button
              onClick={() => onNavigateToScreen('applications')}
              className="text-xs font-semibold text-[#1D4ED8] hover:text-blue-800 flex items-center gap-1 transition"
            >
              <span>View All Applications</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#64748B] uppercase font-bold text-[11px] tracking-wider">
                <th className="py-3.5 px-5">Application Number</th>
                <th className="py-3.5 px-5">Institution Name</th>
                <th className="py-3.5 px-5">Program Domain</th>
                <th className="py-3.5 px-5">Type</th>
                <th className="py-3.5 px-5">Triage Score</th>
                <th className="py-3.5 px-5">Scrutiny Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {apps.map((app) => {
                const isDemo = app.application_number.startsWith('APP-2026-CASE-');
                return (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-5 font-mono font-bold text-[#1D4ED8]">
                      {app.application_number}
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-[#111827]">
                      {app.institution_name}
                    </td>
                    <td className="py-3.5 px-5 text-[#64748B]">
                      {app.program_name}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDemo ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {isDemo ? 'Benchmark Case' : 'Live Submission'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-[#111827] font-mono">
                      {app.summary?.composite_score !== undefined ? `${app.summary.composite_score}%` : 'Pending'}
                    </td>
                    <td className="py-3.5 px-5">
                      <StatusBadge status={app.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => onSelectApplication(app.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] hover:text-white bg-blue-50 hover:bg-[#1D4ED8] rounded-lg transition inline-flex items-center gap-1"
                      >
                        <FileSearch className="w-3.5 h-3.5" />
                        <span>Inspect Dossier</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
