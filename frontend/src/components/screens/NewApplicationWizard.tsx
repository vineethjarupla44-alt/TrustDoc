import React, { useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  Building,
  GraduationCap,
  FileText,
  AlertCircle,
  Loader2,
  Check,
  RefreshCw,
  FolderUp
} from 'lucide-react';
import type { Language, ApplicationDetail } from '../../types';
import { createApplication, uploadDocument, submitApplication, runValidation } from '../../services/api';

interface NewApplicationWizardProps {
  language?: Language;
  onApplicationCreated?: (appId: string) => void;
  onUploadDocument?: (docType: string, file: File) => void;
  onCancel?: () => void;
}

export const NewApplicationWizard: React.FC<NewApplicationWizardProps> = ({
  onApplicationCreated,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [institutionName, setInstitutionName] = useState('Apex Institute of Technology');
  const [programName, setProgramName] = useState('Undergraduate Engineering & Technology');
  const [institutionType, setInstitutionType] = useState('Private / Self-Financed');
  const [regionType, setRegionType] = useState<'Urban / Metro' | 'Rural / Non-Metro'>('Urban / Metro');
  const [principalName, setPrincipalName] = useState('Dr. Ramesh V. Iyer');
  const [isCreatingApp, setIsCreatingApp] = useState(false);
  const [createdApp, setCreatedApp] = useState<ApplicationDetail | null>(null);

  // Mandatory 4 document checklist states
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File | null }>({
    LAND_DEED: null,
    BUILDING_PLAN: null,
    FIRE_NOC: null,
    FACULTY_LIST: null,
  });

  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({
    LAND_DEED: 0,
    BUILDING_PLAN: 0,
    FIRE_NOC: 0,
    FACULTY_LIST: 0,
  });

  const [uploadStatus, setUploadStatus] = useState<{
    [key: string]: 'idle' | 'uploading' | 'completed' | 'error';
  }>({
    LAND_DEED: 'idle',
    BUILDING_PLAN: 'idle',
    FIRE_NOC: 'idle',
    FACULTY_LIST: 'idle',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<string>('');

  const docChecklist = [
    {
      type: 'LAND_DEED',
      title: 'Land Title Deed / Registered Sale Deed',
      requirement: 'Minimum 2.50 Acres contiguous unencumbered freehold land for Urban category.',
      ruleCode: 'SYNTH-NORM-1.1.1',
    },
    {
      type: 'BUILDING_PLAN',
      title: 'Approved Campus Master Site Plan',
      requirement: 'Must bear Council of Architecture (COA) registration seal and DTCP sanction.',
      ruleCode: 'SYNTH-NORM-2.1.1',
    },
    {
      type: 'FIRE_NOC',
      title: 'State Fire & Rescue Services NOC',
      requirement: 'Must be active and unexpired for educational occupancy.',
      ruleCode: 'SYNTH-NORM-3.1.2',
    },
    {
      type: 'FACULTY_LIST',
      title: 'Sanctioned Faculty Cadre Master Register',
      requirement: 'Mandatory Student-to-Faculty Ratio (SFR) of 1:15 with balanced cadre distribution.',
      ruleCode: 'SYNTH-NORM-4.1.1',
    },
  ];

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionName.trim() || isCreatingApp) return;

    setIsCreatingApp(true);
    try {
      const app = await createApplication({
        institution_name: institutionName,
        program_name: programName,
        institution_type: institutionType,
      });
      setCreatedApp(app);
      setCurrentStep(2);
    } catch (err) {
      console.error('Failed to create application:', err);
      alert('Could not initialize application in backend. Please check connection.');
    } finally {
      setIsCreatingApp(false);
    }
  };

  const handleFileSelect = async (docType: string, file: File) => {
    setSelectedFiles((prev) => ({ ...prev, [docType]: file }));
    if (!createdApp?.id) return;

    setUploadStatus((prev) => ({ ...prev, [docType]: 'uploading' }));
    setUploadProgress((prev) => ({ ...prev, [docType]: 10 }));

    try {
      await uploadDocument(createdApp.id, docType, file, (percent) => {
        setUploadProgress((prev) => ({ ...prev, [docType]: percent }));
      });
      setUploadStatus((prev) => ({ ...prev, [docType]: 'completed' }));
      setUploadProgress((prev) => ({ ...prev, [docType]: 100 }));
    } catch (err) {
      console.error(`Failed to upload ${docType}:`, err);
      setUploadStatus((prev) => ({ ...prev, [docType]: 'error' }));
    }
  };

  const handleFinalSubmit = async () => {
    if (!createdApp?.id || isSubmitting) return;

    setIsSubmitting(true);
    try {
      setSubmissionStep('Formalizing application submission...');
      await submitApplication(createdApp.id);

      setSubmissionStep('Running OCR, forensic analysis & regulatory rules engine...');
      await runValidation(createdApp.id);

      setSubmissionStep('Scrutiny dossier finalized! Redirecting to application overview...');
      setTimeout(() => {
        if (onApplicationCreated) {
          onApplicationCreated(createdApp.id);
        }
      }, 1000);
    } catch (err) {
      console.error('Submission pipeline error:', err);
      alert('Pipeline execution encountered an error.');
      setIsSubmitting(false);
    }
  };

  const allUploaded = Object.values(uploadStatus).some((s) => s === 'completed');

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
      {/* Wizard Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-bold text-slate-900">
                New Institutional Accreditation Application
              </h2>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                Live Ingestion Form
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Fill statutory parameters, upload the mandatory verification bundle, and dispatch to the automated validation pipeline.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2.5 py-1.5 rounded hover:bg-slate-100 transition"
              >
                Cancel
              </button>
            )}
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200 font-mono">
              Step {currentStep} of 2
            </span>
          </div>
        </div>

        {/* Stepper Tabs */}
        <div className="mt-5 grid grid-cols-2 gap-4 text-xs font-semibold">
          <div
            onClick={() => {
              if (!isSubmitting) setCurrentStep(1);
            }}
            className={`p-3 rounded-lg border flex items-center space-x-2 transition ${
              currentStep === 1
                ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
              1
            </span>
            <span>1. Institutional Profile</span>
          </div>

          <div
            className={`p-3 rounded-lg border flex items-center space-x-2 transition ${
              currentStep === 2
                ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600'
                : 'border-slate-200 text-slate-400'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              2
            </span>
            <span>2. Mandatory Document Bundle</span>
          </div>
        </div>
      </div>

      {/* STEP 1: Institutional Parameters Form */}
      {currentStep === 1 && (
        <form onSubmit={handleStep1Submit} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-700" />
              <span>Statutory Entity & Intake Parameters</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              Norms: Synthetic Regulations Handbook v2026-Demo
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Institution Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="e.g. Apex Institute of Technology"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Academic Program Applied <span className="text-rose-600">*</span>
              </label>
              <select
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-800"
              >
                <option value="Undergraduate Engineering & Technology">
                  Undergraduate Engineering & Technology (B.Tech / B.E.)
                </option>
                <option value="Postgraduate Management Studies">
                  Postgraduate Management Studies (MBA)
                </option>
                <option value="Polytechnic Diploma in Engineering">
                  Polytechnic Diploma in Engineering
                </option>
                <option value="Master of Computer Applications">
                  Master of Computer Applications (MCA)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Institution Category / Type
              </label>
              <select
                value={institutionType}
                onChange={(e) => setInstitutionType(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800"
              >
                <option value="Private / Self-Financed">Private / Self-Financed Institution</option>
                <option value="Government / State University">Government / State University College</option>
                <option value="Deemed-to-be University">Deemed-to-be University (Autonomous)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Location Territory (Land Norm Clause 1.1)
              </label>
              <select
                value={regionType}
                onChange={(e) => setRegionType(e.target.value as any)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800"
              >
                <option value="Urban / Metro">Urban / Metro Territory (Min 2.50 Acres Contiguous)</option>
                <option value="Rural / Non-Metro">Rural / Non-Metro Territory (Min 5.00 Acres Contiguous)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Designated Principal / Director Name
              </label>
              <input
                type="text"
                value={principalName}
                onChange={(e) => setPrincipalName(e.target.value)}
                placeholder="Must match Ph.D. Degree & Council Affidavit exactly"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800"
              />
            </div>
          </div>

          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2.5 text-xs text-blue-900">
            <GraduationCap className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Submitting this profile registers a formal application record in the compliance database. On the next screen, you will upload the 4 mandatory statutory documents for automated OCR extraction, ELA forensic screening, and cross-document reconciliation.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={isCreatingApp}
              className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center space-x-2 disabled:bg-slate-300"
            >
              {isCreatingApp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registering Application...</span>
                </>
              ) : (
                <>
                  <span>Proceed to Document Bundle</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: Multi-File Upload Interface with Progress */}
      {currentStep === 2 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderUp className="w-4 h-4 text-blue-700" />
                <span>Multi-Document Statutory Ingestion Desk</span>
              </h3>
              <p className="text-xs text-slate-500">
                Application Number:{' '}
                <span className="font-mono font-bold text-blue-800">
                  {createdApp?.application_number || 'APP-2026-INGEST'}
                </span>
              </p>
            </div>
            <div className="text-xs text-slate-600 bg-slate-50 px-3 py-1 rounded border border-slate-200">
              Institution: <span className="font-semibold">{institutionName}</span>
            </div>
          </div>

          {/* Document Upload Cards */}
          <div className="space-y-3.5">
            {docChecklist.map((item) => {
              const file = selectedFiles[item.type];
              const status = uploadStatus[item.type];
              const progress = uploadProgress[item.type];

              return (
                <div
                  key={item.type}
                  className={`p-4 rounded-xl border transition-all ${
                    status === 'completed'
                      ? 'bg-emerald-50/40 border-emerald-300'
                      : status === 'uploading'
                      ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-300'
                      : status === 'error'
                      ? 'bg-rose-50/40 border-rose-300'
                      : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileText className={`w-4 h-4 ${status === 'completed' ? 'text-emerald-600' : 'text-blue-600'}`} />
                        <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                          {item.ruleCode}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {item.requirement}
                      </p>

                      {file && (
                        <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-slate-600">
                          <span className="truncate max-w-xs">{file.name}</span>
                          <span>({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                        </div>
                      )}
                    </div>

                    {/* Upload Trigger / Status */}
                    <div className="shrink-0 flex items-center gap-2 self-start sm:self-auto">
                      {status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Indexed & Screened</span>
                        </span>
                      ) : status === 'uploading' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 bg-blue-100 px-2.5 py-1 rounded-full border border-blue-200">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          <span>Uploading ({progress}%)</span>
                        </span>
                      ) : status === 'error' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-800 bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Upload Failed</span>
                        </span>
                      ) : null}

                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-xs transition">
                        <UploadCloud className="w-3.5 h-3.5 text-blue-700" />
                        <span>{file ? 'Replace File' : 'Select PDF / Image'}</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileSelect(item.type, e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {status === 'uploading' && (
                    <div className="mt-3 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submission Pipeline Progress Banner */}
          {isSubmitting && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-700" />
                <span>Verification Pipeline Active</span>
              </div>
              <p className="text-xs text-blue-700 font-medium">
                {submissionStep}
              </p>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg self-start sm:self-auto"
            >
              Back to Parameters
            </button>

            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isSubmitting || !allUploaded}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2 shadow-sm transition ${
                isSubmitting || !allUploaded
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Executing Automated Validation...'
                  : 'Submit for Automated Scrutiny Pipeline'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
