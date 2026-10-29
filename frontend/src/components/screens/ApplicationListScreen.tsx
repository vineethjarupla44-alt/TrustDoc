import React, { useState } from 'react';
import { Search, Download, ArrowUpRight, Layers, Plus, ArrowUpDown, FileSearch } from 'lucide-react';
import type { ApplicationDetail, Language } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { StateView } from '../common/StateView';
import { getPDFReportUrl } from '../../services/api';

interface ApplicationListScreenProps {
  applications: ApplicationDetail[];
  onSelectApplication: (id: string) => void;
  language?: Language;
  onNewApplication?: () => void;
}

export const ApplicationListScreen: React.FC<ApplicationListScreenProps> = ({
  applications = [],
  onSelectApplication,
  onNewApplication,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'score_high' | 'score_low'>('newest');

  const apps = applications || [];

  const filteredApps = apps
    .filter((app) => {
      const matchesSearch =
        app.application_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.institution_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.program_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.institution_type.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'APPROVED') return app.status === 'APPROVED';
      if (statusFilter === 'DEFICIENT') return app.status === 'DEFICIENT';
      if (statusFilter === 'FLAGGED') return app.status === 'FLAGGED';
      if (statusFilter === 'PROCESSING') return app.status === 'PROCESSING';
      if (statusFilter === 'DRAFT') return app.status === 'DRAFT';
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'score_high') {
        return (b.summary?.composite_score ?? 0) - (a.summary?.composite_score ?? 0);
      }
      if (sortBy === 'score_low') {
        return (a.summary?.composite_score ?? 0) - (b.summary?.composite_score ?? 0);
      }
      return 0;
    });

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden max-w-7xl mx-auto m-4 md:m-6 text-[#111827]">
      {/* Header & Filter Bar */}
      <div className="p-6 border-b border-[#E2E8F0] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-extrabold text-[#111827] tracking-tight">
                Institutional Accreditation Registry
              </h2>
              <span className="text-[10px] font-bold bg-blue-50 text-[#1D4ED8] px-2.5 py-0.5 rounded-full border border-blue-200 uppercase tracking-wider">
                Live Verification Queue
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Browse, filter, and inspect institutional applications processed through the TrustDoc verification engine.
            </p>
          </div>
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <span className="text-xs font-semibold px-3 py-1.5 bg-[#F4F7FB] text-[#64748B] rounded-xl font-mono border border-[#E2E8F0]">
              {filteredApps.length} of {apps.length} Submissions
            </span>
            {onNewApplication && (
              <button
                onClick={onNewApplication}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1D4ED8] hover:bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-900/30 transition hover:scale-[1.02]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Application</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls & Sort Bar */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Application No, Institution Name, or Program..."
              className="w-full text-xs pl-10 pr-4 py-2 bg-[#F4F7FB] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] focus:bg-white text-[#111827] placeholder-[#64748B] transition"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-[#F4F7FB] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#64748B] self-stretch md:self-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-[#64748B]">Sort:</span>
            <select
              aria-label="Sort applications"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent font-semibold text-[#111827] focus:outline-none cursor-pointer text-xs"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="score_high">Highest Triage Score</option>
              <option value="score_low">Lowest Triage Score</option>
            </select>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1 bg-[#F4F7FB] p-1 rounded-xl border border-[#E2E8F0] self-stretch md:self-auto overflow-x-auto text-xs font-semibold">
            {['ALL', 'APPROVED', 'DEFICIENT', 'FLAGGED', 'PROCESSING', 'DRAFT'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg transition text-xs ${
                  statusFilter === st
                    ? 'bg-white text-[#1D4ED8] shadow-sm font-bold border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
              >
                {st === 'ALL' ? 'All' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table / Empty State */}
      {filteredApps.length === 0 ? (
        <StateView
          state="empty"
          title="No Matching Applications"
          description="Try modifying your search query or switching the status filter."
          actionText="Clear Filters"
          onAction={() => {
            setSearchTerm('');
            setStatusFilter('ALL');
          }}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#64748B] uppercase font-bold text-[11px] tracking-wider">
                <th className="py-3.5 px-5">Application Identifier</th>
                <th className="py-3.5 px-5">Institution & Program</th>
                <th className="py-3.5 px-5">Evidence Package</th>
                <th className="py-3.5 px-5">Triage Breakdown</th>
                <th className="py-3.5 px-5">Scrutiny Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filteredApps.map((app) => {
                const isDemo = app.application_number.startsWith('APP-2026-CASE-');
                return (
                  <tr key={app.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-4 px-5">
                      <div className="font-mono font-bold text-[#1D4ED8]">
                        {app.application_number}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                        isDemo ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {isDemo ? 'Benchmark Case' : 'Live Submission'}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <span className="font-bold text-[#111827] block text-xs">{app.institution_name}</span>
                      <span className="text-[11px] text-[#64748B]">{app.program_name} • {app.institution_type}</span>
                    </td>
                    <td className="py-4 px-5">
                      <span className="inline-flex items-center gap-1.5 bg-[#F4F7FB] px-2.5 py-1 rounded-lg text-[11px] text-[#64748B] font-semibold border border-[#E2E8F0]">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>{app.documents?.length || 4} Mandatory Docs</span>
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      {app.summary ? (
                        <div className="flex items-center gap-2 text-[11px] font-mono">
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200" title="Authenticity Score">
                            A:{app.summary.authenticity_score}%
                          </span>
                          <span className="text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200" title="Completeness Score">
                            C:{app.summary.completeness_score}%
                          </span>
                          <span className="text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200" title="Regulatory Score">
                            R:{app.summary.compliance_score}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-medium text-xs">Pending Validation</span>
                      )}
                    </td>
                    <td className="py-4 px-5">
                      <StatusBadge status={app.status} size="sm" />
                    </td>
                    <td className="py-4 px-5 text-right space-x-2">
                      <a
                        href={getPDFReportUrl(app.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-[#64748B] hover:text-[#111827] bg-[#F4F7FB] hover:bg-slate-200 rounded-xl transition inline-block align-middle border border-[#E2E8F0]"
                        title="Download Statutory Assessment Dossier (PDF)"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => onSelectApplication(app.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] hover:text-white bg-blue-50 hover:bg-[#1D4ED8] rounded-xl transition inline-flex items-center gap-1 border border-blue-200 hover:border-transparent"
                      >
                        <FileSearch className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
