# TrustDoc (SIH 2026 — SIH26261)
## AI-Powered Institutional Document Forensics & Regulatory Scrutiny Platform

An automated verification and compliance platform developed for Smart India Hackathon 2026 (Problem Statement ID: **SIH26261**).

---

### Project Architecture & Capabilities

1. **Document Ingestion & Multi-Format Parsing**:
   - Ingests institutional accreditation bundles (PDF, PNG, JPG).
   - PyMuPDF text stream extraction with layout-aware block segmentation.
2. **Document Authenticity Screening**:
   - SHA-256 cryptographic duplicate detection.
   - PDF internal metadata analysis (identifying graphic editor footprints such as Photoshop or Canva, and creation vs modification discrepancies).
   - Localized Error Level Analysis (ELA) pixel compression noise variance.
   - QR code payload parsing and PKI X.509 digital signature container detection.
   - *Forensic Scope*: Flags risk indicators and anomaly warnings for human verification without claiming definitive proof of forgery.
3. **Tripartite Scrutiny Assessment**:
   - **Document Authenticity Score (0-100)**: Forensic health and integrity index.
   - **Application Completeness Score (0-100)**: Mandatory document checklist and inter-document fact reconciliation (e.g. Land Deed vs Site Plan).
   - **Regulatory Compliance Score (0-100)**: Deterministic evaluation of synthetic council criteria (land extent, fire safety validity, SFR).
4. **Evidence-Linked Findings & Actionable Remediation**:
   - Every finding specifies severity (`CRITICAL`, `WARNING`, `INFO`), synthetic clause citation, evidence quote, and clear remediation instructions.
5. **Regulatory RAG & Applicant Chatbot**:
   - Vector-based semantic search over synthetic regulatory guidelines (`SYNTH-NORM`).
   - Multilingual response generation supporting **English**, **Hindi (हिन्दी)**, and **Telugu (తెలుగు)**.
6. **Reviewer Governance & PII Protection**:
   - Automatic redaction of sensitive identifiers (Aadhaar `XXXX-XXXX-1234`, PAN `XXXXX1234X`).
   - Role-based PII unmasking with mandatory justification and immutable audit logging.
   - Human-in-the-loop finding override capabilities.
   - Official ReportLab downloadable PDF summary report.

---

### Quick Start Guide

#### 1. Backend Service (FastAPI)
```bash
cd backend
# Create virtual environment & activate
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Interactive Swagger API Documentation: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

#### 2. Frontend Dashboard (React + Vite + Tailwind)
```bash
cd frontend
npm install
npm run dev
```
- Web Application: `http://127.0.0.1:5173`

#### 3. Automated Test Suite
```bash
python -m pytest backend/tests/test_compliance.py -v
```

---

---

## Foundation setup (Windows PowerShell)

The frontend and backend are independently runnable. Run each service in its own PowerShell window from the repository root.

### Backend

```powershell
cd C:\Users\sonal\OneDrive\Desktop\TrustDoc
py -3.11 -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend health check: `http://127.0.0.1:8000/api/health`.

### Frontend

```powershell
cd C:\Users\sonal\OneDrive\Desktop\TrustDoc\frontend
Copy-Item .env.example .env
npm install
npm run dev
```

The frontend runs at `http://127.0.0.1:5173`. `VITE_API_BASE_URL` configures the reusable Axios API client. Local CORS permits `http://localhost:5173` and `http://127.0.0.1:5173` by default; change `BACKEND_CORS_ORIGINS` in `backend/.env` when needed.

### Verification

```powershell
cd C:\Users\sonal\OneDrive\Desktop\TrustDoc
.\backend\.venv\Scripts\Activate.ps1
python -m pytest backend\tests -v

cd frontend
npm run build
```

### SIH Judge Demonstration Scenarios

The system comes pre-seeded with 3 realistic test cases selectable via the top navbar:
- **Case A (Pass / Eligible)**: *Apex Institute of Technology* — All documents authentic, compliant, and verified.
- **Case B (Deficient / Area Mismatch)**: *Bharti Technical Institute* — Land title states 2.50 acres, but site plan cites 1.85 acres (0.65-acre deficit flagged under `SYNTH-NORM-5.1.1`).
- **Case C (Rejected / Tampered)**: *Crestview Polytechnic* — Fire Safety NOC modified in Photoshop with high ELA noise variance (Score: 78.4) and expired validity date.
