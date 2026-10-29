import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  ShieldAlert,
  Sliders,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  KeyRound,
  HelpCircle,
  X,
  UserPlus,
  Shield,
  ChevronDown
} from 'lucide-react';
import { useRouter } from '../../router/Router';
import { loginUser, saveStoredAuth, fetchAdminSetupStatus } from '../../services/api';
import type { User } from '../../types';

interface RoleLoginScreenProps {
  roleVariant: 'applicant' | 'officer' | 'admin';
  onLoginSuccess: (user: User) => void;
}

export const RoleLoginScreen: React.FC<RoleLoginScreenProps> = ({
  roleVariant,
  onLoginSuccess,
}) => {
  const { navigate } = useRouter();

  // Role Configuration
  const roleConfig = {
    applicant: {
      roleTitle: 'College Applicant',
      roleBadge: 'COLLEGE APPLICANT',
      portalScope: 'Institutional Accreditation, Regulatory Filing & Annual Approvals',
      expectedRole: 'APPLICANT',
      dashboardPath: '/applicant/dashboard',
      icon: GraduationCap,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      accentColor: 'from-emerald-600 to-teal-700',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
      demoEmail: 'applicant@apex.edu',
      demoPass: 'applicant123',
      demoName: 'Dr. K. S. Ramanujam (Principal, Apex Inst. of Tech.)',
      registerAllowed: true,
      recoveryAdvice:
        'College Applicant password recovery must be initiated by your college registrar or by submitting an official authorized institutional request to support@aicte.gov.in with Society Registration proof.',
    },
    officer: {
      roleTitle: 'Security Officer',
      roleBadge: 'SECURITY OFFICER',
      portalScope: 'Forensic Verification, Scrutiny Investigation & Evidence Analysis',
      expectedRole: 'REVIEWER',
      dashboardPath: '/officer/dashboard',
      icon: ShieldAlert,
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      accentColor: 'from-[#1D4ED8] to-[#0B1220]',
      buttonBg: 'bg-[#1D4ED8] hover:bg-blue-700 focus:ring-blue-600',
      demoEmail: 'reviewer@aicte.gov.in',
      demoPass: 'reviewer123',
      demoName: 'Dr. Arvind Sharma (Senior Scrutiny Officer)',
      registerAllowed: false,
      recoveryAdvice:
        'Security Officer accounts are provisioned and credential-managed strictly by the Central Scrutiny Administration cell. Contact your nodal IT compliance officer for credential re-issuance.',
    },
    admin: {
      roleTitle: 'Administrator',
      roleBadge: 'ADMINISTRATOR',
      portalScope: 'Regulatory Rule Engine, Audit Governance & Officer Management',
      expectedRole: 'ADMIN',
      dashboardPath: '/admin/dashboard',
      icon: Sliders,
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      accentColor: 'from-purple-600 to-indigo-900',
      buttonBg: 'bg-purple-700 hover:bg-purple-800 focus:ring-purple-600',
      demoEmail: 'admin@aicte.gov.in',
      demoPass: 'admin123',
      demoName: 'System Administrator (TrustDoc Core)',
      registerAllowed: false,
      recoveryAdvice:
        'System Administrator root recovery is protected by multi-signature protocols. Credential reset must be executed via direct server CLI credential provisioning or master recovery key injection.',
    },
  }[roleVariant];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Status for admin initial setup link
  const [adminSetupAllowed, setAdminSetupAllowed] = useState(false);

  useEffect(() => {
    if (roleVariant === 'admin') {
      fetchAdminSetupStatus()
        .then((s) => setAdminSetupAllowed(s.setup_allowed))
        .catch(() => setAdminSetupAllowed(false));
    }
  }, [roleVariant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email address and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await loginUser({
        email: email.trim(),
        password,
        expected_role: roleConfig.expectedRole,
      });

      // Save token and user in storage
      saveStoredAuth(data.access_token, data.user, rememberMe);

      // Notify parent app
      onLoginSuccess(data.user);

      // Redirect to role-specific dashboard
      navigate(roleConfig.dashboardPath);
    } catch (err: any) {
      console.error('Login failure:', err);
      if (err.response?.status === 403) {
        setErrorMsg(
          err.response.data?.detail ||
            'Access Denied: Your account role or approval status does not authorize entry to this portal.'
        );
      } else if (err.response?.status === 401) {
        setErrorMsg('Invalid email or password. Please verify your credentials or register a new account.');
      } else {
        setErrorMsg(
          err.response?.data?.detail ||
            'Failed to connect to authentication server. Please check backend connection.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDemoReference = () => {
    setEmail(roleConfig.demoEmail);
    setPassword(roleConfig.demoPass);
    setErrorMsg(null);
  };

  const RoleIcon = roleConfig.icon;

  return (
    <div className="min-h-[85vh] flex flex-col justify-center max-w-xl mx-auto px-4 sm:px-6 py-10 text-[#111827]">
      {/* Return to Role Selection Link */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#111827] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Portal Selection</span>
        </button>
      </div>

      {/* Main Login Card */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden">
        {/* Role Banner Header */}
        <div className="p-6 sm:p-7 bg-[#F4F7FB] border-b border-[#E2E8F0] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${roleConfig.accentColor} flex items-center justify-center text-white shadow-md`}
              >
                <RoleIcon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  TrustDoc Authentication
                </span>
                <h2 className="text-lg font-bold text-[#111827]">{roleConfig.roleTitle} Login</h2>
              </div>
            </div>
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md border ${roleConfig.badgeColor}`}
            >
              {roleConfig.roleBadge}
            </span>
          </div>
          <p className="text-xs text-[#64748B] leading-relaxed">{roleConfig.portalScope}</p>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mx-6 sm:mx-7 mt-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <div className="flex-1 leading-relaxed">
              <span className="font-bold">Authentication Alert:</span> {errorMsg}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
          {/* Email / Username Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="email-input">
              Authorized Email Address:
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email address"
                className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#1D4ED8] focus:bg-white focus:ring-1 focus:ring-[#1D4ED8] transition font-medium"
              />
            </div>
          </div>

          {/* Password Field with Show/Hide Eye */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700" htmlFor="password-input">
                Password:
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-[11px] font-semibold text-[#1D4ED8] hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-10 py-2.5 rounded-xl focus:outline-none focus:border-[#1D4ED8] focus:bg-white focus:ring-1 focus:ring-[#1D4ED8] transition font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-[#1D4ED8] border-slate-300 focus:ring-[#1D4ED8]"
              />
              <span className="text-xs text-slate-600 font-medium">Keep me signed in on this device</span>
            </label>
          </div>

          {/* Submit Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 rounded-xl text-white text-xs font-bold shadow-md transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 ${roleConfig.buttonBg}`}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Authenticate & Enter {roleConfig.roleTitle} Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* 1. College Applicant Registration Link */}
          {roleVariant === 'applicant' && (
            <div className="pt-4 border-t border-[#E2E8F0] space-y-1.5 text-center">
              <div className="text-xs text-slate-600">
                <span>New institution applying for AICTE approval or renewal?</span>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>New Institution? Register Here</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. Security Officer Request Account Link */}
          {roleVariant === 'officer' && (
            <div className="pt-4 border-t border-[#E2E8F0] space-y-1.5 text-center">
              <div className="text-xs text-slate-600">
                <span>Official scrutiny investigator or forensics analyst?</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/register/officer')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D4ED8] hover:text-blue-800 hover:underline"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Request an Officer Account</span>
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => navigate('/register/officer')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline"
                >
                  <span>Check Status</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Administrator Governance Note & Initial Setup */}
          {roleVariant === 'admin' && (
            <div className="pt-4 border-t border-[#E2E8F0] space-y-2 text-center text-xs text-slate-500">
              <p className="leading-relaxed">
                Administrator accounts are provisioned exclusively by authorized organization governance.
              </p>
              {adminSetupAllowed && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/admin/initial-setup')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:underline"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>First-time setup? Initialize Root Administrator</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Discrete Collapsible Developer / Evaluator Reference (Non-intrusive, no auto-filling) */}
      <details className="mt-4 bg-slate-100/80 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-600 group">
        <summary className="cursor-pointer font-bold flex items-center justify-between text-slate-700 hover:text-slate-900 select-none">
          <span className="flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
            <span>Developer / Evaluator Demo Credentials Reference</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="mt-3 pt-2 border-t border-slate-200/70 space-y-2 text-[11px] leading-relaxed">
          <p>
            For demonstration and SIH jury evaluation, pre-seeded accounts can be referenced below or typed manually:
          </p>
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono space-y-1">
            <div>
              <span className="text-slate-400">Email:</span> <span className="font-bold text-slate-800">{roleConfig.demoEmail}</span>
            </div>
            <div>
              <span className="text-slate-400">Password:</span> <span className="font-bold text-slate-800">{roleConfig.demoPass}</span>
            </div>
            <div>
              <span className="text-slate-400">Identity:</span> <span className="text-slate-600 font-sans">{roleConfig.demoName}</span>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleApplyDemoReference}
              className="px-2.5 py-1 text-[11px] font-bold text-[#1D4ED8] hover:bg-blue-50 border border-blue-200 rounded-md transition"
            >
              Fill Reference Credentials
            </button>
          </div>
        </div>
      </details>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#1D4ED8]" />
                <h3 className="text-sm font-bold text-slate-900">Credential Recovery Protocol</h3>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{roleConfig.recoveryAdvice}</p>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#1D4ED8] hover:bg-blue-700 rounded-lg shadow-xs"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};