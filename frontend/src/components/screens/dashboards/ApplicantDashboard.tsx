import React, { useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Download,
  Plus,
  ArrowRight,
  FileCheck2,
  Bot,
  RefreshCw,
  FolderOpen,
  Building2
} from 'lucide-react';
import type { ApplicationDetail, Language, ScreenId } from '../../../types';
import { StatusBadge } from '../../common/StatusBadge';
import { getPDFReportUrl } from '../../../services/api';
import { CollegeRegistrationSection } from './CollegeRegistrationSection';

interface ApplicantDashboardProps {
  applications: ApplicationDetail[];
  currentApp: ApplicationDetail | null;
  onSelectApplication: (id: string) => void;
  onNavigateToScreen: (screen: ScreenId) => void;
  onRefresh: () => void;
  language?: Language;
}

export const ApplicantDashboard: React.FC<ApplicantDashboardProps> = ({
  applications = [],
  currentApp,
  onSelectApplication,
  onNavigateToScreen,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'registration' | 'documents' | 'deficiencies'>('overview');

  // Filter applications for current institution / applicant
  const myApps = applications.filter((a) => a.application_number.includes('APP-2026-CASE') || true);
  const selectedApp = currentApp || myApps[0] || null;

  const totalMyApps = myApps.length;
  const approvedCount = myApps.filter((a) => a.status === 'APPROVED').length;
  const deficientCount = myApps.filter((a) => a.status === 'DEFICIENT' || a.status === 'FLAGGED').length;

  // Documents Checklist
  const mandatoryDocs = [
    {
      type: 'LAND_DEED',
      name: 'Registered Land Title Deed',
      standard: 'AICTE APH 2026-27 Ch. 1 (Minimum Land Norms)',
      status: selectedApp?.documents?.some((d) => d.document_type === 'LAND_DEED') ? 'UPLOADED' : 'MISSING',
      file: selectedApp?.documents?.find((d) => d.document_type === 'LAND_DEED'),
    },
    {
      type: 'BUILDING_PLAN',
      name: 'Master Site & Infrastructure Plan',
      standard: 'AICTE APH 2026-27 Ch. 2 (Built-up Area & Setbacks)',
      status: selectedApp?.documents?.some((d) => d.document_type === 'BUILDING_PLAN') ? 'UPLOADED' : 'MISSING',
      file: selectedApp?.documents?.find((d) => d.document_type === 'BUILDING_PLAN'),
    },
    {
      type: 'FIRE_NOC',
      name: 'Fire & Life Safety Clearance Certificate',
      standard: 'AICTE APH 2026-27 Ch. 3 (Disaster Preparedness)',
      status: selectedApp?.documents?.some((d) => d.document_type === 'FIRE_NOC') ? 'UPLOADED' : 'MISSING',
      file: selectedApp?.documents?.find((d) => d.document_type === 'FIRE_NOC'),
    },
    {
      type: 'FACULTY_LIST',
      name: 'Faculty Cadre & Ratio Declaration',
      standard: 'AICTE APH 2026-27 Ch. 4 (Cadre Ratio 1:2:6)',
      status: selectedApp?.documents?.some((d) => d.document_type === 'FACULTY_LIST') ? 'UPLOADED' : 'MISSING',
      file: selectedApp?.documents?.find((d) => d.document_type === 'FACULTY_LIST'),
    },
  ];

  const uploadedDocsCount = mandatoryDocs.filter((d) => d.status === 'UPLOADED').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 text-[#111827]">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-br from-[#0B1220] via-[#111C30] to-[#0B1220] text-white rounded-2xl p-6 shadow-xl border border-[#1E293B]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                College Applicant Portal
              </span>
              <span className="text-xs text-slate-400 font-mono">CYCLE: AY 2026-2027</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white">
              Institutional Accreditation & Statutory Filings
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Track the verification status of your AICTE regulatory submission, upload mandatory statutory deeds, and resolve committee review findings.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <button
              onClick={onRefresh}
              className="p-2.5 bg-[#16233B] hover:bg-[#1E293B] text-slate-300 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold transition"
              title="Refresh Application Status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigateToScreen('new_application')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D4ED8] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-900/40 transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>New Submission</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">My Submissions</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1D4ED8] flex items-center justify-center">
              <FolderOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-[#111827]">{totalMyApps}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Recorded Institutional Filings</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Accreditation Status</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-emerald-600">{approvedCount}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Eligible / Approved Filings</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Active Deficiencies</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-amber-600">{deficientCount}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Requires Document Clarification</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Document Inventory</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-[#111827]">
              {uploadedDocsCount} / {mandatoryDocs.length}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Mandatory Deeds Uploaded</span>
          </div>
        </div>
      </div>

      {/* Application Lifecycle Stepper Bar */}
      {selectedApp && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Tracked Filing
              </span>
              <h3 className="text-sm font-bold text-[#111827]">
                {selectedApp.application_number} — {selectedApp.institution_name}
              </h3>
            </div>
            <StatusBadge status={selectedApp.status} />
          </div>

          {/* Stepper Progress */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Step 1</span>
              <span className="font-bold text-emerald-950 mt-1 block">Application Drafted</span>
              <span className="text-[10px] text-emerald-700 mt-0.5 block">Basic details enrolled</span>
            </div>

            <div
              className={`p-3 rounded-xl border text-xs ${
                uploadedDocsCount === 4
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <span className="text-[10px] font-bold uppercase block">Step 2</span>
              <span className="font-bold mt-1 block">Statutory Deeds</span>
              <span className="text-[10px] opacity-80 mt-0.5 block">
                {uploadedDocsCount}/4 Deeds Verified
              </span>
            </div>

            <div
              className={`p-3 rounded-xl border text-xs ${
                selectedApp.status === 'PROCESSING' || selectedApp.status === 'APPROVED' || selectedApp.status === 'DEFICIENT'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <span className="text-[10px] font-bold uppercase block">Step 3</span>
              <span className="font-bold mt-1 block">Forensic Scrutiny</span>
              <span className="text-[10px] opacity-80 mt-0.5 block">
                {selectedApp.summary ? `Score: ${selectedApp.summary.composite_score}%` : 'Pending validation'}
              </span>
            </div>

            <div
              className={`p-3 rounded-xl border text-xs ${
                selectedApp.status === 'APPROVED'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : selectedApp.status === 'DEFICIENT'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <span className="text-[10px] font-bold uppercase block">Step 4</span>
              <span className="font-bold mt-1 block">Council Decision</span>
              <span className="text-[10px] opacity-80 mt-0.5 block">{selectedApp.status}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition shrink-0 ${
            activeTab === 'overview'
              ? 'bg-[#1D4ED8] text-white'
              : 'text-[#64748B] hover:text-[#111827] hover:bg-slate-100'
          }`}
        >
          My Applications
        </button>
        <button
          onClick={() => setActiveTab('registration')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition shrink-0 flex items-center gap-1.5 ${
            activeTab === 'registration'
              ? 'bg-[#1D4ED8] text-white'
              : 'text-[#64748B] hover:text-[#111827] hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>College Registration & Renewal</span>
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition shrink-0 flex items-center gap-1.5 ${
            activeTab === 'documents'
              ? 'bg-[#1D4ED8] text-white'
              : 'text-[#64748B] hover:text-[#111827] hover:bg-slate-100'
          }`}
        >
          <span>Required Documents</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-200 text-slate-700">
            {uploadedDocsCount}/4
          </span>
        </button>
        <button
          onClick={() => setActiveTab('deficiencies')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition shrink-0 flex items-center gap-1.5 ${
            activeTab === 'deficiencies'
              ? 'bg-[#1D4ED8] text-white'
              : 'text-[#64748B] hover:text-[#111827] hover:bg-slate-100'
          }`}
        >
          <span>Compliance Findings</span>
          {deficientCount > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-200 text-amber-900 font-bold">
              {deficientCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB: College Registration & Renewal Section */}
      {activeTab === 'registration' && (
        <CollegeRegistrationSection onRefreshParent={onRefresh} />
      )}

      {/* TAB 1: My Applications Table */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-[#E2E8F0] flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Enrolled Institution Filings
            </h3>
            <span className="text-xs text-slate-500">{myApps.length} Applications</span>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {myApps.map((app) => (
              <div
                key={app.id}
                className="p-4 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-[#111827]">
                      {app.application_number}
                    </span>
                    <StatusBadge status={app.status} />
                  </div>
                  <h4 className="text-xs font-medium text-slate-700">{app.institution_name}</h4>
                  <p className="text-[11px] text-slate-400">
                    Program: {app.program_name} • Academic Year: {app.academic_year || '2026-2027'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      onSelectApplication(app.id);
                      onNavigateToScreen('document_split');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Documents</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectApplication(app.id);
                      onNavigateToScreen('application_detail');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] transition flex items-center gap-1.5"
                  >
                    <span>View Dossier</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <a
                    href={getPDFReportUrl(app.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                    title="Download Official PDF Report"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Required Documents Upload Checklist */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#111827] mb-1">
              Mandatory Statutory Document Checklist (AICTE APH 2026-27)
            </h3>
            <p className="text-xs text-[#64748B] mb-4">
              All four primary certificates are required for statutory clearance under Approval Process Norms.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mandatoryDocs.map((doc) => (
                <div
                  key={doc.type}
                  className="p-4 rounded-xl border border-[#E2E8F0] bg-slate-50 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {doc.type}
                      </span>
                      <h4 className="text-xs font-bold text-[#111827] mt-0.5">{doc.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{doc.standard}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        doc.status === 'UPLOADED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono truncate max-w-[150px]">
                      {doc.file ? doc.file.file_name : 'No file registered'}
                    </span>
                    <button
                      onClick={() => onNavigateToScreen('document_split')}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#1D4ED8] hover:bg-blue-700 text-white transition flex items-center gap-1"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>{doc.status === 'UPLOADED' ? 'Replace / Inspect' : 'Upload File'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Compliance Findings & Copilot Assistance */}
      {activeTab === 'deficiencies' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#111827]">
                  Statutory Scrutiny Deficiencies & Actionable Findings
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Review findings flagged by the automated validation engine and scrutiny committee officers.
                </p>
              </div>

              <button
                onClick={() => onNavigateToScreen('chatbot')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-[#1D4ED8] hover:bg-blue-100 text-xs font-semibold transition"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Ask Regulatory Copilot</span>
              </button>
            </div>

            {selectedApp?.findings && selectedApp.findings.length > 0 ? (
              <div className="space-y-3">
                {selectedApp.findings.map((f) => (
                  <div
                    key={f.id}
                    className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900">{f.title}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                        {f.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{f.description}</p>
                    <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Rule Code: <strong className="text-slate-800">{f.rule_code}</strong></span>
                      <button
                        onClick={() => onNavigateToScreen('compliance_findings')}
                        className="font-bold text-[#1D4ED8] hover:underline"
                      >
                        View Full Regulatory Finding →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <span>No active regulatory deficiencies recorded for this application.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
