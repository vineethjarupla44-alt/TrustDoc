import React, { useState } from 'react';
import {
  ShieldCheck,
  Globe,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Menu,
  Search,
  Bell,
  ChevronRight,
  Sparkles,
  KeyRound,
  LogOut,
  LayoutDashboard,
  ChevronDown,
} from 'lucide-react';
import type { Role, Language, ScreenId, ApplicationDetail, User } from '../../types';
import { translations } from '../../i18n/translations';
import { useRouter } from '../../router/Router';

interface StatutoryHeaderProps {
  currentRole?: Role;
  onRoleChange?: (role: Role) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  activeCase: string;
  onSelectCase: (appNum: string) => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  currentScreen?: ScreenId;
  applications?: ApplicationDetail[];
  onSelectApplication?: (id: string) => void;
  currentUser?: User | null;
  onLogout?: () => void;
}

export const StatutoryHeader: React.FC<StatutoryHeaderProps> = ({
  language,
  onLanguageChange,
  activeCase,
  onSelectCase,
  onToggleSidebar,
  currentScreen = 'overview',
  applications = [],
  onSelectApplication,
  currentUser,
  onLogout,
}) => {
  const { navigate } = useRouter();
  const t = translations[language] || translations.en;
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const getScreenTitle = (screen: ScreenId): string => {
    switch (screen) {
      case 'overview': return t.screen_overview || 'Overview Dashboard';
      case 'applicant_dashboard': return 'College Applicant Dashboard';
      case 'officer_dashboard': return 'Security Officer Dashboard';
      case 'admin_dashboard': return 'Compliance Admin Dashboard';
      case 'role_selection': return 'Role Selection Portal';
      case 'login_applicant': return 'Applicant Login';
      case 'login_officer': return 'Officer Login';
      case 'login_admin': return 'Admin Login';
      case 'register': return 'Institution Registration';
      case 'applications': return t.screen_applications || 'Applications Registry';
      case 'application_detail': return t.screen_application_detail || 'Application Detail';
      case 'new_application': return t.screen_new_application || 'New Submission';
      case 'document_split': return t.screen_document_split || 'Document & Fields';
      case 'authenticity_dossier': return t.screen_authenticity || 'Forensics Dossier';
      case 'compliance_findings': return t.screen_findings || 'Compliance Findings';
      case 'risk_summary': return t.screen_risk_summary || 'Risk Scorecard';
      case 'chatbot': return t.screen_chatbot || 'Advisory Chatbot';
      case 'reviewer_decision': return t.screen_reviewer_decision || 'Scrutiny Decisions';
      case 'regulatory_rules': return t.screen_regulatory_rules || 'Regulatory Catalog';
      case 'audit_and_report': return t.screen_audit_and_report || 'Audit Logs & Export';
      case 'admin_console': return t.screen_admin_console || 'Compliance Admin Console';
      case 'login': return t.screen_login || 'Login & Roles';
      default: return 'Portal';
    }
  };

  const getRoleDisplayName = (r?: Role) => {
    switch (r) {
      case 'APPLICANT': return 'College Applicant';
      case 'REVIEWER': return 'Security Officer';
      case 'ADMIN': return 'Administrator';
      case 'AUDITOR': return 'Auditor';
      default: return 'Guest';
    }
  };

  const getRoleInitials = (r?: Role) => {
    switch (r) {
      case 'APPLICANT': return 'CA';
      case 'REVIEWER': return 'SO';
      case 'ADMIN': return 'AD';
      case 'AUDITOR': return 'AU';
      default: return 'TD';
    }
  };

  const getPermittedDashboardPath = (r?: Role) => {
    switch (r) {
      case 'APPLICANT': return '/applicant/dashboard';
      case 'REVIEWER':
      case 'AUDITOR': return '/officer/dashboard';
      case 'ADMIN': return '/admin/dashboard';
      default: return '/';
    }
  };

  const filteredApps = searchQuery.trim()
    ? applications.filter(
        (app) =>
          app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (app.institution_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <header className="bg-[#0B1220] text-white sticky top-0 z-40 border-b border-[#1E293B] shadow-md select-none">
      <div className="w-full px-4 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Left: Sidebar Toggle + Brandmark + Breadcrumbs */}
          <div className="flex items-center gap-3 shrink-0">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#111C30] transition border border-transparent hover:border-slate-700 lg:hidden"
                aria-label="Toggle navigation drawer"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* Brand Mark */}
            <div
              onClick={() => navigate('/')}
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition"
              title="Return to TrustDoc Public Landing Page"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] flex items-center justify-center shadow-lg shadow-blue-900/30 border border-blue-400/30">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold tracking-tight text-white flex items-center gap-1">
                    Trust<span className="text-blue-400">Doc</span>
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-300 rounded border border-blue-400/20">
                    <Sparkles className="w-2.5 h-2.5 text-blue-400" />
                    Regulatory AI
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 hidden xl:block tracking-wide">
                  Document Forensics & Statutory Compliance
                </p>
              </div>
            </div>

            {/* Breadcrumb Separator & Screen Name */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 border-l border-slate-800 pl-3 ml-2">
              <span className="text-slate-500 font-medium">Platform</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-slate-200 font-semibold">{getScreenTitle(currentScreen)}</span>
            </div>
          </div>

          {/* Middle: Live Search Bar & Demo Case Selector */}
          <div className="flex items-center gap-3 flex-1 max-w-2xl justify-center">
            {/* Quick Application Search */}
            <div className="relative hidden md:block w-56 lg:w-64">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search application / inst..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  className="w-full bg-[#111C30] border border-slate-800 text-xs text-slate-200 placeholder-slate-500 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition"
                />
              </div>

              {/* Autocomplete Dropdown */}
              {showSearchDropdown && filteredApps.length > 0 && (
                <div
                  className="absolute left-0 right-0 top-full mt-1.5 bg-[#111C30] border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50 py-1"
                  onMouseLeave={() => setShowSearchDropdown(false)}
                >
                  {filteredApps.slice(0, 5).map((app) => (
                    <button
                      key={app.id}
                      onClick={() => {
                        if (onSelectApplication) onSelectApplication(app.id);
                        setShowSearchDropdown(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#16233B] transition flex items-center justify-between"
                    >
                      <div className="truncate">
                        <span className="font-semibold text-slate-200">{app.application_number}</span>
                        <span className="text-slate-400 text-[11px] block truncate">{app.institution_name}</span>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 ml-2">
                        {app.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Demo Case Switcher */}
            <div className="flex items-center gap-1 bg-[#111C30] p-1 rounded-xl border border-slate-800 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 hidden sm:flex items-center gap-1">
                <Layers className="w-3 h-3 text-blue-400" />
                Scenario:
              </span>
              <button
                onClick={() => onSelectCase('APP-2026-CASE-A')}
                title="Compliant Application (Apex Institute)"
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                  activeCase === 'APP-2026-CASE-A'
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40'
                    : 'text-slate-300 hover:bg-[#16233B] hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden sm:inline">Case A</span>
                <span className="text-[10px] text-emerald-200 hidden md:inline">(Pass)</span>
              </button>

              <button
                onClick={() => onSelectCase('APP-2026-CASE-B')}
                title="Acreage Discrepancy (Pinnacle Tech)"
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                  activeCase === 'APP-2026-CASE-B'
                    ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400/40'
                    : 'text-slate-300 hover:bg-[#16233B] hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">Case B</span>
                <span className="text-[10px] text-amber-200 hidden md:inline">(Area Mismatch)</span>
              </button>

              <button
                onClick={() => onSelectCase('APP-2026-CASE-C')}
                title="Tampered Fire NOC & Expired Certificate (Zenith Global)"
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                  activeCase === 'APP-2026-CASE-C'
                    ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400/40'
                    : 'text-slate-300 hover:bg-[#16233B] hover:text-white'
                }`}
              >
                <XCircle className="w-3.5 h-3.5 text-rose-300" />
                <span className="hidden sm:inline">Case C</span>
                <span className="text-[10px] text-rose-200 hidden md:inline">(Tampered)</span>
              </button>
            </div>
          </div>

          {/* Right: Role Switcher / Authentication, Language & Notifications */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Language Selector */}
            <div className="flex items-center bg-[#111C30] px-2.5 py-1 rounded-xl border border-slate-800">
              <Globe className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as Language)}
                aria-label="Select Portal Language"
                className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="en" className="bg-[#111C30] text-white">EN</option>
                <option value="hi" className="bg-[#111C30] text-white">हिन्दी</option>
                <option value="te" className="bg-[#111C30] text-white">తెలుగు</option>
              </select>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-xl bg-[#111C30] hover:bg-[#16233B] text-slate-300 hover:text-white border border-slate-800 transition relative"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5 ring-2 ring-[#0B1220]" />
              </button>

              {notificationsOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-72 bg-[#111C30] border border-slate-700 rounded-xl shadow-2xl p-3 z-50"
                  onMouseLeave={() => setNotificationsOpen(false)}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-200">System Notifications</span>
                    <span className="text-[10px] text-blue-400 font-semibold">Live Audit</span>
                  </div>
                  <div className="space-y-2 mt-2">
                    <div className="p-2 bg-[#0B1220] rounded-lg border border-slate-800 text-[11px]">
                      <div className="flex items-center justify-between text-slate-300 font-medium">
                        <span>Tamper Anomaly Detected</span>
                        <span className="text-[9px] text-rose-400 font-bold">CRITICAL</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Fire NOC ELA anomaly 88.4% in Case C.</p>
                    </div>
                    <div className="p-2 bg-[#0B1220] rounded-lg border border-slate-800 text-[11px]">
                      <div className="flex items-center justify-between text-slate-300 font-medium">
                        <span>AICTE Handbook 2026-27</span>
                        <span className="text-[9px] text-emerald-400 font-bold">ACTIVE</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Vector index synchronized (12 chunks).</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Authentication & Profile State */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 bg-[#111C30] hover:bg-[#16233B] border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded-xl transition"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#0B1220] flex items-center justify-center font-bold text-xs text-white shadow-xs border border-blue-400/30">
                    {getRoleInitials(currentUser.role)}
                  </div>
                  <div className="text-left hidden sm:block">
                    <span className="text-xs font-bold text-slate-200 block truncate max-w-[120px]">
                      {currentUser.full_name || currentUser.email}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 block -mt-0.5">
                      {getRoleDisplayName(currentUser.role)}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {profileDropdownOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-64 bg-[#111C30] border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs"
                    onMouseLeave={() => setProfileDropdownOpen(false)}
                  >
                    <div className="p-2.5 bg-[#0B1220] rounded-lg border border-slate-800 mb-2">
                      <span className="font-bold text-slate-200 block truncate">
                        {currentUser.full_name || 'Institutional User'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono block truncate mt-0.5">
                        {currentUser.email}
                      </span>
                      {currentUser.institution_name && (
                        <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                          {currentUser.institution_name}
                        </span>
                      )}
                      <span className="mt-1.5 inline-block text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                        {getRoleDisplayName(currentUser.role)}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        navigate(getPermittedDashboardPath(currentUser.role));
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#16233B] text-slate-200 font-semibold transition flex items-center gap-2"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
                      <span>My Dashboard</span>
                    </button>

                    <button
                      onClick={() => {
                        navigate('/');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#16233B] text-slate-300 transition flex items-center gap-2"
                    >
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      <span>Public Landing Page</span>
                    </button>

                    <button
                      onClick={() => {
                        navigate('/login');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#16233B] text-slate-300 transition flex items-center gap-2"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                      <span>Switch Portal Role</span>
                    </button>

                    <div className="border-t border-slate-800 my-1" />

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        if (onLogout) onLogout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-950/40 text-rose-300 transition flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1D4ED8] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-900/30 transition hover:scale-[1.02]"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Login / Portals</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
