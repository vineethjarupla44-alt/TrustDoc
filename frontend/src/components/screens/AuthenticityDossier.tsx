import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, ShieldAlert, Key, QrCode, Hash, FileCode, CheckCircle2,
  AlertOctagon, AlertTriangle, Eye, HelpCircle, Layers, ChevronDown,
  ChevronUp, ImageIcon, FileText, Check, X, ShieldX, Sparkles, Info
} from 'lucide-react';
import type { ApplicationDetail, Language, AuthenticityCheckItem, AuthenticityStateType, DocumentForensics } from '../../types';
import { DocumentViewer } from '../common/DocumentViewer';
import { fetchDocumentForensics, getDocumentHeatmapUrl } from '../../services/api';

interface AuthenticityDossierProps {
  application: ApplicationDetail | null;
  language?: Language;
  onRefresh?: () => void;
  onNavigateToFindings?: () => void;
}

export const AuthenticityDossier: React.FC<AuthenticityDossierProps> = ({
  application,
}) => {
  const documents = application?.documents || [];
  const [selectedDocId, setSelectedDocId] = useState<string>(documents[0]?.id || '');
  const [activeDocForensics, setActiveDocForensics] = useState<DocumentForensics | null>(null);
  const [loadingForensics, setLoadingForensics] = useState<boolean>(false);
  const [expandedCheckCode, setExpandedCheckCode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'side_by_side' | 'heatmap_only' | 'original_only'>('side_by_side');

  const activeDoc = documents.find((d) => d.id === selectedDocId) || documents[0];

  useEffect(() => {
    if (!activeDoc) return;
    
    if (activeDoc.forensics?.screening_results && activeDoc.forensics.screening_results.length > 0) {
      setActiveDocForensics(activeDoc.forensics);
    } else {
      setLoadingForensics(true);
      fetchDocumentForensics(activeDoc.id)
        .then((data) => {
          setActiveDocForensics(data);
          if (data.screening_results && data.screening_results.length > 0) {
            setExpandedCheckCode(data.screening_results[0].check_code);
          }
        })
        .catch(() => {
          setActiveDocForensics(activeDoc.forensics || null);
        })
        .finally(() => setLoadingForensics(false));
    }
  }, [activeDoc?.id]);

  if (!application) {
    return (
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center text-[#64748B] max-w-7xl mx-auto m-6">
        No application selected.
      </div>
    );
  }

  const forensics = activeDocForensics || activeDoc?.forensics;
  const isHighRisk = forensics?.risk_level === 'HIGH';
  const isMediumRisk = forensics?.risk_level === 'MEDIUM';

  const renderStateBadge = (state: AuthenticityStateType | string) => {
    switch (state) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            VERIFIED
          </span>
        );
      case 'SUSPICIOUS_INDICATOR':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
            SUSPICIOUS
          </span>
        );
      case 'MISMATCH':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-800 border border-red-300">
            <AlertOctagon className="w-3.5 h-3.5 mr-1 text-red-700" />
            MISMATCH
          </span>
        );
      case 'NEEDS_MANUAL_REVIEW':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <Eye className="w-3.5 h-3.5 mr-1 text-amber-700" />
            NEEDS REVIEW
          </span>
        );
      case 'UNAVAILABLE':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-[#64748B] border border-slate-300">
            <HelpCircle className="w-3.5 h-3.5 mr-1 text-slate-400" />
            UNAVAILABLE
          </span>
        );
    }
  };

  const getCheckIcon = (code: string) => {
    switch (code) {
      case 'AUTH_HASH_COLLISION':
        return <Hash className="w-4 h-4 text-blue-600" />;
      case 'AUTH_FORMAT_INTEGRITY':
        return <FileCode className="w-4 h-4 text-indigo-600" />;
      case 'AUTH_METADATA_ANALYSIS':
        return <Layers className="w-4 h-4 text-purple-600" />;
      case 'AUTH_ELA_COMPRESSION':
        return <ImageIcon className="w-4 h-4 text-pink-600" />;
      case 'AUTH_OPENCV_INSPECTION':
        return <Eye className="w-4 h-4 text-cyan-600" />;
      case 'AUTH_QR_TRUST_VERIFY':
        return <QrCode className="w-4 h-4 text-amber-600" />;
      case 'AUTH_DIGITAL_SIG_PKI':
        return <Key className="w-4 h-4 text-emerald-600" />;
      default:
        return <FileText className="w-4 h-4 text-slate-600" />;
    }
  };

  const checks: AuthenticityCheckItem[] = forensics?.screening_results || [];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 text-[#111827]">
      {/* Top Banner with Forensic Notice & Strict Legal Guardrails */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase font-extrabold text-[#64748B] tracking-wider">
              Forensic Integrity Dossier
            </span>
            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-blue-50 text-[#1D4ED8] rounded-full border border-blue-200">
              Multi-Layer Non-Destructive Screening
            </span>
            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              TrustDoc Statutory Standard
            </span>
          </div>
          <h2 className="text-lg font-extrabold text-[#111827] mt-1.5 tracking-tight">
            Institutional Document Authenticity & Forensic Analysis
          </h2>
          <p className="text-xs text-[#64748B] mt-1 max-w-3xl leading-relaxed">
            Cryptographic SHA-256 fingerprinting, binary format magic bytes, PDF/EXIF authoring metadata, genuine ELA recompression, OpenCV sensor noise, unsimulated QR anchors, and PKI trust chains.
          </p>
        </div>

        {/* Legal Disclaimer Box */}
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-950 max-w-md leading-relaxed shrink-0">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-950">Statutory Scrutiny Standard: </strong>
              Algorithmic screening tools (ELA, metadata tags, OpenCV noise variance, or AI models) <span className="font-semibold underline">cannot independently prove forgery</span>. They identify technical anomalies and software footprints to guide human reviewer inspection. Official government verification is never simulated.
            </div>
          </div>
        </div>
      </div>

      {/* Document Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {documents.map((d) => {
          const docRisk = d.forensics?.risk_level || 'LOW';
          const isSelected = activeDoc?.id === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedDocId(d.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 whitespace-nowrap ${
                isSelected
                  ? 'bg-[#0B1220] text-white border-[#0B1220] shadow-sm'
                  : 'bg-white text-[#64748B] hover:text-[#111827] border-[#E2E8F0] hover:bg-[#F4F7FB]'
              }`}
            >
              <span>{d.document_type.replace('_', ' ')}</span>
              {docRisk === 'HIGH' && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="High Risk" />
              )}
              {docRisk === 'MEDIUM' && (
                <span className="w-2 h-2 rounded-full bg-amber-500" title="Medium Risk" />
              )}
              {docRisk === 'LOW' && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Low Risk" />
              )}
            </button>
          );
        })}
      </div>

      {activeDoc ? (
        <div className="space-y-6">
          {/* Executive Forensic Summary Card */}
          <div className={`p-5 rounded-2xl border ${
            isHighRisk
              ? 'bg-rose-50/70 border-rose-300 text-rose-950'
              : isMediumRisk
              ? 'bg-amber-50/70 border-amber-300 text-amber-950'
              : 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {isHighRisk ? (
                  <ShieldX className="w-8 h-8 text-rose-600 shrink-0" />
                ) : isMediumRisk ? (
                  <ShieldAlert className="w-8 h-8 text-amber-600 shrink-0" />
                ) : (
                  <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold">
                      Authenticity Status: {forensics?.risk_level || 'LOW'} RISK
                    </h3>
                    {forensics?.screening_results && forensics.screening_results.length > 0 && (
                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 bg-white/80 rounded-md border border-current">
                        {checks.filter(c => c.state === 'VERIFIED').length}/{checks.length} Checks Clean
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed max-w-4xl text-slate-800">
                    {forensics?.remarks || 'Screening indicates normal, consistent document compression and standard authoring headers.'}
                  </p>
                </div>
              </div>

              {/* SHA-256 Badge */}
              <div className="sm:text-right shrink-0">
                <span className="text-[10px] font-bold text-[#64748B] uppercase block">Document SHA-256</span>
                <span className="font-mono text-xs font-bold text-[#111827] bg-white/90 px-2.5 py-1 rounded-lg border border-[#E2E8F0] block mt-0.5 select-all">
                  {activeDoc.sha256_hash ? `${activeDoc.sha256_hash.slice(0, 18)}...` : 'Calculating...'}
                </span>
              </div>
            </div>
          </div>

          {/* Genuine Forensic Heatmap Viewer (Only shown when mathematically generated) */}
          {forensics?.heatmap_generated ? (
            <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-rose-600" />
                      Algorithmic Anomaly Heatmap
                    </span>
                    <span className="text-xs text-[#64748B]">
                      Generated via localized 8x8 DCT Error Level Analysis (ELA) difference thresholding (&gt; μ + 2.5σ)
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#111827] mt-1.5">
                    Spatial Compression & Splicing Anomaly Overlay
                  </h3>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-[#F4F7FB] p-1 rounded-xl border border-[#E2E8F0] self-start sm:self-auto">
                  <button
                    onClick={() => setViewMode('side_by_side')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                      viewMode === 'side_by_side' ? 'bg-white text-[#111827] shadow-sm font-bold' : 'text-[#64748B] hover:text-[#111827]'
                    }`}
                  >
                    Side-by-Side
                  </button>
                  <button
                    onClick={() => setViewMode('heatmap_only')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                      viewMode === 'heatmap_only' ? 'bg-white text-[#111827] shadow-sm font-bold' : 'text-[#64748B] hover:text-[#111827]'
                    }`}
                  >
                    Heatmap Only
                  </button>
                  <button
                    onClick={() => setViewMode('original_only')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                      viewMode === 'original_only' ? 'bg-white text-[#111827] shadow-sm font-bold' : 'text-[#64748B] hover:text-[#111827]'
                    }`}
                  >
                    Original Only
                  </button>
                </div>
              </div>

              {/* Image Comparison Viewer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(viewMode === 'side_by_side' || viewMode === 'original_only') && (
                  <div className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-[#F4F7FB] flex flex-col">
                    <div className="px-3.5 py-2 bg-slate-100 border-b border-[#E2E8F0] text-xs font-bold text-[#111827] flex items-center justify-between">
                      <span>Original Document Canvas</span>
                      <span className="text-[10px] text-[#64748B] font-normal">{activeDoc.file_name}</span>
                    </div>
                    <div className="h-[380px] w-full">
                      <DocumentViewer
                        documentId={activeDoc.id}
                        fileName={activeDoc.file_name}
                        mimeType={activeDoc.mime_type}
                        heightClass="h-[380px]"
                        showToolbar={false}
                        className="h-full border-0 rounded-none shadow-none"
                      />
                    </div>
                  </div>
                )}

                {(viewMode === 'side_by_side' || viewMode === 'heatmap_only') && (
                  <div className="border border-rose-200 rounded-xl overflow-hidden bg-rose-50/20">
                    <div className="px-3.5 py-2 bg-rose-100/60 border-b border-rose-200 text-xs font-bold text-rose-900 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        JET Colormap Forensic Overlay
                      </span>
                      <span className="text-[10px] text-rose-700 font-normal">Highlighted Anomaly Clusters</span>
                    </div>
                    <div className="p-3 flex items-center justify-center min-h-[360px] bg-slate-900/5 relative">
                      <img
                        src={getDocumentHeatmapUrl(activeDoc.id)}
                        alt="Forensic Heatmap"
                        className="max-h-[380px] w-auto object-contain rounded-lg border border-rose-300 shadow-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 bg-[#F4F7FB] rounded-xl border border-[#E2E8F0] text-xs text-[#64748B] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#111827]">Heatmap Interpretation Guide: </strong>
                  The JET colormap highlights pixels with anomalous error differentials in red and yellow hues. Red boxed regions indicate localized high-frequency clusters where compression history significantly diverges from surrounding text blocks.
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm flex items-center justify-between text-xs text-[#64748B]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong className="text-[#111827]">No Heatmap Generated: </strong>
                  Compression error differentials and optical noise profiles are uniform across the page (below the statistical anomaly trigger threshold).
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#64748B] font-semibold px-2.5 py-0.5 bg-[#F4F7FB] rounded-lg border border-[#E2E8F0]">
                Uniform Compression
              </span>
            </div>
          )}

          {/* Modular Forensic Checks: Expandable Cards with Epistemic Limits */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <div className="border-b border-[#E2E8F0] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#111827]">
                  Comprehensive 7-Layer Forensic Screening & Epistemic Boundaries
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Detailed inspection results with explicit mathematical capabilities and non-claims for each check.
                </p>
              </div>
              <span className="text-xs font-semibold text-[#64748B]">
                Click any check to inspect technical parameters
              </span>
            </div>

            {loadingForensics ? (
              <div className="p-8 text-center text-[#64748B] text-xs">
                Running forensic screening algorithms...
              </div>
            ) : checks.length > 0 ? (
              <div className="space-y-3">
                {checks.map((check) => {
                  const isExpanded = expandedCheckCode === check.check_code;
                  return (
                    <div
                      key={check.check_code}
                      className="border border-[#E2E8F0] rounded-xl overflow-hidden transition"
                    >
                      {/* Check Header Accordion Toggle */}
                      <button
                        onClick={() => setExpandedCheckCode(isExpanded ? null : check.check_code)}
                        className={`w-full p-4 flex items-center justify-between text-left transition ${
                          isExpanded ? 'bg-slate-50 border-b border-[#E2E8F0]' : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs">
                            {getCheckIcon(check.check_code)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#111827]">
                                {check.check_name}
                              </span>
                              <span className="text-[10px] font-mono text-[#64748B]">
                                [{check.check_code}]
                              </span>
                            </div>
                            <p className="text-xs text-[#64748B] mt-0.5 line-clamp-1">
                              {check.explanation}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          {renderStateBadge(check.state)}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Forensic Detail Panel */}
                      {isExpanded && (
                        <div className="p-5 bg-white space-y-4 text-xs">
                          {/* Explanation Quote */}
                          <div className="p-3 bg-[#F4F7FB] rounded-xl border border-[#E2E8F0] text-[#111827] font-medium leading-relaxed">
                            {check.explanation}
                          </div>

                          {/* Epistemic Boundaries */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* What it CAN establish */}
                            <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2">
                              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                                What This Check CAN Establish:
                              </span>
                              <ul className="space-y-1.5 text-[11px] text-emerald-950">
                                {check.can_establish.map((item, idx) => (
                                  <li key={idx} className="flex items-start">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-2 mt-1.5 shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* What it CANNOT establish */}
                            <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
                              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                <X className="w-3.5 h-3.5 text-amber-700" />
                                What This Check CANNOT Establish:
                              </span>
                              <ul className="space-y-1.5 text-[11px] text-amber-950">
                                {check.cannot_establish.map((item, idx) => (
                                  <li key={idx} className="flex items-start">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mr-2 mt-1.5 shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Technical Evidence Breakdown */}
                          {check.evidence && Object.keys(check.evidence).length > 0 && (
                            <div className="border border-[#E2E8F0] rounded-xl p-3.5 bg-[#F4F7FB] space-y-2">
                              <span className="font-bold text-[#111827] block text-[11px] uppercase tracking-wider">
                                Technical Parameters & Verification Evidence
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                                {Object.entries(check.evidence).map(([k, v]) => {
                                  if (k === 'diff_array' || v === null || v === undefined) return null;
                                  return (
                                    <div key={k} className="p-2.5 bg-white rounded-lg border border-[#E2E8F0]">
                                      <span className="text-[#64748B] block text-[10px]">{k}:</span>
                                      <span className="text-[#111827] font-bold break-all">
                                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-[#64748B] text-xs">
                No modular screening results recorded. Run document screening or upload a document.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-[#64748B] text-xs bg-white rounded-2xl border border-[#E2E8F0]">
          No documents available for forensic screening in this application.
        </div>
      )}
    </div>
  );
};
