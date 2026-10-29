import React from 'react';
import {
  LayoutDashboard,
  FileCheck2,
  FileText,
  FolderPlus,
  SplitSquareVertical,
  ShieldAlert,
  ClipboardList,
  BarChart3,
  Bot,
  Gavel,
  BookOpen,
  History,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  Sliders,
  LogOut,
} from 'lucide-react';
import type { ScreenId, Language, Role, User } from '../../types';

interface AppSidebarProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  language: Language;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  badgeCounts?: {
    findings?: number;
    documents?: number;
    reviewsPending?: number;
  };
  currentRole?: Role;
  currentUser?: User | null;
  onLogout?: () => void;
}

interface NavSection {
  title: string;
  items: Array<{
    id: ScreenId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
    badgeColor?: string;
  }>;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentScreen,
  onNavigate,
  language,
  collapsed = false,
  onToggleCollapse,
  badgeCounts = {},
  currentRole = 'REVIEWER',
  currentUser,
  onLogout,
}) => {
  void language;
  // Build role-tailored navigation items
  const getRoleSections = (): NavSection[] => {
    if (currentRole === 'APPLICANT') {
      return [
        {
          title: 'Applicant Portal',
          items: [
            { id: 'applicant_dashboard', label: 'Applicant Dashboard', icon: LayoutDashboard },
            { id: 'applications', label: 'My Applications', icon: FileCheck2 },
            { id: 'new_application', label: 'New Submission', icon: FolderPlus },
          ],
        },
        {
          title: 'Document & Compliance',
          items: [
            {
              id: 'document_split',
              label: 'Upload & Fields',
              icon: SplitSquareVertical,
              badge: badgeCounts.documents,
              badgeColor: 'bg-blue-900/60 text-blue-300 border-blue-700/50',
            },
            {
              id: 'compliance_findings',
              label: 'Compliance Findings',
              icon: ClipboardList,
              badge: badgeCounts.findings,
              badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
            },
            { id: 'chatbot', label: 'Advisory Copilot', icon: Bot },
            { id: 'regulatory_rules', label: 'AICTE Handbook', icon: BookOpen },
          ],
        },
        {
          title: 'Account & Access',
          items: [
            { id: 'role_selection', label: 'Switch Portal Role', icon: KeyRound },
          ],
        },
      ];
    }

    if (currentRole === 'ADMIN') {
      return [
        {
          title: 'Control Plane',
          items: [
            { id: 'admin_dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
            { id: 'admin_console', label: 'Administration Console', icon: Sliders },
            { id: 'audit_and_report', label: 'Audit Logs & Retention', icon: History },
          ],
        },
        {
          title: 'Application Oversight',
          items: [
            {
              id: 'reviewer_decision',
              label: 'Scrutiny Decisions',
              icon: Gavel,
              badge: badgeCounts.reviewsPending,
              badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
            },
            { id: 'applications', label: 'Applications Registry', icon: FileCheck2 },
            { id: 'authenticity_dossier', label: 'Forensics Dossier', icon: ShieldAlert },
            { id: 'regulatory_rules', label: 'Handbook Catalog', icon: BookOpen },
          ],
        },
        {
          title: 'Account & Access',
          items: [
            { id: 'role_selection', label: 'Switch Portal Role', icon: KeyRound },
          ],
        },
      ];
    }

    // Default: Security Officer / Reviewer / Auditor
    return [
      {
        title: 'Scrutiny Desk',
        items: [
          { id: 'officer_dashboard', label: 'Officer Dashboard', icon: LayoutDashboard },
          {
            id: 'reviewer_decision',
            label: 'Scrutiny Decisions',
            icon: Gavel,
            badge: badgeCounts.reviewsPending,
            badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
          },
          { id: 'applications', label: 'Applications Registry', icon: FileCheck2 },
          { id: 'application_detail', label: 'Application Detail', icon: FileText },
        ],
      },
      {
        title: 'Forensics & Evidence',
        items: [
          {
            id: 'document_split',
            label: 'Document & Fields',
            icon: SplitSquareVertical,
            badge: badgeCounts.documents,
            badgeColor: 'bg-blue-900/60 text-blue-300 border-blue-700/50',
          },
          {
            id: 'authenticity_dossier',
            label: 'Forensics Dossier',
            icon: ShieldAlert,
          },
          {
            id: 'compliance_findings',
            label: 'Compliance Findings',
            icon: ClipboardList,
            badge: badgeCounts.findings,
            badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
          },
          {
            id: 'risk_summary',
            label: 'Risk Scorecard',
            icon: BarChart3,
          },
        ],
      },
      {
        title: 'Decisions & Governance',
        items: [
          { id: 'chatbot', label: 'Advisory Chatbot', icon: Bot },
          { id: 'regulatory_rules', label: 'Regulatory Catalog', icon: BookOpen },
          { id: 'audit_and_report', label: 'Audit Logs & Export', icon: History },
        ],
      },
      {
        title: 'Account & Access',
        items: [
          { id: 'role_selection', label: 'Switch Portal Role', icon: KeyRound },
        ],
      },
    ];
  };

  const sections = getRoleSections();

  return (
    <aside
      className={`bg-[#0B1220] border-r border-[#1E293B] text-slate-300 flex flex-col transition-all duration-300 shrink-0 select-none ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header bar within sidebar with Collapse Toggle */}
      <div className="h-12 px-3 border-b border-[#1E293B] flex items-center justify-between text-xs font-semibold text-slate-400">
        {!collapsed && (
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            Verification Console
          </div>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#111C30] transition border border-transparent hover:border-slate-800 ${
              collapsed ? 'mx-auto' : 'ml-auto'
            }`}
            aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-4 dark-scrollbar">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {!collapsed && (
              <div className="px-3 pt-1 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentScreen === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center px-3 py-2 rounded-xl text-xs font-medium transition-all group relative ${
                    isActive
                      ? 'bg-[#1D4ED8] text-white font-semibold shadow-md shadow-blue-900/40'
                      : 'text-slate-300 hover:bg-[#111C30] hover:text-white'
                  } ${collapsed ? 'justify-center' : 'justify-between'}`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!collapsed && item.badge !== undefined && Number(item.badge) > 0 && (
                    <span
                      className={`ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full border ${
                        isActive
                          ? 'bg-white text-[#1D4ED8] border-white'
                          : item.badgeColor || 'bg-[#16233B] text-slate-300 border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Active Indicator Bar on Left */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-white rounded-r-full" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Branding & Logout */}
      <div className="p-3 border-t border-[#1E293B] bg-[#080E18] text-[11px] text-slate-400 space-y-2">
        {currentUser && onLogout && (
          <button
            onClick={onLogout}
            title={collapsed ? 'Log Out' : undefined}
            className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition text-xs font-semibold ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Log Out Session</span>}
          </button>
        )}

        {!collapsed && (
          <>
            <div className="flex items-center justify-between pt-1 border-t border-slate-900">
              <span className="font-bold text-slate-300">TrustDoc Platform</span>
              <span className="px-1.5 py-0.2 text-[9px] bg-blue-500/10 text-blue-400 rounded border border-blue-500/30 font-semibold">
                v2.4
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              AICTE Handbook 2026-27 Norms
            </p>
          </>
        )}
      </div>
    </aside>
  );
};
