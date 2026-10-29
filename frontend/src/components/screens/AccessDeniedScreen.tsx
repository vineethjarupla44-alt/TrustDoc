import React from 'react';
import { KeyRound, LogOut, ShieldX } from 'lucide-react';
import { useRouter } from '../../router/Router';
import type { Role, User } from '../../types';

interface AccessDeniedScreenProps {
  currentUser: User | null;
  requiredRole: string;
  onLogout: () => void;
}

export const AccessDeniedScreen: React.FC<AccessDeniedScreenProps> = ({
  currentUser,
  requiredRole,
  onLogout,
}) => {
  const { navigate } = useRouter();

  const getPermittedDashboard = (role?: Role): string => {
    switch (role) {
      case 'APPLICANT':
        return '/applicant/dashboard';
      case 'REVIEWER':
      case 'AUDITOR':
        return '/officer/dashboard';
      case 'ADMIN':
        return '/admin/dashboard';
      default:
        return '/login';
    }
  };

  const permittedPath = getPermittedDashboard(currentUser?.role);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6 text-[#111827]">
      <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200 shadow-2xl p-6 sm:p-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner border border-rose-200">
          <ShieldX className="w-9 h-9" />
        </div>

        <div className="space-y-1">
          <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 text-rose-700 rounded border border-rose-200">
            HTTP 403 • ACCESS RESTRICTED
          </span>
          <h2 className="text-xl font-extrabold text-[#111827] mt-2">
            Role Permission Denied
          </h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Pursuant to TrustDoc multi-tenant security architecture, this console requires elevated authorization. Your current account role does not have permission to view this view.
          </p>
        </div>

        {/* User Context Details */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Logged-in User:</span>
            <span className="font-bold text-slate-800">{currentUser ? currentUser.email : 'Unauthenticated'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Assigned Account Role:</span>
            <span className="font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px]">
              {currentUser ? currentUser.role : 'NONE'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Required Authorization:</span>
            <span className="font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px]">
              {requiredRole}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          {currentUser && (
            <button
              onClick={() => navigate(permittedPath)}
              className="w-full py-2.5 px-4 bg-[#1D4ED8] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2"
            >
              <span>Return to Permitted Dashboard</span>
            </button>
          )}

          <button
            onClick={() => navigate('/login')}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition flex items-center justify-center gap-2"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Switch Role / Portal Login</span>
          </button>

          {currentUser && (
            <button
              onClick={onLogout}
              className="w-full py-2 px-4 text-xs font-semibold text-rose-600 hover:text-rose-800 transition flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out of current session</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
