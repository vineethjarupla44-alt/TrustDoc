import React from 'react';
import { Shield, ArrowLeft, Home } from 'lucide-react';
import { useRouter } from '../../router/Router';

interface PublicAuthLayoutProps {
  children: React.ReactNode;
  backTo?: {
    label: string;
    path: string;
  };
}

export const PublicAuthLayout: React.FC<PublicAuthLayoutProps> = ({
  children,
  backTo = { label: 'Back to Home', path: '/' },
}) => {
  const { navigate } = useRouter();

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col font-sans text-[#111827]">
      {/* ------------------------------------------------------------- */}
      {/* STANDALONE PUBLIC NAVBAR (NO SIDEBAR, NO SCENARIO SWITCHER)   */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 bg-[#0B1220] border-b border-[#1E293B] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left Brand Identifier */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => navigate('/')}
            title="Return to Public Landing Page"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-[#1D4ED8] flex items-center justify-center shadow-lg shadow-blue-600/30 border border-blue-400/30 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white font-sans">
                  TrustDoc
                </span>
                <span className="hidden sm:inline-block text-[10px] font-semibold text-sky-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-800/60">
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

          {/* Right Navigation Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            {backTo && (
              <button
                onClick={() => navigate(backTo.path)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{backTo.label}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT CANVAS (STANDALONE, ISOLATED FROM DASHBOARD)     */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* MINIMAL STANDALONE FOOTER                                      */}
      {/* ------------------------------------------------------------- */}
      <footer className="bg-white border-t border-[#E2E8F0] py-4 text-center text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TrustDoc • AI-Powered Institutional Application Validation & Regulatory Compliance</span>
          <span className="text-slate-400 text-[11px]">SIH 2026 • Project ID: SIH26261 • Secure Cryptographic Authentication</span>
        </div>
      </footer>
    </div>
  );
};
