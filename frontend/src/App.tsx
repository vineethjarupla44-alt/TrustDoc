import React, { useState, useEffect } from 'react';
import type { Role, Language, ScreenId, ApplicationDetail, User } from './types';
import { StatutoryHeader } from './components/layout/StatutoryHeader';
import { AppSidebar } from './components/layout/AppSidebar';
import { PublicAuthLayout } from './components/layout/PublicAuthLayout';
import { PublicLandingPage } from './components/screens/PublicLandingPage';
import { RoleSelectionScreen } from './components/screens/RoleSelectionScreen';
import { RoleLoginScreen } from './components/screens/RoleLoginScreen';
import { RegisterScreen } from './components/screens/RegisterScreen';
import { OfficerRequestScreen } from './components/screens/OfficerRequestScreen';
import { AdminInitialSetupScreen } from './components/screens/AdminInitialSetupScreen';
import { ApplicantDashboard } from './components/screens/dashboards/ApplicantDashboard';
import { OfficerDashboard } from './components/screens/dashboards/OfficerDashboard';
import { AdminDashboard } from './components/screens/dashboards/AdminDashboard';
import { AccessDeniedScreen } from './components/screens/AccessDeniedScreen';
import { OverviewDashboard } from './components/screens/OverviewDashboard';
import { ApplicationListScreen } from './components/screens/ApplicationListScreen';
import { ApplicationDetailScreen } from './components/screens/ApplicationDetailScreen';
import { NewApplicationWizard } from './components/screens/NewApplicationWizard';
import { DocumentSplitScreen } from './components/screens/DocumentSplitScreen';
import { AuthenticityDossier } from './components/screens/AuthenticityDossier';
import { ComplianceFindingsScreen } from './components/screens/ComplianceFindingsScreen';
import { RiskSummaryScreen } from './components/screens/RiskSummaryScreen';
import { ChatbotScreen } from './components/screens/ChatbotScreen';
import { ReviewerDecisionScreen } from './components/screens/ReviewerDecisionScreen';
import { RegulatoryRulesScreen } from './components/screens/RegulatoryRulesScreen';
import { AuditAndReportScreen } from './components/screens/AuditAndReportScreen';
import { AdminConsoleScreen } from './components/screens/AdminConsoleScreen';
import { RouterProvider, useRouter } from './router/Router';
import {
  fetchApplications,
  fetchApplicationDetail,
  runValidation,
  seedDemoCases,
  fetchReportPDFBlob,
  downloadReportPDF,
  unmaskPII,
  getStoredAuth,
  clearStoredAuth,
  getMe,
  logoutUser,
} from './services/api';
import { Lock, FileText, Download, ExternalLink, X, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';

const MainApp: React.FC = () => {
  const { path, navigate } = useRouter();

  // Authentication & Role State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = getStoredAuth();
    return stored.user || null;
  });
  const [role, setRole] = useState<Role>(() => {
    const stored = getStoredAuth();
    return stored.user ? stored.user.role : 'REVIEWER';
  });

  const [language, setLanguage] = useState<Language>('en');
  const [activeCase, setActiveCase] = useState<string>('APP-2026-CASE-A');
  const [applications, setApplications] = useState<ApplicationDetail[]>([]);
  const [currentApp, setCurrentApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Global PII Unmasking Modal
  const [isPIIUnmasked, setIsPIIUnmasked] = useState<boolean>(false);
  const [showUnmaskModal, setShowUnmaskModal] = useState<boolean>(false);
  const [unmaskReason, setUnmaskReason] = useState<string>('');
  const [unmaskingLoading, setUnmaskingLoading] = useState<boolean>(false);

  // Official Statutory Dossier PDF Preview Modal
  const [showDossierModal, setShowDossierModal] = useState<boolean>(false);
  const [dossierLoading, setDossierLoading] = useState<boolean>(false);
  const [dossierUrl, setDossierUrl] = useState<string | null>(null);
  const [dossierFilename, setDossierFilename] = useState<string>('Official_Dossier.pdf');
  const [dossierSha256, setDossierSha256] = useState<string>('');
  const [dossierError, setDossierError] = useState<string | null>(null);
  const [dossierAppId, setDossierAppId] = useState<string | null>(null);

  // Cross-screen deep linking
  const [selectedRuleCode, setSelectedRuleCode] = useState<string>('');

  // Initial App and Auth Boot
  useEffect(() => {
    initApp();
    verifyAuth();
  }, []);

  const verifyAuth = async () => {
    const stored = getStoredAuth();
    if (stored.token) {
      try {
        const me = await getMe();
        setCurrentUser(me);
        setRole(me.role);
      } catch (err) {
        console.warn('Session verification notice:', err);
        clearStoredAuth();
        setCurrentUser(null);
      }
    }
  };

  const initApp = async () => {
    setLoading(true);
    try {
      await seedDemoCases();
      const apps = await fetchApplications();
      setApplications(apps);
      if (apps.length > 0) {
        const defaultApp = apps.find((a) => a.application_number === 'APP-2026-CASE-A') || apps[0];
        setActiveCase(defaultApp.application_number);
        await loadApplicationDetail(defaultApp.id, false);
      }
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshApplications = async () => {
    try {
      const apps = await fetchApplications();
      setApplications(apps);
      return apps;
    } catch (err) {
      console.error('Error refreshing applications:', err);
      return [];
    }
  };

  const loadApplicationDetail = async (id: string, unmask: boolean = false) => {
    setLoading(true);
    try {
      const data = await fetchApplicationDetail(id, unmask);
      setCurrentApp(data);
      setActiveCase(data.application_number);
    } catch (err) {
      console.error('Error fetching application detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCase = async (appNum: string) => {
    setActiveCase(appNum);
    setIsPIIUnmasked(false);
    try {
      const apps = await refreshApplications();
      const target = apps.find((a) => a.application_number === appNum);
      if (target) {
        await loadApplicationDetail(target.id, false);
      }
    } catch (err) {
      console.error('Case selection error:', err);
    }
  };

  const handleSelectAppById = async (id: string) => {
    setIsPIIUnmasked(false);
    await loadApplicationDetail(id, false);
  };

  const handleRunValidation = async () => {
    if (!currentApp) return;
    setLoading(true);
    try {
      await runValidation(currentApp.id);
      await loadApplicationDetail(currentApp.id, isPIIUnmasked);
      await refreshApplications();
    } catch (err) {
      console.error('Validation execution error:', err);
      alert('Failed to execute validation pipeline.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDossier = async (appId?: string) => {
    const targetId = appId || currentApp?.id;
    if (!targetId) return;

    if (dossierUrl) {
      URL.revokeObjectURL(dossierUrl);
      setDossierUrl(null);
    }

    setDossierAppId(targetId);
    setShowDossierModal(true);
    setDossierLoading(true);
    setDossierError(null);

    try {
      const { url, filename, sha256 } = await fetchReportPDFBlob(targetId, 'inline');
      setDossierUrl(url);
      setDossierFilename(filename);
      if (sha256) setDossierSha256(sha256);
    } catch (err: any) {
      console.error('Failed to load official dossier:', err);
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string'
        ? detail
        : 'Failed to authenticate and retrieve official compliance dossier. Please verify regulatory clearance.';
      setDossierError(message);
    } finally {
      setDossierLoading(false);
    }
  };

  const handleCloseDossierModal = () => {
    if (dossierUrl) {
      URL.revokeObjectURL(dossierUrl);
    }
    setDossierUrl(null);
    setShowDossierModal(false);
    setDossierError(null);
    setDossierSha256('');
  };

  const handleDownloadReport = (appId?: string) => {
    handleOpenDossier(appId);
  };

  const handleUnmaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentApp || !unmaskReason.trim()) return;
    setUnmaskingLoading(true);
    try {
      await unmaskPII(currentApp.id, unmaskReason);
      setIsPIIUnmasked(true);
      setShowUnmaskModal(false);
      setUnmaskReason('');
      await loadApplicationDetail(currentApp.id, true);
    } catch (err) {
      console.error('PII unmask error:', err);
      alert('Failed to authorize PII unmasking.');
    } finally {
      setUnmaskingLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    clearStoredAuth();
    setCurrentUser(null);
    navigate('/');
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setRole(user.role);
    if (user.role === 'APPLICANT') {
      navigate('/applicant/dashboard');
    } else if (user.role === 'ADMIN') {
      navigate('/admin/dashboard');
    } else {
      navigate('/officer/dashboard');
    }
  };

  // Convert current path to ScreenId for backward-compatible sidebar highlighting
  const getScreenFromPath = (currentPath: string): ScreenId => {
    if (currentPath === '/' || currentPath === '') return 'landing';
    if (currentPath === '/login' || currentPath === '/login/roles' || currentPath === '/portals') return 'role_selection';
    if (currentPath === '/login/applicant') return 'login_applicant';
    if (currentPath === '/login/officer') return 'login_officer';
    if (currentPath === '/login/admin') return 'login_admin';
    if (currentPath === '/register' || currentPath === '/register/applicant' || currentPath === '/register/officer') return 'register';
    if (currentPath === '/admin/initial-setup') return 'login_admin';
    if (currentPath === '/applicant/dashboard') return 'applicant_dashboard';
    if (currentPath === '/officer/dashboard') return 'officer_dashboard';
    if (currentPath === '/admin/dashboard') return 'admin_dashboard';
    if (currentPath === '/overview' || currentPath === '/dashboard') return 'overview';
    if (currentPath === '/applications') return 'applications';
    if (currentPath.startsWith('/applications/') || currentPath === '/application-detail') return 'application_detail';
    if (currentPath === '/new-application') return 'new_application';
    if (currentPath === '/document-split' || currentPath === '/documents') return 'document_split';
    if (currentPath === '/authenticity-dossier' || currentPath === '/forensics') return 'authenticity_dossier';
    if (currentPath === '/compliance-findings' || currentPath === '/compliance') return 'compliance_findings';
    if (currentPath === '/risk-summary' || currentPath === '/risk-scorecard') return 'risk_summary';
    if (currentPath === '/chatbot') return 'chatbot';
    if (currentPath === '/reviewer-decision' || currentPath === '/decisions') return 'reviewer_decision';
    if (currentPath === '/regulatory-rules' || currentPath === '/regulations') return 'regulatory_rules';
    if (currentPath === '/audit-and-report' || currentPath === '/audit') return 'audit_and_report';
    if (currentPath === '/admin-console') return 'admin_console';
    return 'overview';
  };

  const currentScreen = getScreenFromPath(path);

  // Navigate handler from sidebar or header
  const handleNavigateScreen = (screen: ScreenId) => {
    switch (screen) {
      case 'landing': navigate('/'); break;
      case 'overview': navigate('/overview'); break;
      case 'applicant_dashboard': navigate('/applicant/dashboard'); break;
      case 'officer_dashboard': navigate('/officer/dashboard'); break;
      case 'admin_dashboard': navigate('/admin/dashboard'); break;
      case 'role_selection':
      case 'login': navigate('/login'); break;
      case 'login_applicant': navigate('/login/applicant'); break;
      case 'login_officer': navigate('/login/officer'); break;
      case 'login_admin': navigate('/login/admin'); break;
      case 'register': navigate('/register'); break;
      case 'applications': navigate('/applications'); break;
      case 'application_detail': navigate('/application-detail'); break;
      case 'new_application': navigate('/new-application'); break;
      case 'document_split': navigate('/document-split'); break;
      case 'authenticity_dossier': navigate('/authenticity-dossier'); break;
      case 'compliance_findings': navigate('/compliance-findings'); break;
      case 'risk_summary': navigate('/risk-summary'); break;
      case 'chatbot': navigate('/chatbot'); break;
      case 'reviewer_decision': navigate('/reviewer-decision'); break;
      case 'regulatory_rules': navigate('/regulatory-rules'); break;
      case 'audit_and_report': navigate('/audit-and-report'); break;
      case 'admin_console': navigate('/admin-console'); break;
      default: navigate('/overview'); break;
    }
  };

  // Badge calculations for sidebar
  const findingsCount = currentApp?.findings?.length || 0;
  const docsCount = currentApp?.documents?.length || 0;
  const pendingReviewsCount = applications.filter(
    (a) => a.status === 'PROCESSING' || a.status === 'FLAGGED' || a.status === 'DEFICIENT' || a.status === 'SUBMITTED'
  ).length;

  // -------------------------------------------------------------------------
  // PUBLIC & STANDALONE ROUTES (NO SIDEBAR, NO SCENARIO SWITCHER, NO DASHBOARD CHROME)
  // -------------------------------------------------------------------------

  // 1. Root Public Landing Page
  if (path === '/') {
    return (
      <PublicLandingPage
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  // 2. Standalone Portal Selection Page (/login, /portals, /login/roles)
  if (path === '/login' || path === '/portals' || path === '/login/roles') {
    return (
      <PublicAuthLayout backTo={{ label: 'Back to Home', path: '/' }}>
        <RoleSelectionScreen />
      </PublicAuthLayout>
    );
  }

  // 3. Standalone Role-Based Login Forms
  if (path === '/login/applicant') {
    return (
      <PublicAuthLayout backTo={{ label: 'Back to Portals', path: '/login' }}>
        <RoleLoginScreen
          roleVariant="applicant"
          onLoginSuccess={handleLoginSuccess}
        />
      </PublicAuthLayout>
    );
  }

  if (path === '/login/officer') {
    return (
      <PublicAuthLayout backTo={{ label: 'Back to Portals', path: '/login' }}>
        <RoleLoginScreen
          roleVariant="officer"
          onLoginSuccess={handleLoginSuccess}
        />
      </PublicAuthLayout>
    );
  }

  if (path === '/login/admin') {
    return (
      <PublicAuthLayout backTo={{ label: 'Back to Portals', path: '/login' }}>
        <RoleLoginScreen
          roleVariant="admin"
          onLoginSuccess={handleLoginSuccess}
        />
      </PublicAuthLayout>
    );
  }

  // 4. Standalone Public Registration (/register, /register/applicant)
  if (path === '/register' || path === '/register/applicant') {
    return (
      <PublicAuthLayout backTo={{ label: 'Back to Applicant Login', path: '/login/applicant' }}>
        <RegisterScreen />
      </PublicAuthLayout>
    );
  }

  // 5. Standalone Security Officer Request (/register/officer)
  if (path === '/register/officer') {
    return (
      <PublicAuthLayout backTo={{ label: 'Back to Officer Login', path: '/login/officer' }}>
        <OfficerRequestScreen />
      </PublicAuthLayout>
    );
  }

  // 6. Standalone Admin Initial Setup (/admin/initial-setup)
  if (path === '/admin/initial-setup') {
    return (
      <PublicAuthLayout backTo={{ label: 'Back to Admin Login', path: '/login/admin' }}>
        <AdminInitialSetupScreen />
      </PublicAuthLayout>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col font-sans text-[#111827]">
      {/* Statutory Header */}
      <StatutoryHeader
        currentRole={role}
        onRoleChange={setRole}
        language={language}
        onLanguageChange={setLanguage}
        activeCase={activeCase}
        onSelectCase={handleSelectCase}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        currentScreen={currentScreen}
        applications={applications}
        onSelectApplication={(id) => {
          handleSelectAppById(id);
          navigate('/application-detail');
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Workspace: Sidebar + Screen Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* App Sidebar */}
        <AppSidebar
          currentScreen={currentScreen}
          onNavigate={handleNavigateScreen}
          language={language}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          badgeCounts={{
            findings: findingsCount,
            documents: docsCount,
            reviewsPending: pendingReviewsCount,
          }}
          currentRole={currentUser ? currentUser.role : role}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Dynamic Screen Viewport */}
        <main className="flex-1 overflow-y-auto">
          {loading && !currentApp ? (
            <div className="flex items-center justify-center h-full p-12 text-slate-400">
              <span className="text-xs font-semibold">Synchronizing regulatory case data...</span>
            </div>
          ) : (
            <>
              {/* 1. COLLEGE APPLICANT DASHBOARD: /applicant/dashboard */}
              {path === '/applicant/dashboard' && (
                currentUser && currentUser.role === 'APPLICANT' ? (
                  <ApplicantDashboard
                    applications={applications}
                    currentApp={currentApp}
                    onSelectApplication={(id) => {
                      handleSelectAppById(id);
                      navigate('/application-detail');
                    }}
                    onNavigateToScreen={handleNavigateScreen}
                    onRefresh={() => {
                      if (currentApp) loadApplicationDetail(currentApp.id, isPIIUnmasked);
                      refreshApplications();
                    }}
                    language={language}
                  />
                ) : (
                  <AccessDeniedScreen
                    currentUser={currentUser}
                    requiredRole="College Applicant"
                    onLogout={handleLogout}
                  />
                )
              )}

              {/* 5. SECURITY OFFICER DASHBOARD: /officer/dashboard */}
              {path === '/officer/dashboard' && (
                currentUser && (currentUser.role === 'REVIEWER' || currentUser.role === 'AUDITOR' || currentUser.role === 'ADMIN') ? (
                  <OfficerDashboard
                    applications={applications}
                    currentApp={currentApp}
                    onSelectApplication={(id) => {
                      handleSelectAppById(id);
                      navigate('/application-detail');
                    }}
                    onNavigateToScreen={handleNavigateScreen}
                    onRefresh={() => {
                      if (currentApp) loadApplicationDetail(currentApp.id, isPIIUnmasked);
                      refreshApplications();
                    }}
                    language={language}
                  />
                ) : (
                  <AccessDeniedScreen
                    currentUser={currentUser}
                    requiredRole="Security Officer or Administrator"
                    onLogout={handleLogout}
                  />
                )
              )}

              {/* 6. ADMINISTRATOR DASHBOARD: /admin/dashboard */}
              {path === '/admin/dashboard' && (
                currentUser && currentUser.role === 'ADMIN' ? (
                  <AdminDashboard
                    applications={applications}
                    onNavigateToScreen={handleNavigateScreen}
                    onRefresh={() => {
                      if (currentApp) loadApplicationDetail(currentApp.id, isPIIUnmasked);
                      refreshApplications();
                    }}
                    language={language}
                  />
                ) : (
                  <AccessDeniedScreen
                    currentUser={currentUser}
                    requiredRole="Administrator"
                    onLogout={handleLogout}
                  />
                )
              )}

              {/* 7. OVERVIEW DASHBOARD: /overview or /dashboard */}
              {(path === '/overview' || path === '/dashboard' || path === '/internal-dashboard') && (
                <OverviewDashboard
                  applications={applications}
                  onSelectApplication={(id) => {
                    handleSelectAppById(id);
                    navigate('/application-detail');
                  }}
                  onSelectCase={handleSelectCase}
                  language={language}
                  onNavigateToScreen={handleNavigateScreen}
                />
              )}

              {/* 8. APPLICATIONS REGISTRY: /applications */}
              {path === '/applications' && (
                <ApplicationListScreen
                  applications={applications}
                  onSelectApplication={(id) => {
                    handleSelectAppById(id);
                    navigate('/application-detail');
                  }}
                  language={language}
                  onNewApplication={() => navigate('/new-application')}
                />
              )}

              {/* 9. APPLICATION DETAIL: /application-detail */}
              {(path === '/application-detail' || path.startsWith('/applications/')) && (
                <ApplicationDetailScreen
                  application={currentApp}
                  userRole={currentUser ? currentUser.role : role}
                  onNavigateToScreen={handleNavigateScreen}
                  onRefresh={() => {
                    if (currentApp) loadApplicationDetail(currentApp.id, isPIIUnmasked);
                    refreshApplications();
                  }}
                />
              )}

              {/* 10. NEW SUBMISSION: /new-application */}
              {path === '/new-application' && (
                <NewApplicationWizard
                  language={language}
                  onApplicationCreated={(newId) => {
                    refreshApplications();
                    handleSelectAppById(newId);
                    navigate('/application-detail');
                  }}
                  onCancel={() => navigate('/applications')}
                />
              )}

              {/* 11. DOCUMENT & FIELDS WORKBENCH: /document-split */}
              {(path === '/document-split' || path === '/documents') && (
                <DocumentSplitScreen
                  application={currentApp}
                  language={language}
                  isPIIUnmasked={isPIIUnmasked}
                  onRequestUnmask={() => setShowUnmaskModal(true)}
                  onRefresh={() => {
                    if (currentApp) loadApplicationDetail(currentApp.id, isPIIUnmasked);
                  }}
                  onNavigateToAuthenticity={() => navigate('/authenticity-dossier')}
                />
              )}

              {/* 12. FORENSICS DOSSIER: /authenticity-dossier */}
              {(path === '/authenticity-dossier' || path === '/forensics') && (
                <AuthenticityDossier
                  application={currentApp}
                  language={language}
                  onRefresh={() => {
                    if (currentApp) loadApplicationDetail(currentApp.id, isPIIUnmasked);
                  }}
                  onNavigateToFindings={() => navigate('/compliance-findings')}
                />
              )}

              {/* 13. COMPLIANCE FINDINGS: /compliance-findings */}
              {(path === '/compliance-findings' || path === '/compliance') && (
                <ComplianceFindingsScreen
                  application={currentApp}
                  role={currentUser ? currentUser.role : role}
                  language={language}
                  onRefresh={() => {
                    if (currentApp) loadApplicationDetail(currentApp.id, isPIIUnmasked);
                  }}
                  onNavigateToRemediation={() => navigate('/risk-summary')}
                  onAskChatbot={(clause: string) => {
                    setSelectedRuleCode(clause);
                    navigate('/chatbot');
                  }}
                />
              )}

              {/* 14. RISK SUMMARY & PDF EXPORT: /risk-summary */}
              {(path === '/risk-summary' || path === '/risk-scorecard') && (
                <RiskSummaryScreen
                  application={currentApp}
                  userRole={currentUser ? currentUser.role : role}
                  language={language}
                  onRunValidation={handleRunValidation}
                  onDownloadReport={handleDownloadReport}
                  onRefresh={() => {
                    if (currentApp) loadApplicationDetail(currentApp.id, isPIIUnmasked);
                  }}
                  onNavigateToChatbot={() => navigate('/chatbot')}
                  onNavigateToDecision={() => navigate('/reviewer-decision')}
                />
              )}

              {/* 15. ADVISORY CHATBOT: /chatbot */}
              {path === '/chatbot' && (
                <ChatbotScreen
                  application={currentApp}
                  language={language}
                  onNavigateToRule={(ruleCode) => {
                    setSelectedRuleCode(ruleCode);
                    navigate('/regulatory-rules');
                  }}
                />
              )}

              {/* 16. SCRUTINY DECISIONS: /reviewer-decision */}
              {(path === '/reviewer-decision' || path === '/decisions') && (
                <ReviewerDecisionScreen
                  applications={applications}
                  currentApplication={currentApp}
                  onSelectApplication={(id) => handleSelectAppById(id)}
                  onRefresh={() => {
                    refreshApplications();
                    if (currentApp) loadApplicationDetail(currentApp.id, isPIIUnmasked);
                  }}
                  onViewReport={handleDownloadReport}
                />
              )}

              {/* 17. REGULATORY RULES CATALOG: /regulatory-rules */}
              {(path === '/regulatory-rules' || path === '/regulations') && (
                <RegulatoryRulesScreen
                  initialSearchQuery={selectedRuleCode}
                  onAskChatbot={(promptText: string) => {
                    setSelectedRuleCode(promptText);
                    navigate('/chatbot');
                  }}
                />
              )}

              {/* 18. AUDIT LOGS & REPORT: /audit-and-report */}
              {(path === '/audit-and-report' || path === '/audit') && (
                <AuditAndReportScreen
                  application={currentApp}
                  userRole={currentUser ? currentUser.role : role}
                  onRefreshApplication={() => {
                    if (currentApp) loadApplicationDetail(currentApp.id, isPIIUnmasked);
                  }}
                />
              )}

              {/* 19. ADMIN CONSOLE: /admin-console */}
              {path === '/admin-console' && (
                currentUser && currentUser.role === 'ADMIN' ? (
                  <AdminConsoleScreen
                    language={language}
                    currentRole={role}
                  />
                ) : (
                  <AccessDeniedScreen
                    currentUser={currentUser}
                    requiredRole="Administrator"
                    onLogout={handleLogout}
                  />
                )
              )}
            </>
          )}
        </main>
      </div>

      {/* Global PII Unmasking Modal */}
      {showUnmaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-slate-900 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                <Lock className="w-5 h-5 text-amber-700" />
              </div>
              <h3 className="text-base font-bold">Authorized PII Unmask Request</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Pursuant to institutional scrutiny policy and DPDP Act standards, unmasking sensitive personal identifiers requires an explicit, audited statement of purpose.
            </p>

            <form onSubmit={handleUnmaskSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Statutory Purpose / Scrutiny Justification:
                </label>
                <textarea
                  rows={3}
                  required
                  value={unmaskReason}
                  onChange={(e) => setUnmaskReason(e.target.value)}
                  placeholder="e.g. Scrutiny Committee physical spot verification of Society PAN and registered title deed bounds..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowUnmaskModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!unmaskReason.trim() || unmaskingLoading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-700 rounded-lg disabled:bg-slate-300 shadow-sm"
                >
                  {unmaskingLoading ? 'Logging & Authorizing...' : 'Authorize & Unmask'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ============================================================== */}
      {/* STATUTORY OFFICIAL DOSSIER PDF PREVIEW MODAL                   */}
      {/* ============================================================== */}
      {showDossierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold tracking-tight">Statutory Compliance Inspection Dossier</h3>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      AUTHENTICATED &amp; SEALED
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono truncate max-w-md">
                    {dossierFilename} {dossierSha256 ? `• SHA-256: ${dossierSha256.substring(0, 16)}...` : ''}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {dossierAppId && (
                  <button
                    onClick={() => downloadReportPDF(dossierAppId, dossierFilename)}
                    disabled={dossierLoading || !dossierUrl}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    title="Download Dossier PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download PDF</span>
                  </button>
                )}

                {dossierUrl && (
                  <a
                    href={dossierUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
                    title="Open in Full Tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Full Tab</span>
                  </a>
                )}

                <button
                  onClick={handleCloseDossierModal}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
                  title="Close Dossier"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-100 relative overflow-hidden flex flex-col">
              {dossierLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Generating &amp; Authenticating Statutory Dossier...</p>
                  <p className="text-xs text-slate-400 mt-1">Compiling forensic checks, multi-pillar scorecard, and statutory audit seals.</p>
                </div>
              ) : dossierError ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">Access Authorization Notice</h4>
                  <p className="text-xs text-slate-600 mb-4 leading-relaxed">{dossierError}</p>
                  <div className="flex gap-2">
                    {dossierAppId && (
                      <button
                        onClick={() => handleOpenDossier(dossierAppId)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                      >
                        Retry Authorization
                      </button>
                    )}
                    <button
                      onClick={handleCloseDossierModal}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : dossierUrl ? (
                <iframe
                  src={dossierUrl}
                  title="Official Statutory Compliance Dossier"
                  className="w-full h-full border-none bg-slate-200"
                />
              ) : null}
            </div>

            {/* Modal Footer / Legal Notice */}
            <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                <span>Confidential regulatory dossier. Access is logged in the immutable audit ledger.</span>
              </span>
              <span className="font-mono text-slate-400">TrustDoc Statutory Intelligence • AICTE Scrutiny SOP</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <RouterProvider>
      <MainApp />
    </RouterProvider>
  );
};

export default App;
