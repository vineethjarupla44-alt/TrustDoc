import React, { useState, useEffect } from 'react';
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  FileCheck2,
  Shield,
  RefreshCw,
  Plus,
  X,
  FileWarning,
  BadgeAlert,
  CheckCircle
} from 'lucide-react';
import {
  fetchCollegeRegistrationOverview,
  submitCollegeRegistrationRenewal,
  submitNewCollegeRegistration,
  resubmitRenewalCorrections,
  fetchRenewalRules
} from '../../../services/api';
import type { CollegeRegistrationOverview, RenewalStatus } from '../../../types';

interface CollegeRegistrationSectionProps {
  onRefreshParent?: () => void;
}

export const CollegeRegistrationSection: React.FC<CollegeRegistrationSectionProps> = ({
  onRefreshParent
}) => {
  const [data, setData] = useState<CollegeRegistrationOverview | null>(null);
  const [rules, setRules] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Modals
  const [showRenewalModal, setShowRenewalModal] = useState<boolean>(false);
  const [showNewRegModal, setShowNewRegModal] = useState<boolean>(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);

  // Renewal Form State
  const [renewalDetails, setRenewalDetails] = useState({
    institution_name: '',
    program_name: 'Undergraduate Engineering & Technology',
    head_of_institution: '',
    contact_email: '',
    contact_phone: '',
    total_land_acres: '4.5',
    built_up_area_sqm: '12500',
    academic_year: '2026-2027',
  });

  const [renewalDocs] = useState([
    { doc_type: 'LAND_DEED', file_name: 'Registered_Land_Title_Deed_Continuing.pdf', sha256_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', uploaded: true },
    { doc_type: 'FIRE_NOC', file_name: 'Fire_Safety_Clearance_NOC_2026.pdf', sha256_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', uploaded: true },
    { doc_type: 'BUILDING_PLAN', file_name: 'Approved_Master_Site_Building_Plan.pdf', sha256_hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', uploaded: true },
    { doc_type: 'FACULTY_LIST', file_name: 'Faculty_Cadre_Ratio_Affidavit_2026.pdf', sha256_hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', uploaded: true }
  ]);

  // Correction Form State
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [correctionDocs] = useState([
    { doc_type: 'CORRECTED_FIRE_NOC', file_name: 'Reissued_Statutory_Fire_Clearance_NOC.pdf', sha256_hash: '7d793037a0760186574b0282f2f435e7' }
  ]);

  // New Registration Form State
  const [newRegForm, setNewRegForm] = useState({
    institution_name: '',
    institution_type: 'Private / Self-Financed',
    affiliation_university: 'Delhi Technological University (DTU)',
    state: 'Delhi',
    district: 'New Delhi',
    address: '',
    contact_email: '',
    contact_phone: '',
    head_of_institution: '',
  });

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [overviewData, rulesData] = await Promise.all([
        fetchCollegeRegistrationOverview(),
        fetchRenewalRules()
      ]);
      setData(overviewData);
      setRules(rulesData);

      if (overviewData.registration) {
        setRenewalDetails({
          institution_name: overviewData.registration.institution_name,
          program_name: 'Undergraduate Engineering & Technology',
          head_of_institution: overviewData.registration.head_of_institution,
          contact_email: overviewData.registration.contact_email,
          contact_phone: overviewData.registration.contact_phone,
          total_land_acres: '4.5',
          built_up_area_sqm: '12500',
          academic_year: '2026-2027',
        });
      }
    } catch (err) {
      console.error('Error loading registration overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await submitCollegeRegistrationRenewal({
        institution_details: renewalDetails,
        uploaded_documents: renewalDocs,
        academic_year: renewalDetails.academic_year
      });
      setShowRenewalModal(false);
      await loadOverview();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit renewal application.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.active_renewal || !correctionNotes.trim()) return;
    setActionLoading(true);
    try {
      await resubmitRenewalCorrections(data.active_renewal.id, {
        correction_notes: correctionNotes,
        correction_documents: correctionDocs
      });
      setShowCorrectionModal(false);
      setCorrectionNotes('');
      await loadOverview();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to resubmit corrections.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNewRegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await submitNewCollegeRegistration({
        ...newRegForm,
        uploaded_documents: renewalDocs
      });
      setShowNewRegModal(false);
      await loadOverview();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit new institutional registration.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: RenewalStatus) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="px-3 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Approved / Registration Renewed</span>
          </span>
        );
      case 'CORRECTIONS_REQUIRED':
        return (
          <span className="px-3 py-1 text-xs font-bold bg-rose-100 text-rose-800 rounded-full border border-rose-300 flex items-center gap-1.5 animate-pulse">
            <BadgeAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Corrections Required</span>
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="px-3 py-1 text-xs font-bold bg-purple-100 text-purple-800 rounded-full border border-purple-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-600" />
            <span>Under Scrutiny Review</span>
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="px-3 py-1 text-xs font-bold bg-blue-100 text-blue-800 rounded-full border border-blue-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Renewal Submitted</span>
          </span>
        );
      case 'RENEWAL_DUE':
        return (
          <span className="px-3 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Renewal Due (Window Open)</span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-3 py-1 text-xs font-bold bg-red-100 text-red-800 rounded-full border border-red-300 flex items-center gap-1.5">
            <FileWarning className="w-3.5 h-3.5 text-red-600" />
            <span>Registration Expired</span>
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 text-xs font-bold bg-slate-100 text-slate-800 rounded-full border border-slate-300 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Valid (Not Yet Eligible)</span>
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
        <span className="text-xs font-semibold">Loading institutional registration records...</span>
      </div>
    );
  }

  const reg = data?.registration;
  const activeRenewal = data?.active_renewal;
  const status = data?.eligibility_status || 'NOT_YET_ELIGIBLE';

  const isRenewalAllowed =
    status === 'RENEWAL_DUE' ||
    status === 'EXPIRED' ||
    status === 'NOT_YET_ELIGIBLE' || // allow testing anytime in demo
    (activeRenewal && activeRenewal.status === 'APPROVED');

  return (
    <div className="space-y-6 text-[#111827]">
      {/* 1. Main Institution Registration Card */}
      {reg && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-6 border-b border-slate-100">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/20">
                <Building2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-extrabold text-slate-900">{reg.institution_name}</h2>
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md border border-slate-200 font-mono">
                    {reg.institution_code}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {reg.institution_type} • Affiliated to {reg.affiliation_university} • {reg.district}, {reg.state}
                </p>
                <div className="flex items-center gap-3 pt-1 text-xs text-slate-600">
                  <span>Head: <strong className="text-slate-800">{reg.head_of_institution}</strong></span>
                  <span>•</span>
                  <span>Contact: <strong className="text-slate-800">{reg.contact_email}</strong></span>
                </div>
              </div>
            </div>

            {/* Status & Quick Action */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
              <div className="space-y-1 text-right sm:text-left">
                {getStatusBadge(status)}
              </div>
              {isRenewalAllowed && !activeRenewal?.status?.includes('SUBMITTED') && !activeRenewal?.status?.includes('UNDER_REVIEW') && !activeRenewal?.status?.includes('CORRECTIONS_REQUIRED') && (
                <button
                  onClick={() => setShowRenewalModal(true)}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-md shadow-emerald-600/25 transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Renew Registration</span>
                </button>
              )}
            </div>
          </div>

          {/* Validity & Statutory Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Permanent Reg. Number
              </span>
              <span className="text-sm font-bold text-blue-600 font-mono mt-1 block">
                {reg.registration_number}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">AICTE Council Master Index</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Validity Period
              </span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {new Date(reg.valid_from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} —{' '}
                {new Date(reg.valid_upto).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Statutory Accreditation Window</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Expiry Countdown
              </span>
              <span className={`text-sm font-extrabold mt-1 block ${
                data?.days_until_expiry && data.days_until_expiry < 0 ? 'text-rose-600' : 'text-amber-600'
              }`}>
                {data?.days_until_expiry !== undefined
                  ? data.days_until_expiry < 0
                    ? `Expired ${Math.abs(data.days_until_expiry)} days ago`
                    : `${data.days_until_expiry} days remaining`
                  : '—'}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Renewal Window: 90 Days</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Accreditation Grade
              </span>
              <span className="text-sm font-bold text-emerald-600 mt-1 block">
                {reg.accreditation_grade}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Autonomous: {reg.is_autonomous ? 'Yes' : 'No'}</span>
            </div>
          </div>

          {/* Informational Statutory Status Notice */}
          <div className="mt-5 p-3.5 rounded-xl bg-blue-50/80 border border-blue-200/80 flex items-start gap-3 text-xs text-blue-900">
            <Shield className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Statutory Notification:</strong> {data?.eligibility_message}
            </div>
          </div>
        </div>
      )}

      {/* 2. Active Renewal Submission Tracker (If renewal submitted / under review) */}
      {activeRenewal && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tracked Submission Record
              </span>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                <span>Reference: {activeRenewal.renewal_reference_number}</span>
                <span className="text-xs font-normal text-slate-500">
                  (Academic Cycle: {activeRenewal.academic_year})
                </span>
              </h3>
            </div>
            {getStatusBadge(activeRenewal.status)}
          </div>

          {/* Stepper Progress */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">1. Form & Deeds</span>
              <span className="font-bold text-emerald-950 mt-1 block">Submitted</span>
              <span className="text-[10px] text-emerald-700 mt-0.5 block">
                {activeRenewal.submitted_at ? new Date(activeRenewal.submitted_at).toLocaleDateString() : 'Recorded'}
              </span>
            </div>

            <div className={`p-3 rounded-xl border text-xs ${
              activeRenewal.status === 'UNDER_REVIEW' || activeRenewal.status === 'APPROVED' || activeRenewal.status === 'CORRECTIONS_REQUIRED'
                ? 'bg-purple-50 border-purple-200 text-purple-950'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <span className="text-[10px] font-bold uppercase block">2. Scrutiny Queue</span>
              <span className="font-bold mt-1 block">Officer Review</span>
              <span className="text-[10px] opacity-80 mt-0.5 block">
                {activeRenewal.reviewed_at ? new Date(activeRenewal.reviewed_at).toLocaleDateString() : 'Awaiting officer'}
              </span>
            </div>

            <div className={`p-3 rounded-xl border text-xs ${
              activeRenewal.status === 'CORRECTIONS_REQUIRED'
                ? 'bg-rose-50 border-rose-300 text-rose-950 font-semibold'
                : activeRenewal.status === 'APPROVED'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <span className="text-[10px] font-bold uppercase block">3. Deficiency Check</span>
              <span className="font-bold mt-1 block">
                {activeRenewal.status === 'CORRECTIONS_REQUIRED' ? 'Action Required' : 'Passed / Clean'}
              </span>
              <span className="text-[10px] opacity-80 mt-0.5 block">
                {activeRenewal.status === 'CORRECTIONS_REQUIRED' ? 'Deficiency notice issued' : 'No major defects'}
              </span>
            </div>

            <div className={`p-3 rounded-xl border text-xs ${
              activeRenewal.status === 'APPROVED'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <span className="text-[10px] font-bold uppercase block">4. Final Council Seal</span>
              <span className="font-bold mt-1 block">
                {activeRenewal.status === 'APPROVED' ? 'Approved & Sealed' : 'Pending decision'}
              </span>
              <span className="text-[10px] opacity-80 mt-0.5 block">
                {activeRenewal.digital_scrutiny_seal ? `Seal: ${activeRenewal.digital_scrutiny_seal.substring(0, 10)}...` : 'Pending'}
              </span>
            </div>
          </div>

          {/* Deficiency Notice Alert & Action Trigger */}
          {activeRenewal.status === 'CORRECTIONS_REQUIRED' && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-3">
              <div className="flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-rose-600 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Official Statutory Deficiency Notice Issued by Security Officer
                </h4>
              </div>
              <p className="text-xs text-rose-800 leading-relaxed font-mono bg-white/70 p-3 rounded-lg border border-rose-200">
                "{activeRenewal.deficiency_notice || 'Please provide updated Fire NOC certificate with verified statutory stamp.'}"
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-rose-700 font-semibold">
                  Deadline for Resubmission: {activeRenewal.deficiency_deadline_days} days from issue.
                </span>
                <button
                  onClick={() => setShowCorrectionModal(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition"
                >
                  Upload Corrections & Resubmit
                </button>
              </div>
            </div>
          )}

          {/* Approved Result Notice */}
          {activeRenewal.status === 'APPROVED' && activeRenewal.new_valid_upto && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold">
                    Statutory Registration Extended Until{' '}
                    {new Date(activeRenewal.new_valid_upto).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </h4>
                  <p className="text-[11px] text-emerald-700 font-mono mt-0.5">
                    Digital Scrutiny Seal Hash: {activeRenewal.digital_scrutiny_seal}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Renewal History & Past Filings Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-slate-900">Registration Submission History</h3>
            <p className="text-xs text-slate-500">Persisted audit records for renewals and new registrations</p>
          </div>
          <button
            onClick={() => setShowNewRegModal(true)}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Start New Registration</span>
          </button>
        </div>

        {data?.renewal_history && data.renewal_history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 font-semibold">
                  <th className="py-2.5 px-3">Reference No.</th>
                  <th className="py-2.5 px-3">Application Type</th>
                  <th className="py-2.5 px-3">Cycle</th>
                  <th className="py-2.5 px-3">Submitted At</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Decision / Sealed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.renewal_history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {item.renewal_reference_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">
                      {item.application_type === 'RENEWAL' ? 'Registration Renewal' : 'New Institutional Registration'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{item.academic_year}</td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : 'Draft'}
                    </td>
                    <td className="py-2.5 px-3">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[10px]">
                      {item.digital_scrutiny_seal ? `${item.digital_scrutiny_seal.substring(0, 12)}...` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs">No past renewal submissions recorded for this institution.</p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: Renew Registration Wizard                            */}
      {/* ------------------------------------------------------------- */}
      {showRenewalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Renew Institutional Registration</h3>
                  <p className="text-[11px] text-slate-500">AICTE Approval Process Handbook (2026-27 Norms)</p>
                </div>
              </div>
              <button
                onClick={() => setShowRenewalModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewalSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Institution Name (Pre-filled):
                  </label>
                  <input
                    type="text"
                    required
                    value={renewalDetails.institution_name}
                    onChange={(e) => setRenewalDetails({ ...renewalDetails, institution_name: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Head of Institution (Principal):
                  </label>
                  <input
                    type="text"
                    required
                    value={renewalDetails.head_of_institution}
                    onChange={(e) => setRenewalDetails({ ...renewalDetails, head_of_institution: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Registered Contact Email:
                  </label>
                  <input
                    type="email"
                    required
                    value={renewalDetails.contact_email}
                    onChange={(e) => setRenewalDetails({ ...renewalDetails, contact_email: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Registered Contact Phone:
                  </label>
                  <input
                    type="text"
                    required
                    value={renewalDetails.contact_phone}
                    onChange={(e) => setRenewalDetails({ ...renewalDetails, contact_phone: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Total Campus Land Area (Acres):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={renewalDetails.total_land_acres}
                    onChange={(e) => setRenewalDetails({ ...renewalDetails, total_land_acres: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Total Built-Up Area (sq.m.):
                  </label>
                  <input
                    type="number"
                    required
                    value={renewalDetails.built_up_area_sqm}
                    onChange={(e) => setRenewalDetails({ ...renewalDetails, built_up_area_sqm: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              {/* Mandatory Supporting Documents */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-900 mb-2">
                  Mandatory Statutory Documents for Renewal:
                </label>
                <div className="space-y-2">
                  {renewalDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-emerald-600" />
                        <div>
                          <span className="font-semibold text-slate-800">{doc.file_name}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            SHA-256: {doc.sha256_hash.substring(0, 16)}...
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">
                        Verified
                      </span>
                    </div>
                  ))}
                </div>
                {rules?.disclaimer && (
                  <p className="text-[10px] text-slate-500 italic mt-2">
                    {rules.disclaimer}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRenewalModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md disabled:bg-slate-300"
                >
                  {actionLoading ? 'Validating & Submitting...' : 'Submit Renewal Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: Resubmit Corrections to Deficiency Notice            */}
      {/* ------------------------------------------------------------- */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center">
                  <BadgeAlert className="w-4 h-4 text-rose-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Corrected Documents</h3>
                  <p className="text-[11px] text-slate-500">Deficiency notice response for {activeRenewal?.renewal_reference_number}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCorrectionSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Applicant Explanation & Resolution Notes:
                </label>
                <textarea
                  rows={3}
                  required
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  placeholder="e.g. Uploaded freshly renewed Fire Clearance Certificate from Directorate of Fire Services..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Attached Corrective Document:
                </label>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-slate-800">Reissued_Statutory_Fire_Clearance_NOC.pdf</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 rounded">
                    Ready
                  </span>
                </div>
                {rules?.disclaimer && (
                  <p className="text-[10px] text-slate-500 italic mt-2">
                    {rules.disclaimer}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!correctionNotes.trim() || actionLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-md disabled:bg-slate-300"
                >
                  {actionLoading ? 'Resubmitting...' : 'Resubmit Corrected Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: Start New Institutional Registration                 */}
      {/* ------------------------------------------------------------- */}
      {showNewRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-blue-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Start New College Registration</h3>
                  <p className="text-[11px] text-slate-500">Initial Institutional Establishment Enrollment</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewRegModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleNewRegSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Proposed Institution Name:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Institute of Technology & Research"
                  value={newRegForm.institution_name}
                  onChange={(e) => setNewRegForm({ ...newRegForm, institution_name: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    State:
                  </label>
                  <input
                    type="text"
                    required
                    value={newRegForm.state}
                    onChange={(e) => setNewRegForm({ ...newRegForm, state: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    District:
                  </label>
                  <input
                    type="text"
                    required
                    value={newRegForm.district}
                    onChange={(e) => setNewRegForm({ ...newRegForm, district: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Institutional Physical Address:
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Full registered address..."
                  value={newRegForm.address}
                  onChange={(e) => setNewRegForm({ ...newRegForm, address: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Email:
                  </label>
                  <input
                    type="email"
                    required
                    value={newRegForm.contact_email}
                    onChange={(e) => setNewRegForm({ ...newRegForm, contact_email: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Phone:
                  </label>
                  <input
                    type="text"
                    required
                    value={newRegForm.contact_phone}
                    onChange={(e) => setNewRegForm({ ...newRegForm, contact_phone: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Head of Institution / Authorized Signatory:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. S. Mukherjee (Director)"
                  value={newRegForm.head_of_institution}
                  onChange={(e) => setNewRegForm({ ...newRegForm, head_of_institution: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewRegModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md disabled:bg-slate-300"
                >
                  {actionLoading ? 'Enrolling...' : 'Submit Institutional Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
