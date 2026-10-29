import React, { useState, useEffect } from 'react';
import type {
  ApplicationDetail,
  ComplianceFinding,
  PrioritizedQueueItem,
  ApplicationHistoryItem
} from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import {
  overrideFinding,
  recordReviewerDecision,
  fetchReviewerQueue,
  requestApplicationCorrection,
  fetchApplicationHistory,
  getDocumentPreviewUrl,
  createDocumentAccessToken,
} from '../../services/api';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Send,
  Scale,
  RefreshCw,
  Search,
  FileText,
  History,
  Lock,
  Wrench,
  ChevronRight,
  ShieldCheck,
  Eye,
  Clock,
  X,
  Layers,
  Info,
  Hash,
  Image as ImageIcon,
  BadgeCheck,
} from 'lucide-react';

interface ReviewerDecisionScreenProps {
  applications: ApplicationDetail[];
  currentApplication: ApplicationDetail | null;
  onSelectApplication: (id: string) => void;
  onRefresh: () => void;
  onViewReport: (id: string) => void;
}

export const ReviewerDecisionScreen: React.FC<ReviewerDecisionScreenProps> = ({
  applications = [],
  currentApplication,
  onSelectApplication,
  onRefresh,
  onViewReport,
}) => {
  const [screenView, setScreenView] = useState<'queue' | 'workbench'>('queue');
  const [queueItems, setQueueItems] = useState<PrioritizedQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Queue Statistics
  const [criticalCount, setCriticalCount] = useState<number>(0);
  const [moderateCount, setModerateCount] = useState<number>(0);
  const [routineCount, setRoutineCount] = useState<number>(0);
  const [allEligibleCount, setAllEligibleCount] = useState<number>(0);

  // In-flight selected application tracker
  // Decision Form State
  const [decisionType, setDecisionType] = useState<'APPROVED' | 'DEFICIENT' | 'FLAGGED'>('APPROVED');
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [conditionsText, setConditionsText] = useState('');
  const [sopAcknowledged, setSopAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decisionSuccessMsg, setDecisionSuccessMsg] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Override Finding Modal State
  const [selectedFindingForOverride, setSelectedFindingForOverride] = useState<ComplianceFinding | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'RESOLVED' | 'WAIVED'>('WAIVED');
  const [overrideJustification, setOverrideJustification] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);

  // Correction Request Modal State
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionInstructions, setCorrectionInstructions] = useState('');
  const [correctionDeadline, setCorrectionDeadline] = useState(15);
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);

  // History Drawer State
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyEvents, setHistoryEvents] = useState<ApplicationHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Document Secure Preview State
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, [tierFilter, statusFilter, applications]);

  const loadQueue = async () => {
    setQueueLoading(true);
    let apiSuccess = false;
    try {
      const res = await fetchReviewerQueue(
        tierFilter === 'ALL' ? undefined : tierFilter,
        statusFilter === 'ALL' ? undefined : statusFilter,
        searchTerm.trim() || undefined
      );
      if (res && Array.isArray(res.queue) && res.queue.length > 0) {
        setQueueItems(res.queue);
        setCriticalCount(res.critical_count ?? 0);
        setModerateCount(res.moderate_count ?? 0);
        setRoutineCount(res.routine_count ?? 0);
        setAllEligibleCount(res.all_eligible_count ?? res.total_items ?? res.queue.length);
        apiSuccess = true;
      }
    } catch (err) {
      console.warn('Queue API fetch notice; evaluating cached applications:', err);
    } finally {
      setQueueLoading(false);
    }

    // Graceful fallback to client applications prop if API returned empty or errored
    if (!apiSuccess && applications && applications.length > 0) {
      let crit = 0;
      let mod = 0;
      let rout = 0;

      const mappedItems: PrioritizedQueueItem[] = applications.map((app) => {
        const authScore = app.summary?.authenticity_score ?? 100.0;
        const compScore = app.summary?.completeness_score ?? 0.0;
        const regScore = app.summary?.compliance_score ?? 0.0;
        const composite = app.summary?.composite_score ?? (0.35 * authScore + 0.30 * compScore + 0.35 * regScore);

        const authFlags = (app.findings || []).filter((f) => f.category === 'AUTHENTICITY' && (f.finding_status === 'FAIL' || f.severity === 'CRITICAL')).length;
        const compFlags = (app.findings || []).filter((f) => f.category === 'COMPLETENESS' && (f.finding_status === 'FAIL' || f.severity === 'CRITICAL')).length;
        const regFlags = (app.findings || []).filter((f) => f.category === 'REGULATORY' && (f.finding_status === 'FAIL' || f.severity === 'CRITICAL')).length;

        const mandatoryTypes = ['LAND_DEED', 'BUILDING_PLAN', 'FIRE_NOC', 'FACULTY_LIST'];
        const uploadedTypes = new Set((app.documents || []).map((d) => d.document_type));
        const missing = mandatoryTypes.filter((m) => !uploadedTypes.has(m));

        const hasCriticalAuth = (app.findings || []).some((f) => f.category === 'AUTHENTICITY' && f.severity === 'CRITICAL' && f.finding_status === 'FAIL');

        let tier: 'CRITICAL_HIGH' | 'MODERATE_MEDIUM' | 'ROUTINE_CLEARANCE' = 'ROUTINE_CLEARANCE';
        if (app.status === 'FLAGGED' || composite < 70 || hasCriticalAuth) {
          tier = 'CRITICAL_HIGH';
          crit++;
        } else if (composite < 90 || app.status === 'DEFICIENT' || missing.length > 0 || compFlags > 0) {
          tier = 'MODERATE_MEDIUM';
          mod++;
        } else {
          tier = 'ROUTINE_CLEARANCE';
          rout++;
        }

        return {
          application_id: app.id,
          application_number: app.application_number,
          institution_name: app.institution_name || 'Apex Institute of Technology',
          program_name: app.program_name || 'General Category',
          institution_type: app.institution_type || 'Private / Self-Financed',
          status: app.status || 'DRAFT',
          submitted_at: app.submitted_at,
          created_at: app.created_at || new Date().toISOString(),
          composite_score: Math.round(composite * 10) / 10,
          authenticity_score: Math.round(authScore * 10) / 10,
          completeness_score: Math.round(compScore * 10) / 10,
          compliance_score: Math.round(regScore * 10) / 10,
          priority_tier: tier,
          authenticity_flags_count: authFlags,
          completeness_flags_count: compFlags,
          regulatory_flags_count: regFlags,
          documents_count: app.documents?.length || 0,
          missing_documents: missing,
          correction_status: null
        };
      });

      setCriticalCount(crit);
      setModerateCount(mod);
      setRoutineCount(rout);
      setAllEligibleCount(mappedItems.length);

      let filtered = mappedItems;
      if (tierFilter !== 'ALL') {
        filtered = filtered.filter((i) => i.priority_tier === tierFilter);
      }
      if (statusFilter !== 'ALL') {
        filtered = filtered.filter((i) => i.status === statusFilter);
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (i) => i.application_number.toLowerCase().includes(q) || i.institution_name.toLowerCase().includes(q) || i.program_name.toLowerCase().includes(q)
        );
      }

      const tierOrder = { CRITICAL_HIGH: 0, MODERATE_MEDIUM: 1, ROUTINE_CLEARANCE: 2 };
      filtered.sort((a, b) => (tierOrder[a.priority_tier] - tierOrder[b.priority_tier]) || (a.composite_score - b.composite_score));

      setQueueItems(filtered);
    }
  };

  const handleSelectFromQueue = (appId: string) => {
    onSelectApplication(appId);
    setScreenView('workbench');
  };

  const handleResetFilters = () => {
    setTierFilter('ALL');
    setStatusFilter('ALL');
    setSearchTerm('');
  };

  const loadHistory = async () => {
    if (!currentApplication) return;
    setHistoryLoading(true);
    try {
      const res = await fetchApplicationHistory(currentApplication.id);
      setHistoryEvents(res.events || []);
      setShowHistoryDrawer(true);
    } catch (err) {
      console.error('Failed to load application history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handlePreviewDoc = async (docId: string) => {
    try {
      const tokenRes = await createDocumentAccessToken(docId);
      setPreviewDocId(docId);
      setPreviewToken(tokenRes.token);
    } catch (err) {
      console.error('Failed to generate preview token:', err);
    }
  };

  const handleOverrideSubmit = async () => {
    if (!currentApplication || !selectedFindingForOverride || !overrideJustification.trim()) return;
    setOverrideLoading(true);
    try {
      await overrideFinding(
        currentApplication.id,
        selectedFindingForOverride.id,
        overrideStatus,
        overrideJustification
      );
      setSelectedFindingForOverride(null);
      setOverrideJustification('');
      onRefresh();
      loadQueue();
    } catch (err) {
      console.error('Failed to override finding:', err);
      alert('Failed to record finding override in audit log.');
    } finally {
      setOverrideLoading(false);
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentApplication || !correctionInstructions.trim()) return;
    setCorrectionSubmitting(true);
    try {
      const defItems = (currentApplication.findings || [])
        .filter((f) => f.finding_status === 'FAIL')
        .map((f) => ({
          field_key: f.rule_code,
          document_type: f.category,
          reason: f.description,
        }));

      await requestApplicationCorrection(
        currentApplication.id,
        defItems.length > 0 ? defItems : [{ reason: 'Deficiency clarification requested by Scrutiny Committee' }],
        correctionInstructions,
        correctionDeadline
      );
      setShowCorrectionModal(false);
      setCorrectionInstructions('');
      onRefresh();
      loadQueue();
      alert('Deficiency Notice successfully issued to applicant.');
    } catch (err) {
      console.error('Correction request error:', err);
      alert('Failed to issue correction request.');
    } finally {
      setCorrectionSubmitting(false);
    }
  };

  const validateDecisionForm = (): boolean => {
    if (!currentApplication) {
      alert('No application selected.');
      return false;
    }
    if (!sopAcknowledged) {
      alert('Please confirm the statutory SOP compliance acknowledgment checkbox before proceeding.');
      return false;
    }
    if ((decisionType === 'DEFICIENT' || decisionType === 'FLAGGED') && decisionRemarks.trim().length < 10) {
      alert('Official statutory remarks (minimum 10 characters) are mandatory for Deficient and Flagged determinations.');
      return false;
    }
    if (decisionType === 'APPROVED' && decisionRemarks.trim().length < 5) {
      alert('Please provide statutory grounds of approval in the remarks field (minimum 5 characters).');
      return false;
    }
    return true;
  };

  const handleInitiateDecision = () => {
    if (validateDecisionForm()) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmDecisionSubmit = async () => {
    if (!currentApplication || isSubmitting) return;

    setIsSubmitting(true);
    setDecisionSuccessMsg(null);

    try {
      const conds = conditionsText
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean);

      const fullRemarks = conds.length > 0
        ? `${decisionRemarks.trim()}\n\nStipulated Conditions Precedent:\n${conds.map((c) => `- ${c}`).join('\n')}`
        : decisionRemarks.trim();

      const res = await recordReviewerDecision(currentApplication.id, decisionType, fullRemarks);
      setShowConfirmModal(false);
      setDecisionSuccessMsg(
        `Determination recorded as ${decisionType} with digital seal hash: ${res.digital_seal_hash ? res.digital_seal_hash.substring(0, 16) + '...' : 'Verified'}.`
      );
      setDecisionRemarks('');
      setConditionsText('');
      setSopAcknowledged(false);
      onRefresh();
      loadQueue();
    } catch (err) {
      console.error('Failed to record reviewer decision:', err);
      alert('Failed to record official decision. Please check your connection and authorized credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group current application findings into distinct categories
  const allFindings = currentApplication?.findings || [];

  // 1. Separate Hash-Based Duplicate Collisions (SHA-256 binary match)
  const hashDuplicateFindings = allFindings.filter(
    (f) =>
      f.category === 'AUTHENTICITY' &&
      (f.rule_code === 'AUTH_HASH_COLLISION' ||
        f.rule_code?.includes('HASH') ||
        f.title?.toLowerCase().includes('duplicate') ||
        f.title?.toLowerCase().includes('collision') ||
        f.description?.toLowerCase().includes('sha-256') ||
        f.description?.toLowerCase().includes('hash collision'))
  );

  // 2. Separate Image Forensics & Splicing Indicators (ELA noise, editing software metadata)
  const imageForensicFindings = allFindings.filter(
    (f) =>
      f.category === 'AUTHENTICITY' &&
      !hashDuplicateFindings.some((hf) => hf.id === f.id)
  );

  // 3. Completeness & Inventory findings
  const compFindings = allFindings.filter((f) => f.category === 'COMPLETENESS');

  // 4. Regulatory Norms findings
  const regFindings = allFindings.filter((f) => f.category === 'REGULATORY');

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Header & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-blue-200 flex items-center justify-center font-bold shadow-md shadow-blue-900/10">
              <Scale className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
                Scrutiny Committee & Reviewer Workbench
                <span className="text-[11px] bg-blue-100 text-blue-800 font-semibold px-2.5 py-0.5 rounded-full border border-blue-200">
                  Authorized Scrutiny
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Prioritized queue triage, separate authenticity vs compliance indicators, and statutory determination
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setScreenView('queue')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              screenView === 'queue'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Prioritized Queue ({queueItems.length}{allEligibleCount > queueItems.length ? ` of ${allEligibleCount}` : ''})
          </button>
          <button
            onClick={() => setScreenView('workbench')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              screenView === 'workbench'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Scrutiny Workbench {currentApplication ? `(${currentApplication.application_number})` : ''}
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* VIEW 1: PRIORITIZED SCRUTINY QUEUE                             */}
      {/* ============================================================== */}
      {screenView === 'queue' && (
        <div className="space-y-5">
          {/* Top KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <button
              onClick={() => setTierFilter('ALL')}
              className={`p-3.5 rounded-xl border text-left transition ${
                tierFilter === 'ALL'
                  ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Total Scrutiny Cases</span>
                <Layers className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xl font-black font-mono text-slate-900 mt-1">{allEligibleCount}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">All submitted & processed filings</p>
            </button>

            <button
              onClick={() => setTierFilter('CRITICAL_HIGH')}
              className={`p-3.5 rounded-xl border text-left transition ${
                tierFilter === 'CRITICAL_HIGH'
                  ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-rose-700">
                <span>Critical / Urgent Triage</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-xl font-black font-mono text-rose-700 mt-1">{criticalCount}</p>
              <p className="text-[10px] text-rose-600/80 mt-0.5">Score &lt; 70, flagged, or critical alert</p>
            </button>

            <button
              onClick={() => setTierFilter('MODERATE_MEDIUM')}
              className={`p-3.5 rounded-xl border text-left transition ${
                tierFilter === 'MODERATE_MEDIUM'
                  ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
                <span>Moderate Review</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-xl font-black font-mono text-amber-700 mt-1">{moderateCount}</p>
              <p className="text-[10px] text-amber-600/80 mt-0.5">Score 70-89, deficiencies, missing docs</p>
            </button>

            <button
              onClick={() => setTierFilter('ROUTINE_CLEARANCE')}
              className={`p-3.5 rounded-xl border text-left transition ${
                tierFilter === 'ROUTINE_CLEARANCE'
                  ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
                <span>Routine Clearance</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl font-black font-mono text-emerald-700 mt-1">{routineCount}</p>
              <p className="text-[10px] text-emerald-600/80 mt-0.5">Score &ge; 90, verified clean filings</p>
            </button>
          </div>

          {/* Queue Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search application # or college..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadQueue()}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-semibold"
              >
                <option value="ALL">All Priority Tiers</option>
                <option value="CRITICAL_HIGH">Critical Priority (Score &lt; 70 / Tamper)</option>
                <option value="MODERATE_MEDIUM">Moderate Review (70 - 89)</option>
                <option value="ROUTINE_CLEARANCE">Routine Clearance (&ge; 90)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="DEFICIENT">Deficient</option>
                <option value="FLAGGED">Flagged</option>
                <option value="APPROVED">Approved</option>
                <option value="DRAFT">Draft Filings</option>
              </select>

              {(tierFilter !== 'ALL' || statusFilter !== 'ALL' || searchTerm.trim()) && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-blue-700 hover:text-blue-900 font-medium px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition"
                >
                  Reset Filters
                </button>
              )}
            </div>

            <button
              onClick={loadQueue}
              disabled={queueLoading}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${queueLoading ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh Queue</span>
            </button>
          </div>

          {/* Queue Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Priority Tier</th>
                    <th className="py-3 px-4">Application Details</th>
                    <th className="py-3 px-4">Triage Score</th>
                    <th className="py-3 px-4">Authenticity Screening</th>
                    <th className="py-3 px-4">Compliance Status</th>
                    <th className="py-3 px-4">Correction Notice</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queueItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 px-6">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                            <Layers className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">
                              {queueLoading ? 'Loading prioritized scrutiny queue...' : 'No applications match filter criteria'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                              {queueLoading
                                ? 'Fetching live statutory assessments from registry...'
                                : `No applications found matching tier '${tierFilter}' and status '${statusFilter}'. Only applications requiring scrutiny (SUBMITTED, DEFICIENT, or FLAGGED) appear in active triage. Unsubmitted draft applications remain with applicants.`}
                            </p>
                          </div>
                          {!queueLoading && (
                            <div className="flex items-center justify-center gap-2 pt-2">
                              <button
                                onClick={handleResetFilters}
                                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs"
                              >
                                View All Eligible Cases
                              </button>
                              <button
                                onClick={loadQueue}
                                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
                              >
                                Refresh Queue
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    queueItems.map((item) => {
                      const isCritical = item.priority_tier === 'CRITICAL_HIGH';
                      const isModerate = item.priority_tier === 'MODERATE_MEDIUM';

                      return (
                        <tr
                          key={item.application_id}
                          className={`hover:bg-blue-50/40 transition cursor-pointer ${
                            currentApplication?.id === item.application_id ? 'bg-blue-50/70' : ''
                          }`}
                          onClick={() => handleSelectFromQueue(item.application_id)}
                        >
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                isCritical
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : isModerate
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {isCritical ? (
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                              ) : isModerate ? (
                                <Clock className="w-3 h-3 text-amber-600" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              )}
                              <span>
                                {isCritical
                                  ? 'CRITICAL / URGENT'
                                  : isModerate
                                  ? 'MODERATE REVIEW'
                                  : 'ROUTINE CLEARANCE'}
                              </span>
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900">{item.application_number}</span>
                              <StatusBadge status={item.status as any} />
                            </div>
                            <p className="text-slate-700 font-medium truncate max-w-xs">{item.institution_name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{item.program_name}</p>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-black font-mono ${
                                  item.composite_score < 70
                                    ? 'text-rose-700'
                                    : item.composite_score < 90
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {item.composite_score}
                              </span>
                              <span className="text-[10px] text-slate-400">/ 100</span>
                            </div>
                            <span className="text-[10px] text-slate-500">
                              Auth: {item.authenticity_score} | Comp: {item.completeness_score}
                            </span>
                          </td>

                          {/* Authenticity Pill with separate distinction */}
                          <td className="py-3 px-4">
                            {item.authenticity_flags_count > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <ShieldAlert className="w-3 h-3 text-rose-600" />
                                <span>{item.authenticity_flags_count} Authenticity Alert(s)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>Authentic & Signed</span>
                              </span>
                            )}
                          </td>

                          {/* Compliance Pill */}
                          <td className="py-3 px-4">
                            {item.regulatory_flags_count > 0 || item.missing_documents.length > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>
                                  {item.missing_documents.length > 0
                                    ? `${item.missing_documents.length} Missing Doc`
                                    : `${item.regulatory_flags_count} Deficiencies`}
                                </span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Norms Satisfied</span>
                              </span>
                            )}
                          </td>

                          {/* Correction Notice Status */}
                          <td className="py-3 px-4">
                            {item.correction_status ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  item.correction_status === 'OPEN'
                                    ? 'bg-amber-100 text-amber-800'
                                    : item.correction_status === 'ACCEPTED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {item.correction_status}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectFromQueue(item.application_id);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-800 hover:bg-blue-100 transition inline-flex items-center gap-1"
                            >
                              <span>Scrutinize</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 2: SCRUTINY WORKBENCH & DECISION ENGINE                  */}
      {/* ============================================================== */}
      {screenView === 'workbench' && (
        <div className="space-y-6">
          {!currentApplication ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400">
              <FileCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold">No application selected.</p>
              <p className="text-xs text-slate-400 mt-1">Please select an application from the Prioritized Queue tab or registry.</p>
              <button
                onClick={() => setScreenView('queue')}
                className="mt-4 px-4 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold"
              >
                Open Prioritized Queue
              </button>
            </div>
          ) : (
            <>
              {/* Active Application Info Header with Quick Application Switcher */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-black text-lg text-slate-900">
                      {currentApplication.application_number}
                    </span>
                    <StatusBadge status={currentApplication.status} />

                    {/* Quick Switcher Dropdown */}
                    {applications.length > 1 && (
                      <div className="inline-flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200">
                        <span className="text-[11px] text-slate-400 font-medium">Switch:</span>
                        <select
                          value={currentApplication.id}
                          onChange={(e) => {
                            onSelectApplication(e.target.value);
                          }}
                          className="text-xs font-mono font-semibold text-blue-900 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
                        >
                          {applications.map((app) => (
                            <option key={app.id} value={app.id}>
                              {app.application_number} ({app.status}) — {app.institution_name?.substring(0, 24)}...
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-800">
                    {currentApplication.institution_name} • {currentApplication.program_name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Category: {currentApplication.institution_type} | Submitted: {currentApplication.submitted_at ? new Date(currentApplication.submitted_at).toLocaleDateString() : 'Draft Mode'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={loadHistory}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs"
                  >
                    <History className="w-3.5 h-3.5 text-blue-600" />
                    <span>Application History</span>
                  </button>

                  <button
                    onClick={() => setShowCorrectionModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 text-xs font-semibold text-amber-900 flex items-center gap-1.5 shadow-2xs"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-700" />
                    <span>Issue Correction Notice</span>
                  </button>

                  <button
                    onClick={() => onViewReport(currentApplication.id)}
                    className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-xs font-semibold text-white flex items-center gap-1.5 shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Official Dossier</span>
                  </button>
                </div>
              </div>

              {/* Success Banner */}
              {decisionSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{decisionSuccessMsg}</span>
                </div>
              )}

              {/* 2-Column Scrutiny Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1 & 2: Analytical Pillars & Evidence */}
                <div className="lg:col-span-2 space-y-5">
                  {/* ======================================================== */}
                  {/* PILLAR 1: DOCUMENT AUTHENTICITY SCREENING               */}
                  {/* (Separate Hash Duplicate Detection vs Image Forensics)  */}
                  {/* ======================================================== */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-purple-600" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Pillar 1: Document Authenticity Screening
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono text-purple-700 font-semibold">
                        Score: {currentApplication.summary?.authenticity_score ?? 100} / 100
                      </span>
                    </div>

                    {/* SUB-SECTION 1A: Hash-Based Duplicate File Collisions */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Hash className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Cryptographic Hash-Based Duplicate Detection (SHA-256)</span>
                      </div>

                      {hashDuplicateFindings.length === 0 ? (
                        <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Zero duplicate file collisions detected. Unique SHA-256 cryptographic fingerprints across registry.</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-lg text-[11px] text-indigo-900 leading-relaxed">
                            <span className="font-bold">Cryptographic Interpretation:</span> Exact SHA-256 match indicates identical binary file content submitted in multiple applications or re-uploaded. <strong>An identical hash confirms file replication; it does not indicate pixel-level image tampering or document modification.</strong>
                          </div>

                          {hashDuplicateFindings.map((f) => (
                            <div
                              key={f.id}
                              className="p-3 rounded-lg bg-indigo-50/50 border border-indigo-200 text-xs flex justify-between items-start gap-3"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-indigo-900">{f.rule_code}</span>
                                  <span className="bg-indigo-200 text-indigo-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                    DUPLICATE FILE MATCH
                                  </span>
                                </div>
                                <p className="font-semibold text-slate-900 mt-1">{f.title}</p>
                                <p className="text-slate-600 mt-0.5">{f.description}</p>
                                {f.evidence_quote && (
                                  <p className="font-mono text-[10px] text-indigo-700 mt-1 bg-white p-1 rounded border border-indigo-100">
                                    Evidence: {f.evidence_quote}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => setSelectedFindingForOverride(f)}
                                className="px-2.5 py-1 text-[11px] rounded bg-white hover:bg-slate-100 border border-slate-200 font-semibold text-slate-700 shrink-0"
                              >
                                Review / Waive
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SUB-SECTION 1B: Image Forensics & Pixel Manipulation (ELA & Noise) */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <ImageIcon className="w-3.5 h-3.5 text-rose-600" />
                        <span>Image Forensics & Splicing Indicators (Error Level Analysis / ELA)</span>
                      </div>

                      {imageForensicFindings.length === 0 ? (
                        <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>No localized pixel compression variance, splicing artifacts, or graphic editor footprints detected.</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {imageForensicFindings.map((f) => (
                            <div
                              key={f.id}
                              className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs flex justify-between items-start gap-3"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-rose-900">{f.rule_code}</span>
                                  <span className="bg-rose-200 text-rose-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                    {f.severity}
                                  </span>
                                </div>
                                <p className="font-semibold text-slate-900 mt-1">{f.title}</p>
                                <p className="text-slate-600 mt-0.5">{f.description}</p>
                                {f.evidence_quote && (
                                  <p className="font-mono text-[10px] text-rose-800 mt-1 bg-white p-1 rounded border border-rose-100">
                                    Forensic Indicators: {f.evidence_quote}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => setSelectedFindingForOverride(f)}
                                className="px-2.5 py-1 text-[11px] rounded bg-white hover:bg-slate-100 border border-slate-200 font-semibold text-slate-700 shrink-0"
                              >
                                Review / Waive
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Uncertainty & Inconclusive Evidence Guidance */}
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-500 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>Forensic Interpretation Protocol:</strong> Automated ELA scores evaluate relative compression variance. Inconclusive readings or baseline noise must not be treated as proof of fraud; physical verification is required under AICTE SOPs.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ======================================================== */}
                  {/* PILLAR 2: APPLICATION COMPLETENESS & INVENTORY           */}
                  {/* ======================================================== */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-blue-600" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Pillar 2: Application Completeness & Inventory
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono text-blue-700 font-semibold">
                        Score: {currentApplication.summary?.completeness_score ?? 0} / 100
                      </span>
                    </div>

                    {compFindings.length === 0 ? (
                      <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        All mandatory filings complete and cross-document acreage matches.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {compFindings.map((f) => (
                          <div
                            key={f.id}
                            className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs flex justify-between items-start gap-3"
                          >
                            <div>
                              <span className="font-mono font-bold text-amber-900">{f.rule_code}</span>
                              <p className="font-semibold text-slate-900 mt-1">{f.title}</p>
                              <p className="text-slate-600 mt-0.5">{f.description}</p>
                            </div>
                            <button
                              onClick={() => setSelectedFindingForOverride(f)}
                              className="px-2.5 py-1 text-[11px] rounded bg-white hover:bg-slate-100 border border-slate-200 font-semibold text-slate-700 shrink-0"
                            >
                              Review / Waive
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ======================================================== */}
                  {/* PILLAR 3: GROUNDED REGULATORY COMPLIANCE                */}
                  {/* ======================================================== */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Pillar 3: Grounded Regulatory Compliance (AICTE APH)
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono text-indigo-700 font-semibold">
                        Score: {currentApplication.summary?.compliance_score ?? 0} / 100
                      </span>
                    </div>

                    {regFindings.length === 0 ? (
                      <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        All statutory norms evaluated and verified against handbook clauses.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {regFindings.map((f) => (
                          <div
                            key={f.id}
                            className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex justify-between items-start gap-3"
                          >
                            <div>
                              <span className="font-mono font-bold text-indigo-900">{f.rule_code}</span>
                              <p className="font-semibold text-slate-900 mt-1">{f.title}</p>
                              <p className="text-slate-600 mt-0.5">{f.description}</p>
                            </div>
                            <button
                              onClick={() => setSelectedFindingForOverride(f)}
                              className="px-2.5 py-1 text-[11px] rounded bg-white hover:bg-slate-100 border border-slate-200 font-semibold text-slate-700 shrink-0"
                            >
                              Review / Waive
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Uploaded Documents List with Secure Token Preview */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                      Uploaded Documents & Evidence Files ({currentApplication.documents?.length || 0})
                    </h3>
                    {(currentApplication.documents || []).length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">No documents uploaded for this application.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(currentApplication.documents || []).map((doc) => (
                          <div
                            key={doc.id}
                            className="p-2.5 border border-slate-200 rounded-lg flex items-center justify-between text-xs hover:bg-slate-50 transition"
                          >
                            <div className="truncate mr-2">
                              <span className="font-mono font-semibold text-blue-900 block truncate">
                                {doc.file_name}
                              </span>
                              <span className="text-[10px] text-slate-500">{doc.document_type}</span>
                            </div>
                            <button
                              onClick={() => handlePreviewDoc(doc.id)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1 shrink-0"
                            >
                              <Eye className="w-3 h-3 text-slate-500" />
                              <span>Preview</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 3: Authorized Human Decision Engine */}
                <div className="space-y-5">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Scale className="w-4 h-4 text-blue-700" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Authorized Scrutiny Decision
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-slate-700">Determination</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setDecisionType('APPROVED')}
                          className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                            decisionType === 'APPROVED'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          APPROVED
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecisionType('DEFICIENT')}
                          className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                            decisionType === 'DEFICIENT'
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          DEFICIENT
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecisionType('FLAGGED')}
                          className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                            decisionType === 'FLAGGED'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          FLAGGED
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Statutory Scrutiny Remarks <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          rows={3}
                          value={decisionRemarks}
                          onChange={(e) => setDecisionRemarks(e.target.value)}
                          placeholder={
                            decisionType === 'APPROVED'
                              ? 'State statutory grounds for unconditional approval...'
                              : 'State grounds of deficiency, specific clauses violated, or referral reasons...'
                          }
                          className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Stipulated Conditions Precedent (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={conditionsText}
                          onChange={(e) => setConditionsText(e.target.value)}
                          placeholder="Enter mandatory conditions (one per line)..."
                          className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={sopAcknowledged}
                            onChange={(e) => setSopAcknowledged(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>
                            I confirm this determination is based on verified statutory review under AICTE Approval Process Handbook (2026-2027) SOPs.
                          </span>
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={handleInitiateDecision}
                        disabled={!sopAcknowledged || isSubmitting}
                        className="w-full py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Review & Sign Determination</span>
                      </button>

                      <p className="text-[10px] text-slate-400 text-center">
                        Generates immutable chained audit event with SHA-256 digital seal.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 0: CONFIRM STATUTORY DETERMINATION                       */}
      {/* ============================================================== */}
      {showConfirmModal && currentApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Scale className="w-5 h-5 text-blue-700" />
              <h3 className="text-base font-bold text-slate-900">Confirm Statutory Determination</h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <p className="text-slate-500">Target Application:</p>
                <p className="font-mono font-bold text-slate-900">{currentApplication.application_number}</p>
                <p className="text-slate-700 font-medium">{currentApplication.institution_name}</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <p className="text-slate-500">Determination Type:</p>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${
                    decisionType === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : decisionType === 'DEFICIENT'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {decisionType}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <p className="text-slate-500">Statutory Remarks:</p>
                <p className="text-slate-800 italic">{decisionRemarks || 'None provided'}</p>
              </div>

              {conditionsText.trim() && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <p className="text-slate-500">Conditions Precedent:</p>
                  <p className="text-slate-800 font-mono text-[11px] whitespace-pre-wrap">{conditionsText.trim()}</p>
                </div>
              )}

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px] leading-relaxed">
                <strong>Legal Non-Repudiation Notice:</strong> Confirming this action generates an immutable chained audit event with your authorized employee credentials and a SHA-256 cryptographic seal.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDecisionSubmit}
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing & Sealing...</span>
                  </>
                ) : (
                  <>
                    <BadgeCheck className="w-3.5 h-3.5" />
                    <span>Confirm & Sign Determination</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: REQUEST-CORRECTION WORKFLOW                          */}
      {/* ============================================================== */}
      {showCorrectionModal && currentApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-600" />
              <span>Issue Deficiency Notice to Applicant</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Target Application: <span className="font-mono font-semibold">{currentApplication.application_number}</span>
            </p>

            <form onSubmit={handleCorrectionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Remediation Instructions for Applicant
                </label>
                <textarea
                  rows={4}
                  value={correctionInstructions}
                  onChange={(e) => setCorrectionInstructions(e.target.value)}
                  placeholder="Detail the exact corrections needed (e.g. submit renewed Fire Safety Certificate from SDMA, clarify acreage discrepancy on master plan)..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remediation Window (Calendar Days)</label>
                <input
                  type="number"
                  min={3}
                  max={60}
                  value={correctionDeadline}
                  onChange={(e) => setCorrectionDeadline(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed">
                <strong>Statutory Notice:</strong> Submitting this notice transitions the application status to{' '}
                <span className="font-bold underline">DEFICIENT</span> and notifies the applicant portal. All requested
                items will be recorded in the audit trail.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correctionSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs"
                >
                  {correctionSubmitting ? 'Issuing...' : 'Issue Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: OVERRIDE FINDING (ORIGINAL FINDING PRESERVED)          */}
      {/* ============================================================== */}
      {selectedFindingForOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Override Compliance Finding: <span className="font-mono text-blue-900">{selectedFindingForOverride.rule_code}</span>
            </h3>
            <p className="text-xs text-slate-500 mb-3">{selectedFindingForOverride.title}</p>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 mb-3 font-mono">
              Original Detection: {selectedFindingForOverride.finding_status} ({selectedFindingForOverride.severity})
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Review Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-semibold"
                >
                  <option value="WAIVED">WAIVED (Statutory exemption or physical verification granted)</option>
                  <option value="RESOLVED">RESOLVED (Satisfied by applicant remediation)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reviewer Justification (Mandatory)</label>
                <textarea
                  rows={3}
                  value={overrideJustification}
                  onChange={(e) => setOverrideJustification(e.target.value)}
                  placeholder="State the statutory grounds or verified physical documentation supporting this waiver..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-blue-900 text-[10px]">
                <strong>Integrity Guarantee:</strong> The original automated failure is retained in the historical audit
                dossier. This override records your identity, timestamp, and justification.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedFindingForOverride(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOverrideSubmit}
                  disabled={overrideLoading || !overrideJustification.trim()}
                  className="px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 text-white font-semibold"
                >
                  {overrideLoading ? 'Recording...' : 'Record Override'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DRAWER: APPLICATION LIFECYCLE HISTORY TIMELINE                 */}
      {/* ============================================================== */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-700" />
                <h3 className="text-base font-bold text-slate-900">Application Lifecycle Timeline</h3>
              </div>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {historyLoading ? (
              <p className="text-xs text-slate-400 text-center py-10">Loading history events...</p>
            ) : historyEvents.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">No events recorded for this application.</p>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200">
                {historyEvents.map((ev, idx) => (
                  <div key={idx} className="relative flex items-start gap-3 pl-6 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white absolute left-2 top-1.5 -translate-x-1/2" />
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{ev.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(ev.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Actor: <span className="font-semibold">{ev.actor_name || 'System Core'}</span> ({ev.actor_role})
                      </p>
                      {ev.diff_summary && Object.keys(ev.diff_summary).length > 0 && (
                        <p className="text-[10px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200 truncate">
                          {JSON.stringify(ev.diff_summary)}
                        </p>
                      )}
                      {ev.sha256_hash && (
                        <p className="text-[9px] font-mono text-blue-700 truncate" title={ev.sha256_hash}>
                          SHA-256: {ev.sha256_hash}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: TIME-LIMITED SECURE DOCUMENT PREVIEW                  */}
      {/* ============================================================== */}
      {previewDocId && previewToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col p-4 border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                <span>HMAC Secure Token Document Preview (Expires in 15 mins)</span>
              </span>
              <button
                onClick={() => {
                  setPreviewDocId(null);
                  setPreviewToken(null);
                }}
                className="p-1 rounded text-slate-400 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 mt-2 bg-slate-100 rounded-lg overflow-hidden">
              <iframe
                src={getDocumentPreviewUrl(previewDocId, previewToken)}
                className="w-full h-full border-none"
                title="Document Secure Viewer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
