import React from 'react';
import {
  GraduationCap,
  ShieldAlert,
  Sliders,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowLeft,
  UserPlus
} from 'lucide-react';
import { useRouter } from '../../router/Router';

export const RoleSelectionScreen: React.FC = () => {
  const { navigate } = useRouter();

  const roleCards = [
    {
      id: 'applicant',
      roleKey: 'COLLEGE APPLICANT',
      title: 'College Applicant',
      buttonLabel: 'Enter Applicant Portal',
      subtitle: 'Institutional Scrutiny & Filing Portal',
      description:
        'Submit applications, upload documents, renew registration, track status and resolve deficiencies.',
      icon: GraduationCap,
      path: '/login/applicant',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      accentColor: 'from-emerald-600 to-teal-700',
      iconColor: 'text-emerald-600',
      borderColor: 'hover:border-emerald-500',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
      highlights: [
        'AICTE Handbook (2026-27 Norms) filing wizard',
        'Atomic field extraction & OCR verification',
        'Real-time regulatory compliance copilot',
        'Official tamper-evident PDF dossier export',
      ],
      showRegisterLink: true,
      registerLinkText: 'New institution? Register here',
      registerLinkPath: '/register',
    },
    {
      id: 'officer',
      roleKey: 'SECURITY OFFICER',
      title: 'Security Officer',
      buttonLabel: 'Enter Officer Portal',
      subtitle: 'Forensics & Scrutiny Investigation',
      description:
        'Review applications, inspect document evidence, assess compliance and record decisions.',
      icon: ShieldAlert,
      path: '/login/officer',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      accentColor: 'from-[#1D4ED8] to-[#0B1220]',
      iconColor: 'text-[#1D4ED8]',
      borderColor: 'hover:border-[#1D4ED8]',
      buttonBg: 'bg-[#1D4ED8] hover:bg-blue-700 focus:ring-blue-600',
      highlights: [
        'Automated triage priority scoring (0.35A + 0.30C + 0.35R)',
        '7-layer non-destructive authenticity pipeline',
        'Error Level Analysis (ELA) & heatmap forensics',
        'Authorized scrutiny determination & digital seal',
      ],
      showRegisterLink: true,
      registerLinkText: 'Need scrutiny privileges? Request account',
      registerLinkPath: '/register/officer',
    },
    {
      id: 'admin',
      roleKey: 'ADMINISTRATOR',
      title: 'Administrator',
      buttonLabel: 'Enter Administrator Portal',
      subtitle: 'Regulatory Catalog & Governance Controls',
      description:
        'Manage users, regulatory rules, system settings, monitor applications and view audit logs.',
      icon: Sliders,
      path: '/login/admin',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      accentColor: 'from-purple-600 to-indigo-900',
      iconColor: 'text-purple-600',
      borderColor: 'hover:border-purple-500',
      buttonBg: 'bg-purple-700 hover:bg-purple-800 focus:ring-purple-600',
      highlights: [
        'Multi-tenant user & role provisioning (RBAC)',
        'Handbook rule parameters & versioning control',
        'Automated DPDP Act retention sweep engine',
        'SHA-256 tamper-chained audit log continuity',
      ],
      showRegisterLink: false,
      registerLinkText: null,
      registerLinkPath: null,
    },
  ];

  return (
    <div className="min-h-[85vh] flex flex-col justify-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-[#111827]">
      {/* Navigation Return Button */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#111827] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Home</span>
        </button>
      </div>

      {/* Main Hero Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="w-14 h-14 bg-gradient-to-br from-[#1D4ED8] to-[#0B1220] rounded-2xl flex items-center justify-center mx-auto shadow-xl border border-blue-400/30 mb-4">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-[#1D4ED8] text-xs font-bold rounded-full border border-blue-200 mb-3">
          <Lock className="w-3.5 h-3.5" />
          <span>Role-Based Statutory Access Control</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827]">
          Select Your Portal
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B] mt-2 leading-relaxed">
          Select your authorized institutional or administrative role to access your dedicated workspace.
        </p>
      </div>

      {/* Three Role Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {roleCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className={`bg-white rounded-2xl border border-[#E2E8F0] ${card.borderColor} shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group`}
            >
              {/* Card Header & Content */}
              <div className="p-6 sm:p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.accentColor} flex items-center justify-center text-white shadow-md`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md border ${card.badgeColor}`}
                  >
                    {card.roleKey}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-[#111827] group-hover:text-[#1D4ED8] transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">{card.subtitle}</p>
                </div>

                <p className="text-xs text-[#64748B] leading-relaxed">{card.description}</p>

                {/* Highlights List */}
                <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Authorized Capabilities:
                  </span>
                  {card.highlights.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="leading-tight">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-6 pt-0 bg-white space-y-3">
                <button
                  onClick={() => navigate(card.path)}
                  className={`w-full py-2.5 px-4 rounded-xl text-white text-xs font-bold shadow-sm transition-all duration-150 flex items-center justify-center gap-2 group-hover:shadow-md ${card.buttonBg}`}
                >
                  <span>{card.buttonLabel}</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>

                {card.showRegisterLink && card.registerLinkPath ? (
                  <div className="text-center pt-1">
                    <button
                      onClick={() => navigate(card.registerLinkPath!)}
                      className="text-xs font-semibold text-[#1D4ED8] hover:text-blue-800 transition inline-flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{card.registerLinkText}</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center pt-1">
                    <span className="text-[11px] text-slate-400">
                      Accounts provisioned by Administrator
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Security Disclaimer Notice */}
      <div className="mt-12 text-center text-xs text-[#64748B] max-w-xl mx-auto border-t border-[#E2E8F0] pt-6">
        <p>
          <span className="font-bold text-[#111827]">Security Notice:</span> Credentials and role claims are verified server-side with cryptographic JWT tokens. Selecting a persona requires an authorized account matching that portal role.
        </p>
      </div>
    </div>
  );
};
