import React from 'react';
import { RefreshCw, FolderSearch, AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';

interface StateViewProps {
  state: 'loading' | 'empty' | 'error' | 'success' | 'needs_review';
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  badgeCount?: number;
}

export const StateView: React.FC<StateViewProps> = ({
  state,
  title,
  description,
  actionText,
  onAction,
  badgeCount,
}) => {
  if (state === 'loading') {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <h4 className="text-sm font-bold text-slate-800">{title || 'Loading Verification Dossier...'}</h4>
        <p className="text-xs text-slate-500 mt-1">{description || 'Extracting structured data and verifying cryptographic hashes.'}</p>
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="p-10 text-center bg-white rounded-xl border border-slate-200">
        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <FolderSearch className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">{title || 'No Records Found'}</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{description || 'No documents or applications match the selected filter criteria.'}</p>
        {actionText && onAction && (
          <button
            onClick={onAction}
            className="mt-4 px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            {actionText}
          </button>
        )}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-900">
        <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-bold">{title || 'Scrutiny Error Detected'}</h4>
          <p className="text-xs text-rose-700 mt-1 leading-relaxed">{description || 'Unable to execute algorithmic extraction. Check document readability or server logs.'}</p>
          {actionText && onAction && (
            <button
              onClick={onAction}
              className="mt-3 px-3 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md transition"
            >
              {actionText}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-emerald-900">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-bold">{title || 'Operation Verified'}</h4>
          <p className="text-xs text-emerald-700 mt-1 leading-relaxed">{description || 'All verification checks passed statutory conformance criteria.'}</p>
        </div>
      </div>
    );
  }

  if (state === 'needs_review') {
    return (
      <div className="p-5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-amber-900">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-bold">{title || 'Human Scrutiny Decision Required'}</h4>
              {badgeCount !== undefined && (
                <span className="px-2 py-0.5 bg-amber-600 text-white text-[10px] font-bold rounded-full">
                  {badgeCount} Action{badgeCount !== 1 ? 's' : ''} Pending
                </span>
              )}
            </div>
            <p className="text-xs text-amber-700 mt-0.5">{description || 'Discrepancies identified require human officer review or regulatory waiver.'}</p>
          </div>
        </div>
        {actionText && onAction && (
          <button
            onClick={onAction}
            className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition shrink-0"
          >
            {actionText}
          </button>
        )}
      </div>
    );
  }

  return null;
};
