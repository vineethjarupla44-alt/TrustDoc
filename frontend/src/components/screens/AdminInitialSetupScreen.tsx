import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  LockKeyhole
} from 'lucide-react';
import { useRouter } from '../../router/Router';
import { fetchAdminSetupStatus, initialAdminSetup } from '../../services/api';

export const AdminInitialSetupScreen: React.FC = () => {
  const { navigate } = useRouter();

  // Initial status check
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [setupAllowed, setSetupAllowed] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [adminCount, setAdminCount] = useState(0);

  // Form Fields
  const [setupSecret, setSetupSecret] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const institutionName = 'TrustDoc Statutory Administration';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // State
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setCheckingStatus(true);
    try {
      const status = await fetchAdminSetupStatus();
      setSetupAllowed(status.setup_allowed);
      setHasAdmin(status.has_admin);
      setAdminCount(status.admin_count);
    } catch (err) {
      console.error('Failed to verify admin setup status:', err);
      // Default to safe restricted mode on failure
      setSetupAllowed(false);
      setHasAdmin(true);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!setupSecret.trim()) {
      setErrorMsg('Root setup secret key is required from server configuration.');
      return;
    }

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMsg('Full name, email, and master password are mandatory.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Root administrator password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    try {
      const response = await initialAdminSetup({
        setup_secret: setupSecret.trim(),
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        institution_name: institutionName.trim(),
      });

      setSuccessMsg(response.message || 'Root administrator initialized successfully!');
      setTimeout(() => {
        navigate('/login/admin');
      }, 2000);
    } catch (err: any) {
      console.error('Admin initial setup failed:', err);
      setErrorMsg(
        err.response?.data?.detail ||
          'Failed to initialize administrator. Please verify the setup secret key.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-6 text-[#111827]">
        <div className="flex items-center gap-2.5 text-xs text-slate-500 font-semibold">
          <span className="w-4 h-4 border-2 border-slate-300 border-t-purple-600 rounded-full animate-spin" />
          <span>Verifying system governance state...</span>
        </div>
      </div>
    );
  }

  // RESTRICTED VIEW: If an administrator already exists
  if (hasAdmin && !setupAllowed) {
    return (
      <div className="min-h-[85vh] flex flex-col justify-center max-w-lg mx-auto px-4 sm:px-6 py-10 text-[#111827]">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mx-auto shadow-xs">
            <LockKeyhole className="w-9 h-9 text-slate-800" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
              System Governance Secured
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-2">
              Initial Root Setup Disabled
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              This system already contains <span className="font-bold text-slate-800">{adminCount} provisioned administrator(s)</span>. Initial public setup has been permanently sealed.
            </p>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 text-left flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Governance Protocol:</span> Additional administrator accounts can only be created by an authenticated administrator via the{' '}
              <span className="font-semibold underline">Admin Console &gt; User Management</span> tab.
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate('/login/admin')}
              className="w-full py-2.5 px-4 rounded-xl text-white text-xs font-bold bg-purple-700 hover:bg-purple-800 shadow-md transition flex items-center justify-center gap-2"
            >
              <span>Go to Administrator Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE SETUP VIEW
  return (
    <div className="min-h-[85vh] flex flex-col justify-center max-w-xl mx-auto px-4 sm:px-6 py-10 text-[#111827]">
      {/* Return to Login */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/login/admin')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#111827] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-0.5 transition-transform" />
          <span>Return to Admin Login</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-6 sm:p-7 bg-[#F4F7FB] border-b border-[#E2E8F0] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-900 flex items-center justify-center text-white shadow-md">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  TrustDoc Root Initialization
                </span>
                <h2 className="text-lg font-bold text-[#111827]">Initial Administrator Setup</h2>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md border bg-purple-50 text-purple-700 border-purple-200">
              FIRST BOOT ONLY
            </span>
          </div>

          <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl flex items-start gap-2.5 text-xs text-purple-900">
            <Info className="w-4 h-4 text-purple-700 mt-0.5 shrink-0" />
            <div className="leading-relaxed">
              <span className="font-bold">Initial Provisioning:</span> No administrators exist yet. To initialize the root system administrator, provide the backend environment secret key (`TRUSTDOC_ROOT_ADMIN_SETUP_2026`).
            </div>
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mx-6 sm:mx-7 mt-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <div className="flex-1 leading-relaxed">
              <span className="font-bold">Setup Error:</span> {errorMsg}
            </div>
          </div>
        )}

        {/* Success Alert Box */}
        {successMsg && (
          <div className="mx-6 sm:mx-7 mt-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1 leading-relaxed">
              <span className="font-bold">Success:</span> {successMsg}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
          {/* Secret Key Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="setup-secret">
              Server Setup Secret Key *
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-purple-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="setup-secret"
                type="password"
                required
                value={setupSecret}
                onChange={(e) => setSetupSecret(e.target.value)}
                placeholder="Enter INITIAL_ADMIN_SECRET key"
                className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-1 focus:ring-purple-600 transition font-mono font-bold"
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Default development key: <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700 font-mono">TRUSTDOC_ROOT_ADMIN_SETUP_2026</code>
            </span>
          </div>

          {/* Root Admin Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="admin-name">
                Administrator Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Master Administrator"
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-1 focus:ring-purple-600 transition font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="admin-email">
                Official Administrator Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. root.admin@aicte.gov.in"
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-1 focus:ring-purple-600 transition font-medium"
                />
              </div>
            </div>
          </div>

          {/* Password & Confirm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="admin-pass">
                Root Password (Min 8 chars) *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-pass"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-10 py-2.5 rounded-xl focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-1 focus:ring-purple-600 transition font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="confirm-pass">
                Confirm Root Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="confirm-pass"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-1 focus:ring-purple-600 transition font-medium"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-white text-xs font-bold bg-purple-700 hover:bg-purple-800 focus:ring-2 focus:ring-purple-600 shadow-md transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Provisioning Root Administrator...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Provision Root Administrator Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
