import React, { useState } from 'react';
import { ShieldCheck, Lock, ArrowRight, CheckCircle2, AlertOctagon, KeyRound } from 'lucide-react';
import type { Role, Language } from '../../types';

interface LoginScreenProps {
  currentRole: Role;
  onRoleSelect: (role: Role) => void;
  language?: Language;
  onLoginSuccess?: (email: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  currentRole,
  onRoleSelect,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('reviewer@aicte.gov.in');
  const [password, setPassword] = useState('••••••••');
  const [loading, setLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);

    setTimeout(() => {
      setLoading(false);
      setAuthSuccess(true);
      if (onLoginSuccess) {
        onLoginSuccess(email);
      }
    }, 400);
  };

  const handleQuickLogin = (role: Role, userEmail: string, pass: string) => {
    onRoleSelect(role);
    setEmail(userEmail);
    setPassword(pass);
    setAuthSuccess(true);
    if (onLoginSuccess) {
      onLoginSuccess(userEmail);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 text-[#111827]">
      {/* Statutory Header Card */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-[#1D4ED8] to-[#0B1220] rounded-2xl flex items-center justify-center mx-auto shadow-xl border border-blue-400/30 mb-4">
          <ShieldCheck className="w-9 h-9 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">
          Trust<span className="text-[#1D4ED8]">Doc</span>
        </h1>
        <p className="text-xs text-[#64748B] max-w-md mx-auto mt-1 leading-relaxed">
          AI-Powered Institutional Application Validation & Regulatory Compliance Platform
        </p>
        <span className="inline-block mt-2.5 px-3 py-1 bg-blue-50 text-[#1D4ED8] text-xs font-bold rounded-full border border-blue-200">
          AICTE Approval Process Handbook (2026-27 Norms) Engine Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left: Quick Demo Access for Evaluators */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6 space-y-4">
          <div className="border-b border-[#E2E8F0] pb-3">
            <h3 className="text-sm font-bold text-[#111827] flex items-center">
              <KeyRound className="w-4 h-4 mr-2 text-[#1D4ED8]" />
              1-Click Demonstration Personas
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Instantly toggle role-based verification scopes without entering credentials.
            </p>
          </div>

          <div className="space-y-3">
            {/* Quick Reviewer */}
            <div
              onClick={() => handleQuickLogin('REVIEWER', 'reviewer@aicte.gov.in', 'reviewer123')}
              className="p-4 rounded-xl border border-[#E2E8F0] hover:border-blue-400 bg-[#F4F7FB] hover:bg-blue-50/50 cursor-pointer transition flex items-center justify-between group"
            >
              <div>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-[#1D4ED8] text-white rounded-md">
                  SCRUTINY OFFICER
                </span>
                <h4 className="text-xs font-bold text-[#111827] mt-1.5">
                  Dr. Arvind Sharma (Senior Scrutiny Cell)
                </h4>
                <p className="text-[11px] text-[#64748B] font-mono">reviewer@aicte.gov.in</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#1D4ED8] transition shrink-0" />
            </div>

            {/* Quick Applicant */}
            <div
              onClick={() => handleQuickLogin('APPLICANT', 'applicant@apex.edu', 'applicant123')}
              className="p-4 rounded-xl border border-[#E2E8F0] hover:border-emerald-400 bg-[#F4F7FB] hover:bg-emerald-50/50 cursor-pointer transition flex items-center justify-between group"
            >
              <div>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-md">
                  COLLEGE APPLICANT
                </span>
                <h4 className="text-xs font-bold text-[#111827] mt-1.5">
                  Dr. K. S. Ramanujam (Apex Institute)
                </h4>
                <p className="text-[11px] text-[#64748B] font-mono">applicant@apex.edu</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition shrink-0" />
            </div>

            {/* Quick Admin */}
            <div
              onClick={() => handleQuickLogin('ADMIN', 'admin@aicte.gov.in', 'admin123')}
              className="p-4 rounded-xl border border-[#E2E8F0] hover:border-purple-400 bg-[#F4F7FB] hover:bg-purple-50/50 cursor-pointer transition flex items-center justify-between group"
            >
              <div>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-700 text-white rounded-md">
                  ADMINISTRATOR
                </span>
                <h4 className="text-xs font-bold text-[#111827] mt-1.5">
                  Smt. Meenakshi Sundaram (Chief Admin)
                </h4>
                <p className="text-[11px] text-[#64748B] font-mono">admin@aicte.gov.in</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition shrink-0" />
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
            <strong>Transparency Notice:</strong> All accounts operate on sandboxed synthetic demonstration records.
            Official AICTE regulations are not duplicated or claimed.
          </div>
        </div>

        {/* Right: Manual Authentication Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6">
          {/* Role Tabs */}
          <div className="flex border-b border-[#E2E8F0] mb-5">
            <button
              onClick={() => onRoleSelect('REVIEWER')}
              className={`flex-1 py-2.5 text-xs font-bold border-b-2 text-center transition ${
                currentRole === 'REVIEWER'
                  ? 'border-[#1D4ED8] text-[#1D4ED8]'
                  : 'border-transparent text-[#64748B] hover:text-[#111827]'
              }`}
            >
              Scrutiny Officer
            </button>
            <button
              onClick={() => onRoleSelect('APPLICANT')}
              className={`flex-1 py-2.5 text-xs font-bold border-b-2 text-center transition ${
                currentRole === 'APPLICANT'
                  ? 'border-[#1D4ED8] text-[#1D4ED8]'
                  : 'border-transparent text-[#64748B] hover:text-[#111827]'
              }`}
            >
              College Applicant
            </button>
            <button
              onClick={() => onRoleSelect('ADMIN')}
              className={`flex-1 py-2.5 text-xs font-bold border-b-2 text-center transition ${
                currentRole === 'ADMIN'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-[#64748B] hover:text-[#111827]'
              }`}
            >
              Administrator
            </button>
          </div>

          {authSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Session verified. Active Role: <strong>{currentRole}</strong></span>
            </div>
          )}

          {authError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-medium">
              <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-[#111827] block mb-1">Registered Institutional Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] bg-[#F4F7FB]"
                required
              />
            </div>

            <div>
              <label className="font-bold text-[#111827] block mb-1">Access Passcode / Security Token</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2.5 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] bg-[#F4F7FB]"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold rounded-xl shadow-md shadow-blue-900/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>{loading ? 'Authenticating...' : `Enter Portal as ${currentRole}`}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
