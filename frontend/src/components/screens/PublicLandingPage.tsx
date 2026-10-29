import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  GraduationCap,
  Settings,
  ArrowRight,
  Play,
  FileText,
  FileCheck2,
  CheckCircle2,
  Cpu,
  Layers,
  Scale,
  Search,
  BarChart3,
  UploadCloud,
  FileSearch,
  CheckCircle,
  Lock,
  X,
  Sparkles,
  Building,
  Users,
  LogOut
} from 'lucide-react';
import { useRouter } from '../../router/Router';
import type { User } from '../../types';

interface PublicLandingPageProps {
  currentUser?: User | null;
  onLogout?: () => void;
}

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({
  currentUser,
  onLogout
}) => {
  const { navigate } = useRouter();
  const [showDemoModal, setShowDemoModal] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>('home');

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* ------------------------------------------------------------- */}
      {/* TOP STATUTORY LANDING HEADER                                  */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 bg-[#0B1220]/95 backdrop-blur-md border-b border-[#1E293B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Left Brand Identifier */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-[#1D4ED8] flex items-center justify-center shadow-lg shadow-blue-600/30 border border-blue-400/30">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white font-sans">
                  TrustDoc
                </span>
                <span className="hidden sm:inline-block text-[11px] font-medium text-sky-400">
                  AI Regulatory Intelligence
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="font-semibold text-slate-300">SIH 2026</span>
                <span className="text-slate-600">|</span>
                <span>Project ID: SIH26261</span>
              </div>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold tracking-wide">
            <button
              onClick={() => scrollToSection('home')}
              className={`transition-colors relative py-1 ${
                activeSection === 'home'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Home
              {activeSection === 'home' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => scrollToSection('portals')}
              className={`transition-colors relative py-1 ${
                activeSection === 'portals'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Portals
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className={`transition-colors relative py-1 ${
                activeSection === 'features'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className={`transition-colors relative py-1 ${
                activeSection === 'how-it-works'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('security')}
              className={`transition-colors relative py-1 ${
                activeSection === 'security'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Security
            </button>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-white leading-tight">
                    {currentUser.full_name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold">
                    {currentUser.role}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (currentUser.role === 'APPLICANT') navigate('/applicant/dashboard');
                    else if (currentUser.role === 'ADMIN') navigate('/admin/dashboard');
                    else navigate('/officer/dashboard');
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center gap-1.5"
                >
                  <span>My Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 text-xs font-bold text-slate-200 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-all"
                >
                  Login
                </button>
                <button
                  onClick={() => scrollToSection('portals')}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 transition-all flex items-center gap-1"
                >
                  <span>Get Started</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 1. HERO SECTION                                               */}
      {/* ------------------------------------------------------------- */}
      <section
        id="home"
        className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 bg-gradient-to-b from-[#0B1220] via-[#0F172A] to-[#0B1220]"
      >
        {/* Ambient Radial Background Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[450px] h-[350px] bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Headline, Description & CTAs */}
            <div className="lg:col-span-6 space-y-6">
              {/* Trust Badge Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-500/30 text-blue-400 text-[11px] font-bold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span>TRUST • TRANSPARENCY • COMPLIANCE</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-black tracking-tight text-white leading-[1.12]">
                Verify Documents. <br />
                Detect Risks.{' '}
                <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  Build Trust.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed font-normal">
                An AI-powered platform that helps institutions validate applications, identify
                inconsistencies, and streamline regulatory compliance with explainable AI.
              </p>

              {/* CTA Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => scrollToSection('portals')}
                  className="px-6 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 transition-all flex items-center gap-2 group"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => setShowDemoModal(true)}
                  className="px-5 py-3 text-sm font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl transition-all flex items-center gap-2.5"
                >
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                    <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                  </div>
                  <span>Watch Demo</span>
                </button>
              </div>

              {/* Three Mini Feature Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800/80">
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900/40 border border-slate-800/60">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                    <FileSearch className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white">AI Document Analysis</div>
                    <div className="text-[10px] text-slate-400">Extract & validate</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900/40 border border-slate-800/60">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white">Regulatory Compliance</div>
                    <div className="text-[10px] text-slate-400">Rule-based verification</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900/40 border border-slate-800/60">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white">Explainable Results</div>
                    <div className="text-[10px] text-slate-400">Evidence & citations</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Document Verification Graphic */}
            <div className="lg:col-span-6 relative">
              <div className="relative p-2 sm:p-4 rounded-3xl bg-gradient-to-br from-slate-800/60 via-slate-900/60 to-slate-950/80 border border-slate-700/60 shadow-2xl backdrop-blur-xl">
                {/* Simulated Pipeline Flow */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Left: Stack of Institutional Documents */}
                  <div className="w-full sm:w-44 space-y-2 shrink-0">
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center gap-2 shadow-sm hover:border-slate-500 transition-colors">
                      <div className="w-6 h-6 rounded bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-bold">
                        PDF
                      </div>
                      <span className="text-[11px] font-semibold text-slate-200 truncate">
                        Registration Certificate
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-blue-500/40 flex items-center gap-2 shadow-sm bg-blue-950/20">
                      <div className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                        <Shield className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-semibold text-blue-200 truncate">
                        AICTE Approval
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center gap-2 shadow-sm hover:border-slate-500 transition-colors">
                      <div className="w-6 h-6 rounded bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
                        <Building className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-200 truncate">
                        Building Plan
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center gap-2 shadow-sm hover:border-slate-500 transition-colors">
                      <div className="w-6 h-6 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-200 truncate">
                        Faculty Details
                      </span>
                    </div>
                  </div>

                  {/* Connecting AI Processor Icon */}
                  <div className="hidden sm:flex flex-col items-center justify-center shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/50 border border-blue-300/40 text-white font-black text-xs">
                      AI
                    </div>
                  </div>

                  {/* Right: Sleek Pristine Document Verification Card */}
                  <div className="flex-1 w-full bg-white rounded-2xl p-4 text-slate-900 shadow-2xl border border-slate-200">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-extrabold text-slate-900">
                          Document Verification
                        </span>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>Valid Document</span>
                      </span>
                    </div>

                    {/* Metadata Table Rows */}
                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
                        <span className="text-slate-500">Institution Name</span>
                        <span className="font-bold text-slate-800">
                          ABC Institute of Technology
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
                        <span className="text-slate-500">Registration Number</span>
                        <span className="font-mono font-bold text-blue-600">
                          1-439877261
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
                        <span className="text-slate-500">Valid Upto</span>
                        <span className="font-semibold text-slate-800">31 Mar 2026</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
                        <span className="text-slate-500">Document Type</span>
                        <span className="font-semibold text-slate-800">AICTE Approval</span>
                      </div>
                      <div className="pt-1">
                        <div className="flex justify-between items-center text-[10px] font-semibold mb-1">
                          <span className="text-slate-500">Confidence</span>
                          <span className="text-blue-600 font-bold">98%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full w-[98%]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom 3 Verification Indicator Sub-Cards */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800">
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                    <div className="text-[10px] font-medium text-slate-400 mb-1">Authenticity Check</div>
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>No Tampering</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                    <div className="text-[10px] font-medium text-slate-400 mb-1">Compliance Check</div>
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <Scale className="w-3.5 h-3.5" />
                      <span>Compliant</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                    <div className="text-[10px] font-medium text-slate-400 mb-1">Risk Indicator</div>
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>Low Risk</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 2. CHOOSE YOUR PORTAL SECTION (Matching Provided Screenshot) */}
      {/* ------------------------------------------------------------- */}
      <section id="portals" className="py-20 bg-white text-slate-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Heading */}
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Choose <span className="text-blue-600">Your Portal</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-500">
              Select your role to access a dedicated and secure workspace.
            </p>
          </div>

          {/* Three Role Cards Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: College Applicant */}
            <div className="rounded-2xl p-7 bg-slate-50/80 border border-slate-200 hover:border-emerald-500/60 shadow-lg hover:shadow-xl transition-all duration-200 flex flex-col justify-between group">
              <div className="space-y-4">
                {/* Circular Emerald Icon */}
                <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
                  <GraduationCap className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">College Applicant</h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                    Submit applications, upload documents, renew registration, track status and resolve deficiencies.
                  </p>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => navigate('/login/applicant')}
                  className="w-full py-3 px-4 text-xs sm:text-sm font-bold text-white bg-[#059669] hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 group-hover:gap-3"
                >
                  <span>Enter Applicant Portal</span>
                  <ArrowRight className="w-4 h-4 transition-transform" />
                </button>
              </div>
            </div>

            {/* Card 2: Security Officer */}
            <div className="rounded-2xl p-7 bg-slate-50/80 border border-slate-200 hover:border-blue-500/60 shadow-lg hover:shadow-xl transition-all duration-200 flex flex-col justify-between group">
              <div className="space-y-4">
                {/* Circular Blue Icon */}
                <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/25">
                  <Shield className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Security Officer</h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                    Review applications, inspect document evidence, assess compliance and record decisions.
                  </p>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => navigate('/login/officer')}
                  className="w-full py-3 px-4 text-xs sm:text-sm font-bold text-white bg-[#1D4ED8] hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md shadow-blue-600/20 hover:shadow-blue-600/30 transition-all flex items-center justify-center gap-2 group-hover:gap-3"
                >
                  <span>Enter Officer Portal</span>
                  <ArrowRight className="w-4 h-4 transition-transform" />
                </button>
              </div>
            </div>

            {/* Card 3: Administrator */}
            <div className="rounded-2xl p-7 bg-slate-50/80 border border-slate-200 hover:border-purple-500/60 shadow-lg hover:shadow-xl transition-all duration-200 flex flex-col justify-between group">
              <div className="space-y-4">
                {/* Circular Purple Icon */}
                <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/25">
                  <Settings className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Administrator</h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                    Manage users, regulatory rules, system settings, monitor applications and view audit logs.
                  </p>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => navigate('/login/admin')}
                  className="w-full py-3 px-4 text-xs sm:text-sm font-bold text-white bg-[#7C3AED] hover:bg-purple-700 active:bg-purple-800 rounded-xl shadow-md shadow-purple-600/20 hover:shadow-purple-600/30 transition-all flex items-center justify-center gap-2 group-hover:gap-3"
                >
                  <span>Enter Administrator Portal</span>
                  <ArrowRight className="w-4 h-4 transition-transform" />
                </button>
              </div>
            </div>
          </div>

          {/* Feature Highlights Strip (Matching Provided Screenshot) */}
          <div className="mt-14 pt-10 border-t border-slate-200">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">OCR & Field Extraction</div>
                  <div className="text-[10px] text-slate-500">PDF, Images, Scanned Docs</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Duplicate Detection</div>
                  <div className="text-[10px] text-slate-500">Identify similar submissions</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Regulatory Rule Matching</div>
                  <div className="text-[10px] text-slate-500">AICTE & Statutory Norms</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Suspicious Document Analysis</div>
                  <div className="text-[10px] text-slate-500">Image forensics indicators</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 col-span-2 md:col-span-1">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Explainable Reports</div>
                  <div className="text-[10px] text-slate-500">Evidence and citations</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. HOW IT WORKS SECTION (Matching Provided Screenshot)        */}
      {/* ------------------------------------------------------------- */}
      <section id="how-it-works" className="py-20 bg-[#0B1220] border-t border-[#1E293B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Heading */}
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              How It Works
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              From document submission to compliance decision, powered by AI and regulatory rules.
            </p>
          </div>

          {/* 4-Step Stepper Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Step 1 */}
            <div className="relative p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-blue-400 flex items-center justify-center border border-slate-700">
                  <UploadCloud className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Upload Documents</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Submit application form and supporting documents.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-blue-400 flex items-center justify-center border border-slate-700">
                  <Cpu className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Extract & Validate</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  AI extracts fields and checks completeness.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-blue-400 flex items-center justify-center border border-slate-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Check Compliance</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Compare with regulatory rules and detect anomalies.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  4
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-blue-400 flex items-center justify-center border border-slate-700">
                  <FileCheck2 className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Review & Decide</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  View findings, evidence and download report.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. SECURITY & STATUTORY GOVERNANCE (SIH Standards)            */}
      {/* ------------------------------------------------------------- */}
      <section id="security" className="py-16 bg-[#0E1626] border-t border-[#1E293B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">DPDP Act 2023 & Zero-Knowledge</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automated regex masking of Aadhaar, PAN, and contact numbers. Sensitive data unmasking requires an explicit, audited statement of statutory purpose.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">7-Layer Forensics & ELA</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Multi-pass authenticity screening inspecting SHA-256 integrity, PDF streams, Error Level Analysis (ELA), and X.509 PKI certificate validation.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">Chained Audit Log Continuity</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cryptographically hashed audit events track every upload, extraction edit, override, and final scrutiny determination with immutable provenance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. PROFESSIONAL FOOTER                                        */}
      {/* ------------------------------------------------------------- */}
      <footer className="bg-[#080D17] text-slate-400 text-xs py-12 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-white">TrustDoc</span>
                <span className="text-slate-500 ml-2">AI-Powered Institutional Accreditation Platform</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
              <button onClick={() => navigate('/login/applicant')} className="hover:text-white transition-colors">
                Applicant Portal
              </button>
              <button onClick={() => navigate('/login/officer')} className="hover:text-white transition-colors">
                Officer Portal
              </button>
              <button onClick={() => navigate('/login/admin')} className="hover:text-white transition-colors">
                Admin Console
              </button>
              <button onClick={() => navigate('/login')} className="hover:text-white transition-colors">
                Role Selection
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 text-[11px] text-slate-500">
            <p>
              © 2026 TrustDoc (ComplianceAI) — Project ID: SIH26261. AICTE Approval Process Handbook (2026-27 Norms).
            </p>
            <p className="flex items-center gap-1.5 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Operational & Compliant with Digital Personal Data Protection Act (DPDP) 2023</span>
            </p>
          </div>
        </div>
      </footer>

      {/* ------------------------------------------------------------- */}
      {/* INTERACTIVE DEMO SCENARIOS MODAL ("Watch Demo")              */}
      {/* ------------------------------------------------------------- */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0F172A] border border-slate-700 rounded-3xl max-w-2xl w-full p-6 text-slate-200 shadow-2xl relative">
            <button
              onClick={() => setShowDemoModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">TrustDoc Platform Demonstration</h3>
                <p className="text-xs text-slate-400">Pre-calibrated benchmark cases for SIH 2026 evaluation</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Experience the end-to-end statutory verification workflow: from multi-document OCR extraction to 7-layer forensics and deterministic regulatory cross-validation.
            </p>

            <div className="space-y-3 mb-6">
              <div
                onClick={() => {
                  setShowDemoModal(false);
                  navigate('/login/officer');
                }}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/60 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">
                      CASE A
                    </span>
                    <span className="text-xs font-bold text-white">Fully Compliant Engineering College</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Clean statutory filing meeting all AICTE land, built-up, and fire safety norms (Composite Score: 100/100).
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>

              <div
                onClick={() => {
                  setShowDemoModal(false);
                  navigate('/login/officer');
                }}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/60 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
                      CASE B
                    </span>
                    <span className="text-xs font-bold text-white">Acreage Deficiencies & Missing Faculty Form</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Triggers cross-document mismatch (3.2 acres declared vs 4.5 acres required) and missing cadre ratio.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </div>

              <div
                onClick={() => {
                  setShowDemoModal(false);
                  navigate('/login/officer');
                }}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/60 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded">
                      CASE C
                    </span>
                    <span className="text-xs font-bold text-white">Tampered Fire NOC & Splicing Anomaly</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Uncovers pixel-level digital tampering with Error Level Analysis (ELA) heatmap and timestamp mismatch.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowDemoModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowDemoModal(false);
                  scrollToSection('portals');
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl"
              >
                Choose Portal & Enter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
