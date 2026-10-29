import React from 'react';
import {
  Sliders,
  Users,
  BookOpen,
  History,
  RefreshCw,
  ArrowRight,
  Building2,
  ShieldCheck,
  FileText
} from 'lucide-react';
import type { ApplicationDetail, Language, ScreenId } from '../../../types';

interface AdminDashboardProps {
  applications: ApplicationDetail[];
  onNavigateToScreen: (screen: ScreenId) => void;
  onRefresh: () => void;
  language?: Language;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  applications = [],
  onNavigateToScreen,
  onRefresh,
}) => {
  const totalApps = applications.length;
  const approvedApps = applications.filter((a) => a.status === 'APPROVED').length;
  const deficientApps = applications.filter((a) => a.status === 'DEFICIENT').length;
  const flaggedApps = applications.filter((a) => a.status === 'FLAGGED').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 text-[#111827]">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-br from-[#0B1220] via-[#111C30] to-[#0B1220] text-white rounded-2xl p-6 shadow-xl border border-[#1E293B]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                TrustDoc Central Administration
              </span>
              <span className="text-xs text-slate-400 font-mono">NODE: CONTROL PLANE</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white">
              Compliance Administration & Governance Console
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Manage multi-tenant institutional accounts, provision scrutiny officers, calibrate regulatory handbook norm versions, trigger DPDP Act data sweeps, and verify cryptographic audit trails.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <button
              onClick={onRefresh}
              className="p-2.5 bg-[#16233B] hover:bg-[#1E293B] text-slate-300 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold transition"
              title="Refresh System Health"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigateToScreen('admin_console')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-900/40 transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sliders className="w-4 h-4" />
              <span>Full Admin Console</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">System Users & Roles</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1D4ED8] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-[#111827]">4 Personas</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">RBAC Partitioning Enforced</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Regulatory Norms</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-emerald-600">v2026.1 Active</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">AICTE Approval Handbook Norms</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Chained Audit Events</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-[#111827]">100% Verified</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">SHA-256 Cryptographic Continuity</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">DPDP Privacy Controls</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-purple-700">Strict Masking</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">PAN / Aadhaar / Phone Protected</span>
          </div>
        </div>
      </div>

      {/* Application Monitoring & Throughput Summary */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827] flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Application Scrutiny Distribution Monitoring</span>
            </h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Live status across {totalApps} institutional dossiers processed through TrustDoc.
            </p>
          </div>
          <button
            onClick={() => onNavigateToScreen('applications')}
            className="text-xs font-bold text-[#1D4ED8] hover:underline flex items-center gap-1"
          >
            <span>View All Records</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Applications</span>
            <span className="text-lg font-extrabold text-slate-900 mt-1 block">{totalApps}</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-[10px] text-emerald-800 font-bold uppercase block">Approved</span>
            <span className="text-lg font-extrabold text-emerald-600 mt-1 block">{approvedApps}</span>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-[10px] text-amber-800 font-bold uppercase block">Deficient</span>
            <span className="text-lg font-extrabold text-amber-600 mt-1 block">{deficientApps}</span>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
            <span className="text-[10px] text-rose-800 font-bold uppercase block">Tamper Flagged</span>
            <span className="text-lg font-extrabold text-rose-600 mt-1 block">{flaggedApps}</span>
          </div>
        </div>
      </div>

      {/* Main Governance Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Module 1: User & Role Provisioning */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>User & Role Governance</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                RBAC
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-3 leading-relaxed">
              Provision new institutional representatives, grant elevated scrutiny officer permissions, or audit active login sessions across nodes.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">Dr. Arvind Sharma</span>
                  <span className="text-[10px] text-slate-500">reviewer@aicte.gov.in</span>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-bold bg-[#1D4ED8] text-white rounded">
                  SCRUTINY OFFICER
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">Dr. K. S. Ramanujam</span>
                  <span className="text-[10px] text-slate-500">applicant@apex.edu</span>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-600 text-white rounded">
                  APPLICANT
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateToScreen('admin_console')}
            className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <span>Manage System Users</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Module 2: Regulatory Catalog & Rule Calibration */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>Regulatory Catalog Norms</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                AICTE APH
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-3 leading-relaxed">
              Calibrate rule thresholds, publish amended handbook versions, and inspect FAISS vector embeddings for statutory clause citations.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-700 font-medium">Urban Land Norm (Ch. 1)</span>
                <span className="font-mono font-bold text-slate-900">min 2.5 acres</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-700 font-medium">Faculty Cadre Ratio (Ch. 4)</span>
                <span className="font-mono font-bold text-slate-900">1:2:6 ratio</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-700 font-medium">Fire NOC Validity (Ch. 3)</span>
                <span className="font-mono font-bold text-slate-900">Mandatory Active</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateToScreen('admin_console')}
            className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <span>Calibrate Rules & Versions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Module 3: DPDP Retention & Audit Verification */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                <History className="w-4 h-4 text-purple-600" />
                <span>Audit & Privacy Policy</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                DPDP ACT
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-3 leading-relaxed">
              Verify immutable SHA-256 event chaining, execute automated retention sweeps for expired dossiers, and audit PII unmasking logs.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-700 font-medium">Hash Continuity Check</span>
                <span className="font-bold text-emerald-600">VERIFIED VALID</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-700 font-medium">PII Elevation Access Logs</span>
                <span className="font-bold text-blue-700">AUDITED & MASKED</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-700 font-medium">Retention Sweep Cycle</span>
                <span className="font-mono text-slate-800">Every 30 Days</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateToScreen('admin_console')}
            className="w-full py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <span>Open System Audit Logs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Module 4: College Registration & Renewal Oversight */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>College Registration Renewal</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                ACTIVE NORM
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-3 leading-relaxed">
              Statutory renewal window parameters, mandatory document criteria, and institutional accreditation expiry monitoring.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-700 font-medium">Renewal Window</span>
                <span className="font-mono font-bold text-slate-900">90 Days Prior to Expiry</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-700 font-medium">Renewal Validity Extension</span>
                <span className="font-mono font-bold text-emerald-600">+3 Academic Years</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-700 font-medium">Approval Authorization</span>
                <span className="font-bold text-purple-700">Restricted to Reviewers & Admins</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateToScreen('admin_console')}
            className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <span>Review Registration Policy</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
