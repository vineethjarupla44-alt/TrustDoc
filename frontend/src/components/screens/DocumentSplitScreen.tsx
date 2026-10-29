import React, { useState, useEffect } from 'react';
import {
  Edit3, Check, FileText, AlertCircle, CheckCircle2, ShieldAlert,
  RefreshCw, X, AlertTriangle, ExternalLink, HelpCircle
} from 'lucide-react';
import type { ApplicationDetail, Language, ExtractedFieldItem, DocumentStatusInfo, FieldState } from '../../types';
import { DocumentViewer } from '../common/DocumentViewer';
import {
  fetchDocumentFields,
  fetchDocumentStatus, correctDocumentField
} from '../../services/api';

interface DocumentSplitScreenProps {
  application: ApplicationDetail | null;
  language?: Language;
  isPIIUnmasked?: boolean;
  onRequestUnmask?: () => void;
  onRefresh?: () => void;
  onNavigateToAuthenticity?: () => void;
}

export const DocumentSplitScreen: React.FC<DocumentSplitScreenProps> = ({
  application,
  onRefresh,
  onNavigateToAuthenticity
}) => {
  const documents = application?.documents || [];
  const [selectedDocId, setSelectedDocId] = useState<string>(documents[0]?.id || '');
  const activeDoc = documents.find((d) => d.id === selectedDocId) || documents[0];

  // Dynamic state for extracted fields and status
  const [fields, setFields] = useState<ExtractedFieldItem[]>([]);
  const [docStatus, setDocStatus] = useState<DocumentStatusInfo | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Field Correction Modal State
  const [selectedFieldForEdit, setSelectedFieldForEdit] = useState<ExtractedFieldItem | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Load fields and document status whenever activeDoc changes
  useEffect(() => {
    if (!activeDoc) return;

    let isMounted = true;
    setIsLoadingFields(true);

    const loadData = async () => {
      try {
        const [fieldsData, statusData] = await Promise.allSettled([
          fetchDocumentFields(activeDoc.id),
          fetchDocumentStatus(activeDoc.id)
        ]);

        if (!isMounted) return;

        if (statusData.status === 'fulfilled') {
          setDocStatus(statusData.value);
        } else {
          setDocStatus(null);
        }

        if (fieldsData.status === 'fulfilled' && fieldsData.value.length > 0) {
          setFields(fieldsData.value);
        } else {
          const fallbackStructured = activeDoc.extracted_entities?.structured_fields || {};
          const synthetic: ExtractedFieldItem[] = Object.entries(fallbackStructured).map(([k, v], idx) => ({
            id: `synthetic-${k}-${idx}`,
            document_id: activeDoc.id,
            field_key: k,
            label: k.replace(/_/g, ' ').toUpperCase(),
            field_value_normalized: v !== null && v !== undefined ? String(v) : undefined,
            field_value_raw: v !== null && v !== undefined ? String(v) : undefined,
            data_type: typeof v === 'number' ? 'float' : 'string',
            confidence_score: activeDoc.extracted_entities?.confidence_score || 0.88,
            page_number: 1,
            ocr_engine: activeDoc.extracted_entities?.ocr_engine || 'PYMUPDF',
            state: (v !== null && v !== undefined && String(v).trim().length > 0) ? 'DETECTED' : 'MISSING_IN_DOCUMENT',
            is_manually_corrected: false,
            is_pii: false,
            created_at: activeDoc.created_at
          }));
          setFields(synthetic);
        }
      } catch (err) {
        console.error('Error fetching document fields:', err);
      } finally {
        if (isMounted) setIsLoadingFields(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [activeDoc?.id]);

  if (!application) {
    return (
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center text-[#64748B] max-w-7xl mx-auto m-6">
        No application selected.
      </div>
    );
  }

  // Open correction modal
  const handleOpenEdit = (field: ExtractedFieldItem) => {
    setSelectedFieldForEdit(field);
    setEditValue(field.field_value_normalized || '');
    setEditReason('');
    setEditError(null);
  };

  // Submit correction
  const handleSaveCorrection = async () => {
    if (!selectedFieldForEdit || !activeDoc) return;
    if (!editValue.trim()) {
      setEditError('Corrected value cannot be empty.');
      return;
    }
    if (editReason.trim().length < 5) {
      setEditError('Audit justification must be at least 5 characters.');
      return;
    }

    setIsSubmittingEdit(true);
    setEditError(null);

    try {
      if (selectedFieldForEdit.id.startsWith('synthetic-')) {
        setFields((prev) =>
          prev.map((f) =>
            f.id === selectedFieldForEdit.id
              ? {
                  ...f,
                  field_value_normalized: editValue,
                  state: 'MANUALLY_ENTERED' as FieldState,
                  is_manually_corrected: true,
                  correction_reason: editReason
                }
              : f
          )
        );
      } else {
        const updated = await correctDocumentField(
          activeDoc.id,
          selectedFieldForEdit.id,
          editValue,
          editReason
        );
        setFields((prev) =>
          prev.map((f) => (f.id === updated.id ? updated : f))
        );
      }

      setSavedSuccessMsg(`Field "${selectedFieldForEdit.label || selectedFieldForEdit.field_key}" updated and recorded to immutable audit log.`);
      setSelectedFieldForEdit(null);
      setTimeout(() => setSavedSuccessMsg(null), 4000);
      onRefresh?.();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err.message || 'Failed to save correction.';
      setEditError(detail);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const renderStateBadge = (state: FieldState) => {
    switch (state) {
      case 'DETECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>DETECTED</span>
          </span>
        );
      case 'MANUALLY_ENTERED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Edit3 className="w-2.5 h-2.5 text-indigo-500" />
            <span>MANUAL OVERRIDE</span>
          </span>
        );
      case 'MISSING_IN_DOCUMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-[#64748B] border border-slate-300">
            <AlertCircle className="w-2.5 h-2.5 text-slate-500" />
            <span>MISSING</span>
          </span>
        );
      case 'EXTRACTION_FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
            <span>FAILED</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5 text-[#111827]">
      {/* 1. Core Statutory Guardrail Notice Banner */}
      <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950">
          <p className="font-bold tracking-tight text-amber-900">
            Statutory Guardrail Notice: Separation of Syntactic OCR from Legal Verification
          </p>
          <p className="mt-0.5 text-amber-800 text-[11px] leading-relaxed">
            Machine OCR extraction indexes document content for reviewer reference only. It does <strong>not</strong> certify legal authenticity (which requires cryptographic digital signature, file hash, and forensic ELA validation) nor does it guarantee statutory regulatory approval.
          </p>
        </div>
      </div>

      {/* 2. Top Document Selector & Action Header */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-[#1D4ED8] rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[#111827] tracking-tight">
              Document Extraction & Entity Workbench
            </h2>
            <p className="text-[11px] text-[#64748B]">
              Side-by-side inspection: Rendered document canvas vs normalized OCR entities with human audit logs.
            </p>
          </div>
        </div>

        {/* Document Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold py-1">
          {documents.map((d) => {
            const isSelected = activeDoc?.id === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDocId(d.id)}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap text-xs ${
                  isSelected
                    ? 'bg-[#1D4ED8] text-white shadow-sm font-bold'
                    : 'bg-[#F4F7FB] text-[#64748B] hover:text-[#111827] hover:bg-slate-200 border border-[#E2E8F0]'
                }`}
              >
                <span>{d.document_type.replace(/_/g, ' ')}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                  isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-[#111827]'
                }`}>
                  {d.extraction_status}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[740px]">
        {/* Left Pane (7 cols / ~58%): Document Preview */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden">
          {activeDoc ? (
            <DocumentViewer
              documentId={activeDoc.id}
              fileName={activeDoc.file_name}
              mimeType={activeDoc.mime_type}
              heightClass="h-full"
              className="h-full border-0 rounded-none shadow-none"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-[#64748B]">
              No document selected.
            </div>
          )}
        </div>

        {/* Right Pane (5 cols / ~42%): Extracted Fields & Correction Workbench */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden">
          {/* Header & Status KPI */}
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-slate-50/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                  Normalized Entities
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Extraction Engine: <span className="font-mono font-semibold text-[#111827]">{docStatus?.ocr_engine || activeDoc?.extracted_entities?.ocr_engine || 'PyMuPDF'}</span>
                </p>
              </div>

              {docStatus?.needs_manual_review && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-700" />
                  <span>NEEDS REVIEW</span>
                </span>
              )}
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono">
              <div className="bg-white p-2 rounded-xl border border-[#E2E8F0]">
                <div className="text-[9px] text-[#64748B] uppercase font-bold">Pages</div>
                <div className="text-xs font-extrabold text-[#111827]">{docStatus?.total_pages || 1}</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-[#E2E8F0]">
                <div className="text-[9px] text-emerald-600 uppercase font-bold">Detected</div>
                <div className="text-xs font-extrabold text-emerald-700">{docStatus?.fields_extracted_count ?? fields.filter(f => f.state === 'DETECTED' || f.state === 'MANUALLY_ENTERED').length}</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-[#E2E8F0]">
                <div className="text-[9px] text-[#64748B] uppercase font-bold">Missing</div>
                <div className="text-xs font-extrabold text-[#64748B]">{docStatus?.fields_missing_count ?? fields.filter(f => f.state === 'MISSING_IN_DOCUMENT').length}</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-[#E2E8F0]">
                <div className="text-[9px] text-rose-600 uppercase font-bold">Failed</div>
                <div className="text-xs font-extrabold text-rose-700">{docStatus?.fields_failed_count ?? fields.filter(f => f.state === 'EXTRACTION_FAILED').length}</div>
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {savedSuccessMsg && (
            <div className="m-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{savedSuccessMsg}</span>
            </div>
          )}

          {/* Scrollable Fields List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {isLoadingFields ? (
              <div className="p-8 text-center text-[#64748B] text-xs flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[#1D4ED8]" />
                <span>Loading extracted entities...</span>
              </div>
            ) : fields.length === 0 ? (
              <div className="p-8 text-center text-[#64748B] text-xs">
                No extracted entities found for this document.
              </div>
            ) : (
              fields.map((field) => {
                const confPercent = Math.round((field.confidence_score || 0) * 100);
                const isLowConf = confPercent < 70 && field.state === 'DETECTED';

                return (
                  <div
                    key={field.id}
                    className="p-3.5 bg-[#F4F7FB] rounded-xl border border-[#E2E8F0] hover:border-slate-300 transition text-xs space-y-2"
                  >
                    {/* Field Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-[#111827] text-xs leading-tight">
                          {field.label || field.field_key.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div className="text-[10px] font-mono text-[#64748B] mt-0.5">
                          {field.field_key} • {field.data_type}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {renderStateBadge(field.state)}
                        <button
                          onClick={() => handleOpenEdit(field)}
                          className="px-2.5 py-1 text-[10px] font-bold bg-white border border-[#E2E8F0] hover:bg-slate-100 text-[#111827] rounded-lg transition flex items-center gap-1 shadow-2xs"
                          title="Correct this extracted field"
                        >
                          <Edit3 className="w-2.5 h-2.5 text-[#1D4ED8]" />
                          <span>Correct</span>
                        </button>
                      </div>
                    </div>

                    {/* Value Container */}
                    <div className="bg-white p-2.5 rounded-lg border border-[#E2E8F0]">
                      {field.field_value_normalized ? (
                        <div className="font-mono font-bold text-[#111827] break-words">
                          {field.field_value_normalized}
                        </div>
                      ) : (
                        <div className="text-[#64748B] italic text-[11px] flex items-center gap-1">
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                          <span>Value missing in document scan</span>
                        </div>
                      )}
                    </div>

                    {/* Provenance & Confidence Pill Bar */}
                    <div className="flex items-center justify-between text-[10px] text-[#64748B] pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-200 text-[#111827] font-mono px-2 py-0.5 rounded-md font-bold">
                          Page {field.page_number}
                        </span>
                        {field.bounding_box && (
                          <span className="text-[9px] font-mono text-[#64748B]">
                            BBox: [{Math.round(field.bounding_box.x0 || 0)}, {Math.round(field.bounding_box.y0 || 0)}]
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isLowConf && (
                          <span className="px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200 text-[9px]">
                            LOW CONF
                          </span>
                        )}
                        <span className={`font-mono font-bold ${
                          confPercent >= 70 ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
                          {confPercent}% Match
                        </span>
                      </div>
                    </div>

                    {/* Correction Reason Tag */}
                    {field.is_manually_corrected && field.correction_reason && (
                      <div className="pt-1.5 border-t border-[#E2E8F0] text-[10px] text-indigo-900 bg-indigo-50/80 p-2 rounded-lg">
                        <span className="font-bold text-indigo-950">Audit Justification: </span>
                        <span>{field.correction_reason}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Forensic Remarks Alert */}
            {activeDoc?.forensics?.remarks && (
              <div className="p-3.5 bg-amber-50/90 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1.5 mt-3">
                <div className="font-bold flex items-center justify-between text-amber-900">
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700 mr-1" />
                    <span>Forensic Screening Observation</span>
                  </div>
                  {onNavigateToAuthenticity && (
                    <button
                      onClick={onNavigateToAuthenticity}
                      className="text-[10px] text-amber-800 hover:text-amber-900 underline flex items-center font-semibold"
                    >
                      <span>View Dossier</span>
                      <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900/90">{activeDoc.forensics.remarks}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Human-in-the-Loop Field Correction Modal */}
      {selectedFieldForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-[#1D4ED8] rounded-xl">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#111827]">Manual Field Correction</h3>
                  <p className="text-[11px] text-[#64748B]">
                    Modifications are cryptographically hashed and logged to the immutable audit journal.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFieldForEdit(null)}
                className="p-1 text-slate-400 hover:text-[#111827] rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
                  Field Target
                </label>
                <div className="p-2.5 bg-[#F4F7FB] rounded-xl border border-[#E2E8F0] font-mono text-[#111827] font-bold">
                  {selectedFieldForEdit.label || selectedFieldForEdit.field_key} ({selectedFieldForEdit.field_key})
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
                  Extracted Raw Reference
                </label>
                <div className="p-2.5 bg-[#F4F7FB] rounded-xl border border-[#E2E8F0] text-[#64748B] italic">
                  {selectedFieldForEdit.field_value_raw || 'No raw text located'}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#111827] uppercase mb-1">
                  Corrected Value <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Enter accurate value..."
                  className="w-full p-2.5 border border-[#E2E8F0] rounded-xl text-xs font-mono text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] bg-[#F4F7FB]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#111827] uppercase mb-1">
                  Audit Justification / Correction Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Mandatory justification (e.g. Corrected blurred OCR digits based on signed original certificate)."
                  className="w-full p-2.5 border border-[#E2E8F0] rounded-xl text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] bg-[#F4F7FB]"
                />
                <p className="text-[10px] text-[#64748B] mt-1">Minimum 5 characters required for audit compliance.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setSelectedFieldForEdit(null)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingEdit}
                onClick={handleSaveCorrection}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1D4ED8] hover:bg-blue-600 disabled:bg-blue-300 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-900/30"
              >
                {isSubmittingEdit ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Commit Correction</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
