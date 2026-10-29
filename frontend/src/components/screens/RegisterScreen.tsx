import React, { useState } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  Building2,
  Mail,
  User,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  FileText,
  Check,
  Building,
  MapPin,
  Sparkles
} from 'lucide-react';
import { useRouter } from '../../router/Router';
import { registerApplicantComprehensive } from '../../services/api';

export const RegisterScreen: React.FC = () => {
  const { navigate } = useRouter();

  // Mode: New Institution vs Claim / Renewal of Existing Institution
  const [workflowMode, setWorkflowMode] = useState<'new' | 'existing'>('new');

  // Form Fields
  const [institutionName, setInstitutionName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [institutionType, setInstitutionType] = useState('Engineering & Technology');
  const [affiliationUniversity, setAffiliationUniversity] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [stateName, setStateName] = useState('Maharashtra');
  const [district] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Document checklist simulation
  const [uploadedDocs, setUploadedDocs] = useState<{ [key: string]: boolean }>({
    land_title: true,
    fire_noc: true,
    building_plan: true,
    faculty_affidavit: true,
  });

  // Terms and Consent
  const [termsAccepted, setTermsAccepted] = useState(false);

  // State
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    reference_number: string;
    registration_number: string;
    institution_name: string;
    email: string;
  } | null>(null);

  const toggleDoc = (key: string) => {
    setUploadedDocs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validations
    if (!institutionName.trim()) {
      setErrorMsg('Full registered institution name is required.');
      return;
    }

    if (workflowMode === 'existing' && !registrationNumber.trim()) {
      setErrorMsg('Existing institutional registration number is required to claim/renew an existing profile.');
      return;
    }

    if (!fullName.trim() || !email.trim() || !phone.trim() || !address.trim()) {
      setErrorMsg('Representative name, email, contact phone, and campus address are all mandatory.');
      return;
    }

    if (!password) {
      setErrorMsg('Password is required.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    if (!termsAccepted) {
      setErrorMsg('You must agree to the statutory compliance undertaking and DPDP Act terms.');
      return;
    }

    const docItems = Object.entries(uploadedDocs)
      .filter(([_, isAttached]) => isAttached)
      .map(([key]) => ({
        doc_type: key,
        file_name: `${key}_statutory_proof.pdf`,
        uploaded_at: new Date().toISOString(),
      }));

    setLoading(true);
    try {
      const response = await registerApplicantComprehensive({
        institution_name: institutionName.trim(),
        registration_number: workflowMode === 'existing' ? registrationNumber.trim() : undefined,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone_number: phone.trim(),
        password,
        address: address.trim(),
        state: stateName,
        district: district.trim() || undefined,
        institution_type: institutionType,
        affiliation_university: affiliationUniversity.trim() || undefined,
        uploaded_documents: docItems,
        terms_accepted: true,
      });

      setSuccessData({
        reference_number: response.reference_number || response.registration_reference || 'REG-2026-PENDING',
        registration_number: response.registration_number || (workflowMode === 'existing' ? registrationNumber : 'PENDING'),
        institution_name: institutionName.trim(),
        email: email.trim().toLowerCase(),
      });
    } catch (err: any) {
      console.error('Registration failed:', err);
      setErrorMsg(
        err.response?.data?.detail ||
          'Institutional registration failed. Please ensure your email is unique and all required fields are valid.'
      );
    } finally {
      setLoading(false);
    }
  };

  // SUCCESS CONFIRMATION VIEW
  if (successData) {
    return (
      <div className="min-h-[85vh] flex flex-col justify-center max-w-xl mx-auto px-4 sm:px-6 py-10 text-[#111827]">
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 mx-auto shadow-xs">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Registration Successful
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-2">
              Institution Onboarded to TrustDoc
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Your institutional applicant account has been verified and registered on the AICTE statutory portal.
            </p>
          </div>

          {/* Reference Card */}
          <div className="bg-[#F4F7FB] border border-[#E2E8F0] rounded-xl p-4 text-left space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Institution Name:</span>
              <span className="font-bold text-slate-900 text-right">{successData.institution_name}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Tracking Reference:</span>
              <span className="font-mono font-bold text-emerald-700">{successData.reference_number}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">AICTE Institutional Reg #:</span>
              <span className="font-mono font-bold text-slate-900">{successData.registration_number}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Authorized Login Email:</span>
              <span className="font-semibold text-slate-900">{successData.email}</span>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 text-left flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Next Steps:</span> You may now sign in at the{' '}
              <span className="font-semibold underline">College Applicant Portal</span> using your registered email and password to upload accreditation dossiers or manage annual approvals.
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate('/login/applicant')}
              className="w-full py-2.5 px-4 rounded-xl text-white text-xs font-bold bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 shadow-md transition flex items-center justify-center gap-2"
            >
              <span>Proceed to Applicant Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex flex-col justify-center max-w-2xl mx-auto px-4 sm:px-6 py-10 text-[#111827]">
      {/* Return to Login */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/login/applicant')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#111827] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-0.5 transition-transform" />
          <span>Return to Applicant Login</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-6 sm:p-7 bg-[#F4F7FB] border-b border-[#E2E8F0] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  TrustDoc Statutory Onboarding
                </span>
                <h2 className="text-lg font-bold text-[#111827]">College Applicant Registration</h2>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200">
              APPLICANT PORTAL
            </span>
          </div>

          <p className="text-xs text-[#64748B] leading-relaxed">
            Register your institution or claim existing approval records for AI-assisted regulatory compliance, mandatory disclosure filings, and annual renewal.
          </p>

          {/* Workflow Toggle: New Institution vs Existing Renewal */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setWorkflowMode('new')}
              className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                workflowMode === 'new'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>1. New Institution Registration</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkflowMode('existing')}
              className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                workflowMode === 'existing'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>2. Claim / Renew Existing College</span>
            </button>
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mx-6 sm:mx-7 mt-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <div className="flex-1 leading-relaxed">
              <span className="font-bold">Registration Alert:</span> {errorMsg}
            </div>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-5">
          {/* Section 1: Institution Identity */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" />
              <span>Institutional Identity & Classification</span>
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="inst-name">
                Full Registered Institution Name *
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="inst-name"
                  type="text"
                  required
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="e.g. Apex Institute of Technology & Management"
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition font-medium"
                />
              </div>
            </div>

            {/* If existing institution renewal / claim mode */}
            {workflowMode === 'existing' && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-amber-900" htmlFor="reg-num">
                  Existing AICTE / State Technical Board Registration Number *
                </label>
                <input
                  id="reg-num"
                  type="text"
                  required
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="e.g. 1-3512948123 or AICTE-APEX-001"
                  className="w-full bg-white border border-amber-300 text-xs text-slate-900 placeholder-slate-400 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold"
                />
                <span className="text-[11px] text-amber-700 block">
                  Verify from your existing Approval Letter (EoA) or affiliation certificate.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="inst-type">
                  Discipline / Institution Category
                </label>
                <select
                  id="inst-type"
                  value={institutionType}
                  onChange={(e) => setInstitutionType(e.target.value)}
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 px-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition font-medium"
                >
                  <option value="Engineering & Technology">Engineering & Technology</option>
                  <option value="Management Studies (MBA/PGDM)">Management Studies (MBA/PGDM)</option>
                  <option value="Pharmacy (B.Pharm/M.Pharm)">Pharmacy (B.Pharm/M.Pharm)</option>
                  <option value="Architecture & Planning">Architecture & Planning</option>
                  <option value="Polytechnic / Diploma">Polytechnic / Diploma</option>
                  <option value="Applied Arts & Crafts">Applied Arts & Crafts</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="affil-univ">
                  Affiliating University / Board
                </label>
                <input
                  id="affil-univ"
                  type="text"
                  value={affiliationUniversity}
                  onChange={(e) => setAffiliationUniversity(e.target.value)}
                  placeholder="e.g. State Technological University"
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 px-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition font-medium"
                />
              </div>
            </div>

            {/* Campus Address & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="address">
                  Permanent Campus Address *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="address"
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Sector 12, Knowledge Park III"
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="state">
                  State / UT
                </label>
                <select
                  id="state"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 px-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition font-medium"
                >
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                  <option value="Delhi NCT">Delhi NCT</option>
                  <option value="Uttar Pradesh">Uttar Pradesh</option>
                  <option value="Gujarat">Gujarat</option>
                  <option value="Telangana">Telangana</option>
                  <option value="Kerala">Kerala</option>
                  <option value="Madhya Pradesh">Madhya Pradesh</option>
                  <option value="West Bengal">West Bengal</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Authorized Representative & Login Credentials */}
          <div className="space-y-3 pt-2 border-t border-[#E2E8F0]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Authorized Representative & Portal Access</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="full-name">
                  Principal / Director / Registrar Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="full-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Sharma (Principal)"
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="phone">
                  Official Contact Phone Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition font-medium"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="email">
                Authorized Institutional Email Address (Used for Login) *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. principal@apex.edu"
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition font-medium"
                />
              </div>
            </div>

            {/* Password & Confirm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="reg-password">
                  Portal Password (Min 6 chars) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create secure password"
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-10 py-2.5 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition font-medium"
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
                  Confirm Password *
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
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-xs text-slate-900 placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Statutory Document Uploads Checklist */}
          <div className="space-y-3 pt-2 border-t border-[#E2E8F0]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Mandatory Statutory Document Checklist</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                AI Scrutiny Ready
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label
                onClick={() => toggleDoc('land_title')}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition select-none ${
                  uploadedDocs.land_title
                    ? 'bg-emerald-50/70 border-emerald-300 text-slate-800'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                    uploadedDocs.land_title ? 'bg-emerald-600 text-white' : 'border border-slate-400'
                  }`}
                >
                  {uploadedDocs.land_title && <Check className="w-3 h-3" />}
                </div>
                <div>
                  <div className="font-bold text-[11px]">Land Title Deed / Ownership</div>
                  <div className="text-[10px] text-slate-500">Government Registry or 30-year lease</div>
                </div>
              </label>

              <label
                onClick={() => toggleDoc('fire_noc')}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition select-none ${
                  uploadedDocs.fire_noc
                    ? 'bg-emerald-50/70 border-emerald-300 text-slate-800'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                    uploadedDocs.fire_noc ? 'bg-emerald-600 text-white' : 'border border-slate-400'
                  }`}
                >
                  {uploadedDocs.fire_noc && <Check className="w-3 h-3" />}
                </div>
                <div>
                  <div className="font-bold text-[11px]">Fire Safety NOC Certificate</div>
                  <div className="text-[10px] text-slate-500">Municipal Fire Brigade validity</div>
                </div>
              </label>

              <label
                onClick={() => toggleDoc('building_plan')}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition select-none ${
                  uploadedDocs.building_plan
                    ? 'bg-emerald-50/70 border-emerald-300 text-slate-800'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                    uploadedDocs.building_plan ? 'bg-emerald-600 text-white' : 'border border-slate-400'
                  }`}
                >
                  {uploadedDocs.building_plan && <Check className="w-3 h-3" />}
                </div>
                <div>
                  <div className="font-bold text-[11px]">Building Plan & Carpet Area</div>
                  <div className="text-[10px] text-slate-500">Competent Authority approval</div>
                </div>
              </label>

              <label
                onClick={() => toggleDoc('faculty_affidavit')}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition select-none ${
                  uploadedDocs.faculty_affidavit
                    ? 'bg-emerald-50/70 border-emerald-300 text-slate-800'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                    uploadedDocs.faculty_affidavit ? 'bg-emerald-600 text-white' : 'border border-slate-400'
                  }`}
                >
                  {uploadedDocs.faculty_affidavit && <Check className="w-3 h-3" />}
                </div>
                <div>
                  <div className="font-bold text-[11px]">Faculty Cadre Affidavit</div>
                  <div className="text-[10px] text-slate-500">Cadre ratio 1:15/1:20 compliance</div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 4: Terms & Privacy Consent */}
          <div className="pt-2 border-t border-[#E2E8F0]">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                I hereby declare that I am the authorized representative of the named institution. I affirm that all statements and uploaded documents are authentic under the provisions of the AICTE Act and the Digital Personal Data Protection (DPDP) Act, 2023.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-white text-xs font-bold bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 shadow-md transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Enrolling Institution & Generating Reference ID...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Submit Institutional Registration</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          <div className="pt-3 border-t border-[#E2E8F0] text-center">
            <span className="text-xs text-slate-500">Already registered? </span>
            <button
              type="button"
              onClick={() => navigate('/login/applicant')}
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              Sign in to Applicant Portal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
