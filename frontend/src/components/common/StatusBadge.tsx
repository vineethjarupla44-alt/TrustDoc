import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Check } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const norm = (status || '').toUpperCase();

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 space-x-1',
    md: 'text-xs px-2.5 py-1 space-x-1.5',
    lg: 'text-sm px-3.5 py-1.5 space-x-2 font-bold',
  }[size];

  switch (norm) {
    case 'ELIGIBLE':
    case 'APPROVED':
      return (
        <span className={`inline-flex items-center font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300 ${sizeClasses}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{norm === 'ELIGIBLE' ? 'ELIGIBLE / APPROVED' : 'APPROVED'}</span>
        </span>
      );
    case 'DEFICIENT':
      return (
        <span className={`inline-flex items-center font-bold bg-amber-100 text-amber-900 rounded-full border border-amber-300 ${sizeClasses}`}>
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>DEFICIENT</span>
        </span>
      );
    case 'REJECTED':
    case 'FLAGGED':
      return (
        <span className={`inline-flex items-center font-bold bg-rose-100 text-rose-900 rounded-full border border-rose-300 ${sizeClasses}`}>
          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>{norm === 'FLAGGED' ? 'FLAGGED (TAMPER)' : 'REJECTED'}</span>
        </span>
      );
    case 'WAIVED':
      return (
        <span className={`inline-flex items-center font-bold bg-purple-100 text-purple-900 rounded-full border border-purple-300 ${sizeClasses}`}>
          <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>WAIVED BY OFFICER</span>
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center font-medium bg-slate-100 text-slate-700 rounded-full border border-slate-300 ${sizeClasses}`}>
          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>{norm || 'PENDING'}</span>
        </span>
      );
  }
};
