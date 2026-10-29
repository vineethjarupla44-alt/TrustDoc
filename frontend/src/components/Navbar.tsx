import React from 'react';
import { ShieldCheck, UserCheck, FileText, Globe, Layers, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { Role, Language } from '../types';
import { translations } from '../i18n/translations';

interface NavbarProps {
  currentRole: Role;
  onRoleChange: (role: Role) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  activeCase: string;
  onSelectCase: (appNum: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  language,
  onLanguageChange,
  activeCase,
  onSelectCase,
}) => {
  const t = translations[language];

  return (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Hackathon Tag */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-md">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-white">{t.app_title}</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500/20 text-blue-300 rounded border border-blue-400/30">
                  TrustDoc
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">{t.project_sub}</p>
            </div>
          </div>

          {/* Quick Demo Case Selector */}
          <div className="hidden lg:flex items-center space-x-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <span className="text-xs font-medium text-slate-400 px-2 flex items-center">
              <Layers className="w-3.5 h-3.5 mr-1 text-blue-400" />
              Demo Cases:
            </span>
            <button
              onClick={() => onSelectCase('APP-2026-CASE-A')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center space-x-1 ${
                activeCase === 'APP-2026-CASE-A'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <CheckCircle className="w-3 h-3 text-emerald-300" />
              <span>Case A (Pass)</span>
            </button>
            <button
              onClick={() => onSelectCase('APP-2026-CASE-B')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center space-x-1 ${
                activeCase === 'APP-2026-CASE-B'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-300" />
              <span>Case B (Mismatch)</span>
            </button>
            <button
              onClick={() => onSelectCase('APP-2026-CASE-C')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center space-x-1 ${
                activeCase === 'APP-2026-CASE-C'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <XCircle className="w-3 h-3 text-rose-300" />
              <span>Case C (Tampered)</span>
            </button>
          </div>

          {/* Role Switcher & Language */}
          <div className="flex items-center space-x-3">
            {/* Role Nav */}
            <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => onRoleChange('APPLICANT')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center space-x-1.5 ${
                  currentRole === 'APPLICANT'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{t.applicant_portal}</span>
              </button>
              <button
                onClick={() => onRoleChange('REVIEWER')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center space-x-1.5 ${
                  currentRole === 'REVIEWER'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t.reviewer_portal}</span>
              </button>
            </div>

            {/* Language Dropdown */}
            <div className="relative flex items-center bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
              <Globe className="w-4 h-4 text-slate-400 mr-1.5" />
              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as Language)}
                aria-label="Select Language"
                className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="en" className="bg-slate-800 text-white">English</option>
                <option value="hi" className="bg-slate-800 text-white">हिन्दी (Hindi)</option>
                <option value="te" className="bg-slate-800 text-white">తెలుగు (Telugu)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
