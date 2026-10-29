import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Download,
  Lock,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  FileQuestion,
  X
} from 'lucide-react';
import { fetchDocumentBlob, downloadDocumentFile, openDocumentInNewTab } from '../../services/api';
import { useRouter } from '../../router/Router';

interface DocumentViewerProps {
  documentId: string;
  fileName: string;
  mimeType?: string;
  heightClass?: string;
  className?: string;
  showToolbar?: boolean;
  onClose?: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId,
  fileName,
  mimeType = 'application/pdf',
  heightClass = 'h-96',
  className = '',
  showToolbar = true,
  onClose,
}) => {
  const { navigate } = useRouter();

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string>(mimeType);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthExpired, setIsAuthExpired] = useState<boolean>(false);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    const loadDocument = async () => {
      setLoading(true);
      setError(null);
      setIsAuthExpired(false);
      setIsUnauthorized(false);

      try {
        const result = await fetchDocumentBlob(documentId);
        if (!active) {
          URL.revokeObjectURL(result.url);
          return;
        }

        createdUrl = result.url;
        setBlobUrl(result.url);
        setContentType(result.contentType);
      } catch (err: any) {
        if (!active) return;
        console.error(`Failed to load document preview [${documentId}]:`, err);

        const status = err.response?.status;
        if (status === 401) {
          setIsAuthExpired(true);
          setError('Authentication required or session expired. Please sign in to verify documents.');
        } else if (status === 403) {
          setIsUnauthorized(true);
          setError(
            err.response?.data?.detail ||
              'Access Denied: You do not have statutory authorization to view this institutional document.'
          );
        } else if (status === 404) {
          setError('Document artifact file not found on server storage.');
        } else {
          setError(
            err.response?.data?.detail ||
              'Unable to fetch document preview. Please check network connectivity or try again.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDocument();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [documentId]);

  const handleRetry = () => {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    setLoading(true);
    setError(null);
    setIsAuthExpired(false);
    setIsUnauthorized(false);

    fetchDocumentBlob(documentId)
      .then((result) => {
        setBlobUrl(result.url);
        setContentType(result.contentType);
      })
      .catch((err: any) => {
        const status = err.response?.status;
        if (status === 401) {
          setIsAuthExpired(true);
          setError('Authentication required or session expired.');
        } else if (status === 403) {
          setIsUnauthorized(true);
          setError(err.response?.data?.detail || 'Access Denied.');
        } else {
          setError(err.response?.data?.detail || 'Failed to load preview.');
        }
      })
      .finally(() => setLoading(false));
  };

  const handleDownload = () => {
    downloadDocumentFile(documentId, fileName);
  };

  const handleOpenOriginal = () => {
    openDocumentInNewTab(documentId);
  };

  const isImage =
    contentType.startsWith('image/') ||
    fileName.toLowerCase().endsWith('.png') ||
    fileName.toLowerCase().endsWith('.jpg') ||
    fileName.toLowerCase().endsWith('.jpeg') ||
    fileName.toLowerCase().endsWith('.webp');

  const isPdf =
    contentType === 'application/pdf' ||
    fileName.toLowerCase().endsWith('.pdf');

  return (
    <div
      className={`bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden ${className}`}
    >
      {/* Header Toolbar */}
      {showToolbar && (
        <div className="px-4 py-2.5 bg-slate-50 border-b border-[#E2E8F0] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 truncate">
            <FileText className="w-4 h-4 text-[#1D4ED8] shrink-0" />
            <span className="font-bold text-[#111827] truncate" title={fileName}>
              {fileName}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white border border-[#E2E8F0] text-slate-500 uppercase">
              {contentType.split('/')[1] || 'PDF'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isImage && blobUrl && (
              <div className="hidden sm:flex items-center gap-1 bg-white border border-[#E2E8F0] rounded-lg px-2 py-0.5 text-[11px] text-slate-600">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
                  className="hover:text-slate-900"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[10px] w-9 text-center">{zoomLevel}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(250, z + 25))}
                  className="hover:text-slate-900"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleOpenOriginal}
              className="px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8] hover:text-blue-800 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
              title="Open document in a new browser tab with full controls"
            >
              <span>Open Original</span>
              <ExternalLink className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
              title="Download original file"
            >
              <Download className="w-3 h-3 text-slate-500" />
              <span className="hidden sm:inline">Download</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200 transition"
                title="Hide Preview"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Document Viewport Canvas */}
      <div className={`relative bg-slate-100 overflow-auto ${heightClass}`}>
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/85 backdrop-blur-2xs p-6 text-center">
            <RefreshCw className="w-6 h-6 text-[#1D4ED8] animate-spin" />
            <div className="space-y-1">
              <span className="text-xs font-bold text-[#111827]">
                Authenticating & Loading Document...
              </span>
              <p className="text-[11px] text-slate-500">
                Fetching document bytes through secure statutory session channel.
              </p>
            </div>
          </div>
        )}

        {/* Error / Unauthorized / Expired State */}
        {!loading && error && (
          <div className="h-full flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-6 max-w-md w-full text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
                {isAuthExpired ? (
                  <Lock className="w-6 h-6" />
                ) : isUnauthorized ? (
                  <ShieldAlert className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>

              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900">
                  {isAuthExpired
                    ? 'Session Authentication Required'
                    : isUnauthorized
                    ? 'Statutory Access Restricted'
                    : 'Document Preview Error'}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">{error}</p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1">
                {isAuthExpired ? (
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#1D4ED8] hover:bg-blue-700 rounded-xl shadow-xs transition"
                  >
                    Sign In to Portal
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenOriginal}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#1D4ED8] hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-xs"
                    >
                      <span>Try External Tab</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Successful Document Render */}
        {!loading && !error && blobUrl && (
          <div className="w-full h-full">
            {isPdf ? (
              <iframe
                src={blobUrl}
                title={fileName}
                className="w-full h-full border-0 bg-white"
              />
            ) : isImage ? (
              <div className="w-full h-full flex items-center justify-center p-4 overflow-auto bg-slate-900/5">
                <img
                  src={blobUrl}
                  alt={fileName}
                  style={{
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.15s ease-out',
                  }}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm border border-slate-200"
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-8 text-center">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 max-w-sm space-y-3">
                  <FileQuestion className="w-10 h-10 text-slate-400 mx-auto" />
                  <div className="text-xs font-bold text-slate-800">
                    Direct Browser Canvas Not Supported For This Format
                  </div>
                  <p className="text-[11px] text-slate-500">
                    File format: <code className="font-mono text-slate-700">{contentType}</code>
                  </p>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-[#1D4ED8] hover:bg-blue-700 rounded-xl transition flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File ({fileName})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
