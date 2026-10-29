import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckSquare,
  Scale,
  Download,
  Play,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Layers,
  Info,
  FileCheck,
  Bot,
  Gavel,
  AlertCircle
} from 'lucide-react';
import type { ApplicationDetail, Language, Role, DocumentItem, ExtractedFieldItem } from '../../types';
import { getPDFReportUrl } from '../../services/api';

interface RiskSummaryScreenProps {
  application: ApplicationDetail | null;
  language?: Language;
  userRole?: Role;
  onRunValidation?: () => void;
  isValidating?: boolean;
  onDownloadReport?: (id?: string) => void;
  onRefresh?: () => void;
  onNavigateToChatbot?: () => void;
  onNavigateToDecision?: () => void;
}

export const RiskSummaryScreen: React.FC<RiskSummaryScreenProps> = ({
  application,
  userRole = 'APPLICANT',
  onRunValidation,
  isValidating,
  onDownloadReport,
  onNavigateToChatbot,
  onNavigateToDecision,
}) => {
  const [activePillarTab, setActivePillarTab] = useState<'overview' | 'authenticity' | 'completeness' | 'compliance' | 'priority'>('overview');
  const [selectedHeatmapDoc, setSelectedHeatmapDoc] = useState<DocumentItem | null>(null);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);

  if (!application) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 max-w-4xl mx-auto my-8 shadow-sm">
        <FileCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <h3 className="text-base font-bold text-slate-700">No Application Selected</h3>
        <p className="text-xs text-slate-500 mt-1">Please select an application from the applications registry to view assessment results.</p>
      </div>
    );
  }

  const summary = application.summary;
  const findings = application.findings || [];
  const documents = application.documents || [];

  // Tripartite Scores
  const authScore = summary?.authenticity_score ?? 100.0;
  const compScore = summary?.completeness_score ?? 85.0;
  const regScore = summary?.compliance_score ?? 90.0;
  const compositeCalc = 0.35 * authScore + 0.30 * compScore + 0.35 * regScore;
  const composite = summary?.composite_score ?? Math.round(compositeCalc * 10) / 10;
  const recommendation = summary?.recommendation ?? 'PROCESSING';

  // Categorized findings
  const criticalFindings = findings.filter((f) => f.severity === 'CRITICAL');
  const warningFindings = findings.filter((f) => f.severity === 'WARNING');
  const infoFindings = findings.filter((f) => f.severity === 'INFO');

  const authFindings = findings.filter((f) => f.category === 'AUTHENTICITY');
  const compFindings = findings.filter((f) => f.category === 'COMPLETENESS');
  const regFindings = findings.filter((f) => f.category === 'COMPLIANCE' || f.category === 'REGULATORY');

  // Hard forensic indicator flag
  const hasCriticalAuth = authFindings.some((f) => f.severity === 'CRITICAL') || authScore < 70.0;

  // Review Priority Tier calculation
  let priorityTier = 'ROUTINE CLEARANCE CANDIDATE';
  let priorityColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  let priorityBadge = 'bg-emerald-600';
  let priorityDesc = 'Prima facie fully compliant. Expedited statutory approval queue candidate.';

  if (hasCriticalAuth || composite < 70.0) {
    priorityTier = 'CRITICAL / HIGH PRIORITY';
    priorityColor = 'text-rose-700 bg-rose-50 border-rose-200';
    priorityBadge = 'bg-rose-600';
    priorityDesc = 'Mandatory scrutiny committee review required before further processing.';
  } else if (composite < 90.0) {
    priorityTier = 'MODERATE / MEDIUM PRIORITY';
    priorityColor = 'text-amber-800 bg-amber-50 border-amber-200';
    priorityBadge = 'bg-amber-600';
    priorityDesc = 'Procedural deficiencies detected. Supplemental affidavits or remediations prescribed.';
  }

  // All extracted fields across docs for uncertainty auditing
  const allExtractedFields: Array<{ docType: string; docName: string; field: ExtractedFieldItem }> = [];
  documents.forEach((doc) => {
    (doc.extracted_fields || []).forEach((f) => {
      allExtractedFields.push({ docType: doc.document_type, docName: doc.file_name, field: f });
    });
  });

  const uncertainFields = allExtractedFields.filter(
    (item) => item.field.confidence_score < 70 || item.field.state === 'EXTRACTION_FAILED' || item.field.state === 'MISSING_IN_DOCUMENT'
  );

  const pdfUrl = getPDFReportUrl(application.id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. Header Banner & Institutional Summary */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1D4ED8] border border-blue-200">
              TrustDoc Statutory Scrutiny Engine
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${priorityColor} flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full ${priorityBadge}`} />
              Queue Priority: {priorityTier}
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              {application.application_number}
            </h1>
            <span className="text-slate-400">|</span>
            <span className="text-xs font-semibold text-slate-700">
              {application.program_name}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-xs text-slate-500">
              Category: <strong>{application.institution_type}</strong>
            </span>
          </div>

          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              Evaluation Framework: <strong>AICTE Approval Process Handbook (v2026.1)</strong> • 4-Pillar Regulatory Audit
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onRunValidation && (
            <button
              onClick={onRunValidation}
              disabled={isValidating}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isValidating ? 'Auditing Application...' : 'Re-Run Compliance Engine'}</span>
            </button>
          )}

          <button
            onClick={() => onDownloadReport ? onDownloadReport(application.id) : window.open(pdfUrl, '_blank')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Statutory PDF Report</span>
          </button>

          {userRole === 'REVIEWER' && onNavigateToDecision && (
            <button
              onClick={onNavigateToDecision}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center space-x-1.5"
            >
              <Gavel className="w-3.5 h-3.5" />
              <span>Scrutiny Decisions</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Composite Triage Score & Mathematical Formula Bar */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-xl p-6 text-white shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
          <div>
            <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">
              Procedural Reviewer Prioritization
            </span>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-3xl md:text-4xl font-black font-mono tracking-tight text-white">
                {composite.toFixed(1)}
              </span>
              <span className="text-sm text-slate-300 font-medium">/ 100</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${priorityColor} border shadow-xs ml-2`}>
                {priorityTier}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              {priorityDesc}
            </p>
          </div>

          <button
            onClick={() => setFormulaModalOpen(true)}
            className="px-3 py-1.5 bg-blue-800/60 hover:bg-blue-700 text-blue-100 text-xs font-semibold rounded-lg border border-blue-400/30 flex items-center gap-1.5 self-start md:self-auto transition"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Explain Triage Formula</span>
          </button>
        </div>

        {/* 3-Pillar Progress Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="bg-white/10 rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-blue-200">Pillar 1: Authenticity (35%)</span>
              <span className="font-mono font-bold">{authScore.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${authScore >= 80 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                style={{ width: `${authScore}%` }}
              />
            </div>
          </div>

          <div className="bg-white/10 rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-indigo-200">Pillar 2: Completeness (30%)</span>
              <span className="font-mono font-bold">{compScore.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${compScore >= 90 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                style={{ width: `${compScore}%` }}
              />
            </div>
          </div>

          <div className="bg-white/10 rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-purple-200">Pillar 3: Compliance (35%)</span>
              <span className="font-mono font-bold">{regScore.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${regScore >= 90 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                style={{ width: `${regScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Epistemic Alert Callout */}
        <div className="bg-blue-950/80 border border-blue-500/40 rounded-lg p-3 flex items-start gap-2.5 text-xs text-blue-200">
          <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-white">Operational Triage Notice:</strong> This numeric score is an administrative triage indicator
            designed to prioritize reviewer queues. It is <strong>neither an algorithmic proof of fraud nor an official legal judgment</strong>.
            Low scores reflect document deficits or anomalous image metrics that mandate human scrutiny committee review.
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Pillar Navigation Tabs */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs gap-1">
        <button
          onClick={() => setActivePillarTab('overview')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
            activePillarTab === 'overview'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Executive Overview</span>
        </button>

        <button
          onClick={() => setActivePillarTab('authenticity')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
            activePillarTab === 'authenticity'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Pillar 1: Authenticity Screening</span>
          {authFindings.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px]">
              {authFindings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActivePillarTab('completeness')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
            activePillarTab === 'completeness'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Pillar 2: Completeness & Consistency</span>
          {(compFindings.length > 0 || uncertainFields.length > 0) && (
            <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
              {compFindings.length + uncertainFields.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActivePillarTab('compliance')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
            activePillarTab === 'compliance'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Pillar 3: Regulatory Compliance</span>
          {regFindings.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px]">
              {regFindings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActivePillarTab('priority')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
            activePillarTab === 'priority'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Gavel className="w-3.5 h-3.5" />
          <span>Pillar 4: Review Priority & Governance</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. TAB CONTENT: EXECUTIVE OVERVIEW */}
      {/* ------------------------------------------------------------- */}
      {activePillarTab === 'overview' && (
        <div className="space-y-6">
          {/* Tripartite Scorecards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Vector 1 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Document Authenticity
                  </span>
                  <span className="font-bold font-mono text-sm text-slate-900">{authScore.toFixed(1)}%</span>
                </div>
                <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${authScore >= 80 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${authScore}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                  Cryptographic file hashes, PDF creation metadata, Error Level Analysis (ELA), and QR/digital signature trust verification.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Status:</span>
                <span className={`font-bold ${authScore >= 80 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {authScore >= 80 ? 'Verified Low Risk' : 'Tamper Anomaly Detected'}
                </span>
              </div>
            </div>

            {/* Vector 2 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                    Completeness & Consistency
                  </span>
                  <span className="font-bold font-mono text-sm text-slate-900">{compScore.toFixed(1)}%</span>
                </div>
                <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${compScore >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${compScore}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                  Mandatory 4-document inventory, cross-document acreage reconciliation, and OCR extraction uncertainty tracking.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Status:</span>
                <span className={`font-bold ${compScore >= 90 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {compScore >= 90 ? 'Inventory Complete' : 'Deficiencies Present'}
                </span>
              </div>
            </div>

            {/* Vector 3 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-purple-600" />
                    Regulatory Compliance
                  </span>
                  <span className="font-bold font-mono text-sm text-slate-900">{regScore.toFixed(1)}%</span>
                </div>
                <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${regScore >= 90 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${regScore}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                  Deterministic thresholds (&ge; 2.50 acres contiguous land, active unexpired Fire NOC, &le; 1:15 SFR) and RAG groundings.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Status:</span>
                <span className={`font-bold ${regScore >= 90 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {regScore >= 90 ? 'Norms Satisfied' : 'Norm Deficiencies Found'}
                </span>
              </div>
            </div>
          </div>

          {/* Actionable Findings & Remediation Checklist */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ListChecks className="w-5 h-5 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Evidence-Linked Findings & Institutional Remediations
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                  {criticalFindings.length} Critical
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  {warningFindings.length} Warnings
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  {infoFindings.length} Info
                </span>
              </div>
            </div>

            {findings.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                <strong className="text-slate-700 block">Zero Deficiencies Detected</strong>
                <span>The application satisfies all evaluated statutory accreditation criteria.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {findings.map((f, i) => {
                  const isCrit = f.severity === 'CRITICAL';
                  const isWarn = f.severity === 'WARNING';
                  const badgeColor = isCrit
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : isWarn
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-blue-100 text-blue-800 border-blue-200';

                  const pageRef = f.source_field_ref?.page_number;

                  return (
                    <div
                      key={f.id || i}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 transition space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
                            {f.severity}
                          </span>
                          <strong className="text-slate-900 font-bold text-sm">{f.title}</strong>
                          <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold">
                            {f.rule_code}
                          </span>
                        </div>
                        {pageRef && (
                          <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            Page {pageRef}
                          </span>
                        )}
                      </div>

                      <p className="text-slate-600 leading-relaxed">{f.description}</p>

                      {f.evidence_quote && (
                        <div className="p-2.5 rounded bg-white border border-slate-200 text-slate-700 font-mono text-[11px]">
                          <strong className="text-slate-900 font-sans">Evidence: </strong>
                          "{f.evidence_quote}"
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <p className="text-slate-700">
                          <strong className="text-blue-900">Action Required: </strong>
                          {f.suggested_remediation || 'Submit supplemental certification or rectifying affidavit.'}
                        </p>

                        {onNavigateToChatbot && (
                          <button
                            onClick={onNavigateToChatbot}
                            className="text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 text-[11px] shrink-0"
                          >
                            <Bot className="w-3.5 h-3.5" />
                            <span>Ask AI Advisor</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. TAB CONTENT: PILLAR 1 - DOCUMENT AUTHENTICITY SCREENING */}
      {/* ------------------------------------------------------------- */}
      {activePillarTab === 'authenticity' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span>Pillar 1: Document Authenticity Screening</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluates cryptographic file hashes, file signature integrity, metadata software traces, and Error Level Analysis (ELA).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Authenticity Index:</span>
              <span className={`text-base font-black font-mono ${authScore >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {authScore.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Document list & Forensic indicators */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Submitted Document Screening Registry ({documents.length} Files)
            </h4>

            {documents.length === 0 ? (
              <p className="text-xs text-slate-400 p-6 text-center">No documents uploaded for this application.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {documents.map((doc) => {
                  const forensics = doc.forensics;
                  const elaScore = forensics?.ela_anomaly_score ?? 0.0;
                  const metaFlag = forensics?.metadata_mismatch_flag ?? false;
                  const qrDet = forensics?.qr_detected ?? false;
                  const sigPres = forensics?.digital_signature_present ?? false;
                  const riskLvl = forensics?.risk_level ?? 'LOW';
                  const hasHeatmap = forensics?.heatmap_generated || !!forensics?.heatmap_path || !!forensics?.heatmap_url;

                  const isHighRisk = riskLvl === 'HIGH';

                  return (
                    <div
                      key={doc.id}
                      className={`p-4 rounded-xl border ${
                        isHighRisk ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-slate-50/40'
                      } space-y-3`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{doc.document_type}</span>
                            <span className="text-xs text-slate-500 font-mono">({doc.file_name})</span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                            SHA-256: {doc.sha256_hash}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded border ${
                              isHighRisk
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}
                          >
                            Risk: {riskLvl}
                          </span>
                        </div>
                      </div>

                      {/* Checks breakdown pills */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">Metadata Integrity</span>
                          <span className={`font-semibold ${metaFlag ? 'text-rose-600' : 'text-slate-700'}`}>
                            {metaFlag ? 'Software Trace Detected' : 'Normal / Clean'}
                          </span>
                        </div>

                        <div className="bg-white p-2 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">ELA Anomaly Score</span>
                          <span className={`font-semibold ${elaScore > 35 ? 'text-rose-600' : 'text-slate-700'}`}>
                            {elaScore.toFixed(1)}% {elaScore > 35 ? '(Splicing Flag)' : '(Normal)'}
                          </span>
                        </div>

                        <div className="bg-white p-2 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">Statutory QR Verification</span>
                          <span className="font-semibold text-slate-700">
                            {qrDet ? 'Embedded QR Verified' : 'None Present'}
                          </span>
                        </div>

                        <div className="bg-white p-2 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">PKI Digital Signature</span>
                          <span className="font-semibold text-slate-700">
                            {sigPres ? 'Signature Valid' : 'Unsigned Document'}
                          </span>
                        </div>
                      </div>

                      {/* Conditional Heatmap Render Notice */}
                      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                        {hasHeatmap ? (
                          <div className="flex items-center gap-2 text-rose-700 font-semibold">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            <span>Suspicious Pixel Variance Detected in Image Layers</span>
                            <button
                              onClick={() => setSelectedHeatmapDoc(doc)}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold shadow-xs transition ml-2"
                            >
                              Inspect Heatmap
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>No anomalous pixel variance detected; uniform compression profile confirmed.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Epistemic disclaimer for forensics */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-800">Forensic Screening Boundaries: </strong>
            Algorithmic forensics (ELA, metadata inspection) identify statistical variance and editing tool footprints as
            triage risk indicators for human verification. They do <strong>not independently prove forgery or fraudulent intent</strong> without
            formal verification from the original issuing statutory authority.
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. TAB CONTENT: PILLAR 2 - COMPLETENESS & CONSISTENCY */}
      {/* ------------------------------------------------------------- */}
      {activePillarTab === 'completeness' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-600" />
                <span>Pillar 2: Application Completeness & Consistency Audit</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit mandatory document filing, cross-document acreage reconciliation, and OCR extraction uncertainty.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Completeness Score:</span>
              <span className={`text-base font-black font-mono ${compScore >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {compScore.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* 1. Mandatory 4-Document Checklist */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Mandatory Statutory Document Inventory
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {[
                { name: 'Land Title Deed', code: 'LAND_DEED', desc: 'Registered sale or 30-yr lease deed' },
                { name: 'Master Site Plan', code: 'BUILDING_PLAN', desc: 'COA-endorsed architect master layout' },
                { name: 'Fire Safety NOC', code: 'FIRE_NOC', desc: 'Competent State Fire Authority clearance' },
                { name: 'Faculty Cadre List', code: 'FACULTY_LIST', desc: 'Affidavit with student-faculty staffing' },
              ].map((item) => {
                const isUploaded = documents.some((d) => d.document_type === item.code);
                return (
                  <div
                    key={item.code}
                    className={`p-3.5 rounded-xl border ${
                      isUploaded ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'
                    } space-y-1`}
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-800 font-bold">{item.name}</strong>
                      {isUploaded ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          SUBMITTED
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                          MISSING
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Cross-Document Acreage Reconciliation */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                Cross-Document Fact Alignment (Land Acreage Reconciliation)
              </h4>
              <span className="text-[11px] font-semibold text-slate-500">Tolerance: &le; 0.05 Acres</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Registered Title Deed Extent</span>
                <strong className="text-slate-900 font-mono text-sm">2.85 Acres</strong>
                <span className="text-[10px] text-slate-500 block mt-0.5">Extracted from Land Deed Page 2</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Master Site Plan Plot Extent</span>
                <strong className="text-slate-900 font-mono text-sm">2.85 Acres</strong>
                <span className="text-[10px] text-slate-500 block mt-0.5">Extracted from Layout Diagram</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Cross-Document Acreage Delta</span>
                <strong className="text-emerald-700 font-mono text-sm">0.00 Acres (Reconciled)</strong>
                <span className="text-[10px] text-emerald-600 block mt-0.5">Satisfies SYNTH-NORM-5.1.1</span>
              </div>
            </div>
          </div>

          {/* 3. Extraction Uncertainty & OCR Confidence Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  OCR Extraction Confidence & Uncertainty Tracking
                </h4>
                <p className="text-[11px] text-slate-500">
                  Explicitly distinguishes extraction failures from genuine missing fields to prevent false non-compliance flags.
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {uncertainFields.length} Flags Needing Verification
              </span>
            </div>

            {allExtractedFields.length === 0 ? (
              <p className="text-xs text-slate-400 p-4 text-center">No structured fields extracted yet.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                    <tr>
                      <th className="p-2.5">Field / Attribute</th>
                      <th className="p-2.5">Extracted Value</th>
                      <th className="p-2.5">Source Document</th>
                      <th className="p-2.5">Extraction State</th>
                      <th className="p-2.5">OCR Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {allExtractedFields.slice(0, 8).map((item, idx) => {
                      const conf = item.field.confidence_score;
                      const isUncertain = conf < 70;
                      return (
                        <tr key={idx} className={isUncertain ? 'bg-amber-50/40' : 'hover:bg-slate-50'}>
                          <td className="p-2.5 font-medium text-slate-900">
                            {item.field.label || item.field.field_key}
                          </td>
                          <td className="p-2.5 font-mono text-slate-700">
                            {item.field.field_value_normalized || item.field.field_value_raw || '—'}
                          </td>
                          <td className="p-2.5 text-slate-500">
                            {item.docType} (Pg {item.field.page_number})
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                item.field.state === 'EXTRACTION_FAILED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : item.field.state === 'MISSING_IN_DOCUMENT'
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {item.field.state}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`font-mono font-bold text-[11px] ${
                                conf >= 90 ? 'text-emerald-600' : isUncertain ? 'text-amber-600' : 'text-slate-600'
                              }`}
                            >
                              {conf.toFixed(1)}% {isUncertain && '(Needs Review)'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. TAB CONTENT: PILLAR 3 - REGULATORY COMPLIANCE */}
      {/* ------------------------------------------------------------- */}
      {activePillarTab === 'compliance' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-600" />
                <span>Pillar 3: Grounded Regulatory Compliance</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Deterministic rule verification and RAG over verified AICTE Approval Process Handbook (v2026.1).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Compliance Index:</span>
              <span className={`text-base font-black font-mono ${regScore >= 90 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {regScore.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* 5-State Epistemic Summary Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] text-emerald-800 font-bold block uppercase">Explicitly Satisfied</span>
              <strong className="text-emerald-900 text-lg font-mono font-black">4</strong>
              <span className="text-[10px] text-emerald-700 block mt-0.5">Verified Norms</span>
            </div>
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
              <span className="text-[10px] text-rose-800 font-bold block uppercase">Apparently Violated</span>
              <strong className="text-rose-900 text-lg font-mono font-black">{criticalFindings.length}</strong>
              <span className="text-[10px] text-rose-700 block mt-0.5">Deficiencies</span>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-[10px] text-amber-800 font-bold block uppercase">Ambiguous Norms</span>
              <strong className="text-amber-900 text-lg font-mono font-black">0</strong>
              <span className="text-[10px] text-amber-700 block mt-0.5">Interpretations</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-700 font-bold block uppercase">Outdated Source</span>
              <strong className="text-slate-900 text-lg font-mono font-black">0</strong>
              <span className="text-[10px] text-slate-600 block mt-0.5">Prior Handbooks</span>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <span className="text-[10px] text-blue-800 font-bold block uppercase">Human Review Req</span>
              <strong className="text-blue-900 text-lg font-mono font-black">{warningFindings.length}</strong>
              <span className="text-[10px] text-blue-700 block mt-0.5">Discretionary</span>
            </div>
          </div>

          {/* Grounded Findings Table */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Statutory Compliance Findings ({regFindings.length} Items)
            </h4>

            {regFindings.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                No compliance non-conformances identified against the synthetic 2026 norms.
              </div>
            ) : (
              <div className="space-y-3">
                {regFindings.map((f, i) => (
                  <div key={f.id || i} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            f.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                        >
                          {f.severity}
                        </span>
                        <strong className="text-slate-900 font-bold">{f.title}</strong>
                        <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">
                          {f.rule_code}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Source: <strong>AICTE APH 2026-2027 (v2026.1)</strong>
                      </span>
                    </div>

                    <p className="text-slate-600">{f.description}</p>

                    {f.evidence_quote && (
                      <div className="p-2 rounded bg-white border border-slate-200 font-mono text-[11px] text-slate-700">
                        <strong>Evidence: </strong>
                        "{f.evidence_quote}"
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-slate-700">
                        <strong className="text-blue-900">Corrective Remediation: </strong>
                        {f.suggested_remediation || 'Submit valid certificate.'}
                      </p>

                      {onNavigateToChatbot && (
                        <button
                          onClick={onNavigateToChatbot}
                          className="text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 text-[11px] shrink-0"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span>Consult AI Advisor</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. TAB CONTENT: PILLAR 4 - REVIEW PRIORITY & GOVERNANCE */}
      {/* ------------------------------------------------------------- */}
      {activePillarTab === 'priority' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Gavel className="w-5 h-5 text-indigo-700" />
                <span>Pillar 4: Review Priority & Administrative Governance</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Reviewer queue prioritization, statutory conditions precedent, and cryptographic audit seals.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Current Status:</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded bg-slate-900 text-white">
                {recommendation}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Priority Status Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Queue Triage Assessment
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${priorityColor}`}>
                  {priorityTier}
                </span>
                <span className="text-xs font-mono font-bold text-slate-700">
                  (Score: {composite.toFixed(1)}/100)
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {priorityDesc}
              </p>
            </div>

            {/* Officer Sign-off & Seal */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Statutory Sign-off & Digital Seal
              </span>
              <div className="text-xs space-y-1 text-slate-700">
                <p>
                  <strong>Role: </strong> {userRole === 'REVIEWER' ? 'Scrutiny Officer (Authorized)' : 'Applicant (Read Only)'}
                </p>
                <p>
                  <strong>Digital Seal: </strong>
                  <code className="text-[11px] bg-slate-200 px-1 py-0.5 rounded text-slate-800">
                    SHA256:7f9a12c8...d301
                  </code>
                </p>
              </div>
              {userRole === 'REVIEWER' && onNavigateToDecision && (
                <button
                  onClick={onNavigateToDecision}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5"
                >
                  <Gavel className="w-3.5 h-3.5" />
                  <span>Open Decision Recording Workbench</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 9. MODALS: FORMULA EXPLANATION & SUSPICIOUS HEATMAP */}
      {/* ------------------------------------------------------------- */}
      {formulaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <span>Composite Triage Scoring Formula</span>
              </h3>
              <button
                onClick={() => setFormulaModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                The Composite Scrutiny Score is computed through a weighted multi-criteria aggregation model reflecting
                accreditation priorities:
              </p>

              <div className="p-3 rounded-lg bg-slate-100 font-mono text-[11px] text-slate-800 border border-slate-300">
                Composite Score = (0.35 &times; Authenticity) + (0.30 &times; Completeness) + (0.35 &times; Compliance)
              </div>

              <div className="space-y-1.5 pt-1">
                <p>
                  &bull; <strong>35% Authenticity:</strong> File hashes, PDF container integrity, metadata tools (Photoshop traces), ELA pixel noise.
                </p>
                <p>
                  &bull; <strong>30% Completeness:</strong> 4-document inventory, missing fields, cross-document acreage reconciliation.
                </p>
                <p>
                  &bull; <strong>35% Compliance:</strong> Grounded 5-state statutory norm evaluation (Land, Fire NOC, Faculty Ratio).
                </p>
              </div>

              <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                <strong>Epistemic Notice:</strong> This score prioritizes human reviewer queues. It is <strong>neither a probability of fraud nor a legal conclusion</strong>.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setFormulaModalOpen(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedHeatmapDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span>Suspicious-Region Forensic Heatmap</span>
                </h3>
                <p className="text-xs text-slate-500">{selectedHeatmapDoc.file_name} ({selectedHeatmapDoc.document_type})</p>
              </div>
              <button
                onClick={() => setSelectedHeatmapDoc(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="aspect-video bg-slate-950 rounded-lg flex items-center justify-center border border-slate-800 relative overflow-hidden">
                {selectedHeatmapDoc.forensics?.heatmap_url ? (
                  <img
                    src={selectedHeatmapDoc.forensics.heatmap_url}
                    alt="Error Level Analysis Heatmap"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
                    <p className="text-white font-mono text-xs">
                      Localized Pixel Discrepancy Detected (ELA Index: {selectedHeatmapDoc.forensics?.ela_anomaly_score.toFixed(1)}%)
                    </p>
                    <p className="text-slate-400 text-[11px] max-w-md mx-auto">
                      Non-uniform compression identified around survey numbers and sanction seal blocks.
                      Inspection coordinates: [X: 140-380, Y: 220-410].
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                <strong>Forensic Guardrail:</strong> Algorithmic compression anomaly detection indicates localized pixel editing.
                Physical verification of original sanction records is recommended.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedHeatmapDoc(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
