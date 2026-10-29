import io
from pathlib import Path
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from backend.app.core.database import get_db
from backend.app.core.config import settings
from backend.app.core.security import get_password_hash
from backend.app.models.models import (
    User, Application, Document, DocumentForensics, ExtractedEntities,
    ComplianceFinding, AssessmentSummary, ApplicationAuditLog
)
from backend.app.services.forensic_service import ForensicService
from backend.app.services.ocr_service import OCRService
from backend.app.services.extractor_service import ExtractorService
from backend.app.services.cross_validator import CrossValidator
from backend.app.services.rules_engine import RulesEngine

router = APIRouter(prefix="/demo", tags=["SIH Demo Scenarios"])

def _create_sample_pdf(file_path: Path, title: str, paragraphs: list[str], custom_metadata: dict = None):
    file_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(file_path), pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    styles = getSampleStyleSheet()
    
    t_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontSize=16, leading=20, textColor=colors.HexColor('#1E3A8A'), alignment=1)
    p_style = ParagraphStyle('DocBody', parent=styles['Normal'], fontSize=10, leading=15, textColor=colors.HexColor('#1F2937'))
    
    story = [
        Paragraph(title, t_style),
        Spacer(1, 15)
    ]
    for p in paragraphs:
        story.append(Paragraph(p, p_style))
        story.append(Spacer(1, 8))
        
    doc.build(story)
    
    # If custom metadata needed (e.g. to simulate editing tool footprint)
    if custom_metadata:
        import fitz
        fdoc = fitz.open(str(file_path))
        meta = fdoc.metadata
        for k, v in custom_metadata.items():
            meta[k] = v
        fdoc.set_metadata(meta)
        temp_path = file_path.with_suffix(".tmp.pdf")
        fdoc.save(str(temp_path))
        fdoc.close()
        temp_path.replace(file_path)

@router.post("/seed-samples")
def seed_demo_scenarios(db: Session = Depends(get_db)):
    """
    Seeds default reviewer & applicant users, and generates the 3 pre-engineered SIH demo cases:
    - Case A: Gold Standard (Pass / Recommended for Approval)
    - Case B: Cross-Document Discrepancy & Missing Architect COA
    - Case C: Forensics Tamper Anomaly & Expired Fire NOC (Rejected)
    """
    # Ensure all DB tables are created
    from backend.app.core.database import Base, engine
    Base.metadata.create_all(bind=engine)

    # 1. Ensure Demo Users Exist
    reviewer = db.query(User).filter(User.email == "reviewer@aicte.gov.in").first()
    if not reviewer:
        reviewer = User(
            email="reviewer@aicte.gov.in",
            password_hash=get_password_hash("reviewer123"),
            full_name="Dr. Arvind Sharma (Senior Scrutiny Officer)",
            role="REVIEWER",
            institution_name="Regulatory Council Scrutiny Cell"
        )
        db.add(reviewer)

    applicant = db.query(User).filter(User.email == "applicant@apex.edu").first()
    if not applicant:
        applicant = User(
            email="applicant@apex.edu",
            password_hash=get_password_hash("applicant123"),
            full_name="Dr. K. S. Ramanujam (Principal)",
            role="APPLICANT",
            institution_name="Apex Institute of Technology"
        )
        db.add(applicant)

    admin = db.query(User).filter(User.email == "admin@aicte.gov.in").first()
    if not admin:
        admin = User(
            email="admin@aicte.gov.in",
            password_hash=get_password_hash("admin123"),
            full_name="Smt. Meenakshi Sundaram (Chief System Administrator)",
            role="ADMIN",
            institution_name="AICTE Central Governance Directorate"
        )
        db.add(admin)

    auditor = db.query(User).filter(User.email == "auditor@cag.gov.in").first()
    if not auditor:
        auditor = User(
            email="auditor@cag.gov.in",
            password_hash=get_password_hash("auditor123"),
            full_name="Shri R. Venkatraman (Principal Statutory Auditor)",
            role="AUDITOR",
            institution_name="Comptroller & Auditor General of India"
        )
        db.add(auditor)

    db.commit()
    db.refresh(reviewer)
    db.refresh(applicant)
    db.refresh(admin)
    db.refresh(auditor)

    # 1.1 Ensure Default Data Retention Policies Exist
    from backend.app.models.models import DataRetentionPolicy, MaskingConfiguration
    if db.query(DataRetentionPolicy).count() == 0:
        db.add_all([
            DataRetentionPolicy(
                policy_code="RETENTION_ACCREDITED",
                title="Accredited Institutional Applications",
                category="ACCREDITED_RECORDS",
                retention_days=2555,
                is_legal_hold=False,
                auto_purge_enabled=False,
                description="Statutory institutional accreditation filings preserved for 7 years."
            ),
            DataRetentionPolicy(
                policy_code="RETENTION_REJECTED",
                title="Rejected Applications & Scrutiny Records",
                category="REJECTED_RECORDS",
                retention_days=1095,
                is_legal_hold=False,
                auto_purge_enabled=True,
                description="Maintained for statutory appellate windows (3 years)."
            ),
            DataRetentionPolicy(
                policy_code="RETENTION_OCR_CACHE",
                title="Temporary OCR Extraction Artifacts & Heatmaps",
                category="TEMPORARY_CACHE",
                retention_days=90,
                is_legal_hold=False,
                auto_purge_enabled=True,
                description="Intermediate forensic heatmaps and OCR text scratch caches."
            ),
            DataRetentionPolicy(
                policy_code="RETENTION_DRAFTS",
                title="Unsubmitted Abandoned Drafts",
                category="ABANDONED_DRAFTS",
                retention_days=30,
                is_legal_hold=False,
                auto_purge_enabled=True,
                description="Incomplete draft submissions inactive for over 30 days."
            ),
        ])
        db.commit()

    if db.query(MaskingConfiguration).count() == 0:
        db.add_all([
            MaskingConfiguration(
                identifier_type="AADHAAR",
                label="Aadhaar UIDAI Number",
                pattern_regex=r"\b(\d{4})[ -]?(\d{4})[ -]?(\d{4})\b",
                masking_mode="PARTIAL_MASK",
                is_active=True,
                unmask_requires_justification=True,
                session_timeout_minutes=15
            ),
            MaskingConfiguration(
                identifier_type="PAN",
                label="Permanent Account Number (PAN)",
                pattern_regex=r"\b([A-Z]{5})(\d{4})([A-Z]{1})\b",
                masking_mode="PARTIAL_MASK",
                is_active=True,
                unmask_requires_justification=True,
                session_timeout_minutes=15
            ),
            MaskingConfiguration(
                identifier_type="PHONE",
                label="Mobile Contact Number",
                pattern_regex=r"\b(?:\+91|0)?([6-9]\d{5})(\d{4})\b",
                masking_mode="PARTIAL_MASK",
                is_active=True,
                unmask_requires_justification=True,
                session_timeout_minutes=15
            ),
            MaskingConfiguration(
                identifier_type="EMAIL",
                label="Personal Email Address",
                pattern_regex=r"\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b",
                masking_mode="PARTIAL_MASK",
                is_active=True,
                unmask_requires_justification=True,
                session_timeout_minutes=15
            ),
            MaskingConfiguration(
                identifier_type="BANK_ACCOUNT",
                label="Bank Account Number",
                pattern_regex=r"\b\d{9,18}\b",
                masking_mode="FULL_MASK",
                is_active=True,
                unmask_requires_justification=True,
                session_timeout_minutes=15
            ),
        ])
        db.commit()

    created_cases = []
    sample_dir = settings.SAMPLE_DOCS_DIR

    # -------------------------------------------------------------
    # CASE A: GOLD STANDARD (Eligible)
    # -------------------------------------------------------------
    case_a_app = db.query(Application).filter(Application.application_number == "APP-2026-CASE-A").first()
    if not case_a_app:
        case_a_app = Application(
            applicant_id=applicant.id,
            application_number="APP-2026-CASE-A",
            program_name="Undergraduate Engineering & Technology",
            institution_type="Private / Self-Financed",
            status="SUBMITTED",
            submitted_at=datetime.now(timezone.utc)
        )
        db.add(case_a_app)
        db.commit()
        db.refresh(case_a_app)

        # Generate Case A documents
        # 1. Land Deed (3.20 Acres)
        p_deed = sample_dir / "CaseA_Land_Deed.pdf"
        _create_sample_pdf(p_deed, "REGISTERED SALE DEED & TITLE CERTIFICATE", [
            "This registered title deed executed on 12/04/2018 in favour of Apex Educational Trust.",
            "Schedule of Property: All that piece and parcel of land bearing Survey No. 142/1A, 142/2 in Gandhinagar.",
            "Total land area: 3.20 Acres of unencumbered contiguous freehold land.",
            "Sub-Registrar Office: Sub-Registrar Office Gandhinagar. Document No: REG-DEED-8841/2018.",
            "Proprietor Aadhaar: 9812 4589 1234. Trust PAN: ABCDE1234F."
        ])

        # 2. Building Plan (3.20 Acres, COA Reg present)
        p_plan = sample_dir / "CaseA_Building_Plan.pdf"
        _create_sample_pdf(p_plan, "APPROVED CAMPUS MASTER SITE PLAN", [
            "Comprehensive campus layout plan for Apex Institute of Technology.",
            "Total plot area: 3.20 Acres. Total built-up area: 5400 sqm.",
            "Certifying Architect: Ar. R. Venkatesh.",
            "Council of Architecture COA Registration No: CA/2016/48201.",
            "Sanctioning Authority: Directorate of Town and Country Planning (DTCP).",
            "Sanction Approval Ref: DTCP/2019/BP-4912 dated 14/08/2019."
        ])

        # 3. Fire NOC (Active until 2027)
        p_fire = sample_dir / "CaseA_Fire_NOC.pdf"
        _create_sample_pdf(p_fire, "STATE FIRE & RESCUE SERVICES — NO OBJECTION CERTIFICATE", [
            "State Disaster Response and Fire Services Department.",
            "Certificate No: NOC-FIRE-2024-883. Issued on: 15/05/2024.",
            "Valid up to: 15/05/2027 for educational campus occupancy.",
            "Inspected multi-story engineering laboratory and lecture blocks. Road width: 12.0 meters.",
            "Automatic fire sprinkler system and yard hydrant found in operational readiness."
        ])

        # 4. Faculty List (SFR 1:15)
        p_fac = sample_dir / "CaseA_Faculty_Cadre.pdf"
        _create_sample_pdf(p_fac, "SANCTIONED TEACHING FACULTY CADRE REGISTER", [
            "Apex Institute of Technology — Faculty Master Register Academic Year 2026-27.",
            "Principal: Dr. K. S. Ramanujam (Ph.D., IIT Madras).",
            "Professors: 4. Associate Professors: 8. Assistant Professors: 24.",
            "Total faculty: 36. Total enrolled students: 540.",
            "Effective Student to Faculty Ratio: 1:15.00."
        ])

        # Process and register Case A documents
        for dtype, ppath in [("LAND_DEED", p_deed), ("BUILDING_PLAN", p_plan), ("FIRE_NOC", p_fire), ("FACULTY_LIST", p_fac)]:
            f_res = ForensicService.full_screening(ppath)
            ocr_res = OCRService.extract_document_text(ppath)
            ext_res = ExtractorService.extract_entities(dtype, ocr_res["full_text"])

            doc_rec = Document(
                application_id=case_a_app.id,
                document_type=dtype,
                file_name=ppath.name,
                storage_path=str(ppath),
                sha256_hash=f_res["sha256_hash"],
                file_size_bytes=ppath.stat().st_size,
                mime_type="application/pdf",
                extraction_status="SUCCESS"
            )
            db.add(doc_rec)
            db.flush()

            db.add(DocumentForensics(
                document_id=doc_rec.id,
                ela_anomaly_score=f_res["ela_anomaly_score"],
                metadata_mismatch_flag=False,
                metadata_dump=f_res["metadata_dump"],
                risk_level="LOW",
                remarks="Screened normal; verified authentic document structure."
            ))
            db.add(ExtractedEntities(
                document_id=doc_rec.id,
                structured_fields=ext_res["structured_fields"],
                confidence_score=0.95,
                ocr_engine="PYMUPDF",
                raw_text=ocr_res["full_text"]
            ))

        db.commit()

        # Run validation on Case A
        summary_a = AssessmentSummary(
            application_id=case_a_app.id,
            authenticity_score=100.0,
            completeness_score=100.0,
            compliance_score=100.0,
            composite_score=100.0,
            recommendation="ELIGIBLE"
        )
        db.add(summary_a)
        case_a_app.status = "APPROVED"
        db.commit()

    created_cases.append({"case": "Case A", "app_num": "APP-2026-CASE-A", "status": "APPROVED / ELIGIBLE"})

    # -------------------------------------------------------------
    # CASE B: CROSS-DOCUMENT MISMATCH & MISSING COA (Deficient)
    # -------------------------------------------------------------
    case_b_app = db.query(Application).filter(Application.application_number == "APP-2026-CASE-B").first()
    if case_b_app and len(case_b_app.documents) == 0:
        db.delete(case_b_app)
        db.commit()
        case_b_app = None

    if not case_b_app:
        case_b_app = Application(
            applicant_id=applicant.id,
            application_number="APP-2026-CASE-B",
            program_name="Undergraduate Engineering & Technology",
            institution_type="Private / Self-Financed",
            status="SUBMITTED",
            submitted_at=datetime.now(timezone.utc)
        )
        db.add(case_b_app)
        db.commit()
        db.refresh(case_b_app)

        # 1. Land Deed (2.50 Acres)
        p_b_deed = sample_dir / "CaseB_Land_Deed.pdf"
        _create_sample_pdf(p_b_deed, "TITLE DEED & CONVEYANCE REGISTER", [
            "Conveyance deed executed in favour of Bharti Educational Society.",
            "Total land area: 2.50 Acres situated in Revenue Survey No. 88/2.",
            "Registered at District Registrar Office on 14/03/2019."
        ])

        # 2. Building Plan (Only 1.85 Acres cited! Discrepancy of 0.65 Acres; Missing COA#)
        p_b_plan = sample_dir / "CaseB_Building_Plan.pdf"
        _create_sample_pdf(p_b_plan, "CAMPUS MASTER SITE PLAN", [
            "Bharti Technical Campus master layout drawing.",
            "Total plot area: 1.85 Acres. Total built-up area: 4100 sqm.",
            "Architect: Draftsman S. Kumar. COA Registration: Blank.",
            "Sanctioning Authority: Town Planning Committee."
        ])

        # 3. Fire NOC (Active)
        p_b_fire = sample_dir / "CaseB_Fire_NOC.pdf"
        _create_sample_pdf(p_b_fire, "FIRE SAFETY NO OBJECTION CLEARANCE", [
            "State Disaster Response and Fire Services Department.",
            "Certificate No: NOC-FS-2024-114.",
            "Valid up to: 20/12/2026. Premises certified satisfactory."
        ])

        # 4. Faculty Register
        p_b_fac = sample_dir / "CaseB_Faculty_List.pdf"
        _create_sample_pdf(p_b_fac, "TEACHING CADRE LIST", [
            "Principal: Dr. V. K. Murthy. Total faculty: 30. Total students: 450. SFR: 1:15.0."
        ])

        for dtype, ppath in [("LAND_DEED", p_b_deed), ("BUILDING_PLAN", p_b_plan), ("FIRE_NOC", p_b_fire), ("FACULTY_LIST", p_b_fac)]:
            f_res = ForensicService.full_screening(ppath)
            ocr_res = OCRService.extract_document_text(ppath)
            ext_res = ExtractorService.extract_entities(dtype, ocr_res["full_text"])

            doc_rec = Document(
                application_id=case_b_app.id,
                document_type=dtype,
                file_name=ppath.name,
                storage_path=str(ppath),
                sha256_hash=f_res["sha256_hash"],
                file_size_bytes=ppath.stat().st_size,
                mime_type="application/pdf",
                extraction_status="SUCCESS"
            )
            db.add(doc_rec)
            db.flush()

            db.add(DocumentForensics(
                document_id=doc_rec.id,
                ela_anomaly_score=f_res["ela_anomaly_score"],
                metadata_mismatch_flag=False,
                risk_level="LOW",
                remarks="Screened normal."
            ))
            db.add(ExtractedEntities(
                document_id=doc_rec.id,
                structured_fields=ext_res["structured_fields"],
                confidence_score=0.90,
                ocr_engine="PYMUPDF",
                raw_text=ocr_res["full_text"]
            ))

        db.commit()

        # Generate Case B findings
        db.add(ComplianceFinding(
            application_id=case_b_app.id,
            category="COMPLETENESS",
            severity="CRITICAL",
            rule_code="SYNTH-NORM-5.1.1",
            title="Cross-Document Land Extent Discrepancy",
            description="Land Deed states 2.50 Acres, but Approved Building Master Plan states 1.85 Acres. Unreconciled deficit of 0.65 Acres exceeds allowable tolerance.",
            evidence_quote="Deed: 2.50 Acres vs Building Plan: 1.85 Acres (Deficit: 0.65 Acres)",
            suggested_remediation="Submit an official registered Rectification Deed or approved site plan reconciling the 0.65-acre variance."
        ))
        db.add(ComplianceFinding(
            application_id=case_b_app.id,
            category="COMPLETENESS",
            severity="WARNING",
            rule_code="SYNTH-NORM-2.1.1",
            title="Missing Architect Council Registration Endorsement",
            description="The building plan layout does not feature a verified Council of Architecture (COA) registration seal.",
            evidence_quote="Architect: Draftsman S. Kumar, COA Registration: Blank",
            suggested_remediation="Resubmit site plan countersigned by a registered Architect with their valid COA number (CA/YYYY/NNNNN)."
        ))
        db.add(AssessmentSummary(
            application_id=case_b_app.id,
            authenticity_score=98.0,
            completeness_score=65.0,
            compliance_score=95.0,
            composite_score=85.4,
            recommendation="DEFICIENT"
        ))
        case_b_app.status = "DEFICIENT"
        db.commit()

    created_cases.append({"case": "Case B", "app_num": "APP-2026-CASE-B", "status": "DEFICIENT (Area Mismatch)"})

    # -------------------------------------------------------------
    # CASE C: FORENSIC ANOMALY & EXPIRED FIRE NOC (Rejected)
    # -------------------------------------------------------------
    case_c_app = db.query(Application).filter(Application.application_number == "APP-2026-CASE-C").first()
    if case_c_app and len(case_c_app.documents) == 0:
        db.delete(case_c_app)
        db.commit()
        case_c_app = None

    if not case_c_app:
        case_c_app = Application(
            applicant_id=applicant.id,
            application_number="APP-2026-CASE-C",
            program_name="Undergraduate Engineering & Technology",
            institution_type="Private / Self-Financed",
            status="SUBMITTED",
            submitted_at=datetime.now(timezone.utc)
        )
        db.add(case_c_app)
        db.commit()
        db.refresh(case_c_app)

        # 1. Land Deed
        p_c_deed = sample_dir / "CaseC_Land_Deed.pdf"
        _create_sample_pdf(p_c_deed, "SALE DEED TITLE", [
            "Total land area: 2.50 Acres in Crestview Tech City. Survey No. 42/B."
        ])

        # 2. Building Plan
        p_c_plan = sample_dir / "CaseC_Building_Plan.pdf"
        _create_sample_pdf(p_c_plan, "CAMPUS MASTER PLAN", [
            "Total plot area: 2.50 Acres. Builtup area: 4200 sqm. Architect: Ar. M. Bose, CA/2012/19482."
        ])

        # 3. Fire NOC (Tampered metadata: Adobe Photoshop + Expired date 2023)
        p_c_fire = sample_dir / "CaseC_Fire_NOC.pdf"
        _create_sample_pdf(
            p_c_fire,
            "STATE FIRE SERVICES — NO OBJECTION CERTIFICATE",
            [
                "State Fire and Rescue Services Department.",
                "Certificate No: NOC-FS-2022-771.",
                "Valid up to: 10/01/2023 (EXPIRED).",
                "Notice: Campus fire clearance expired and pending physical inspection."
            ],
            custom_metadata={
                "producer": "Adobe Photoshop 2023 (Windows)",
                "creator": "Adobe Photoshop CC",
                "modDate": "D:20261025183000Z",
                "creationDate": "D:20220110100000Z"
            }
        )

        # 4. Faculty Register with SFR violation (1:22.5)
        p_c_fac = sample_dir / "CaseC_Faculty_List.pdf"
        _create_sample_pdf(p_c_fac, "TEACHING CADRE REGISTER", [
            "Total faculty: 20. Total students: 450. Effective SFR: 1:22.5 (Violates Norm 4.1.1)."
        ])

        for dtype, ppath in [("LAND_DEED", p_c_deed), ("BUILDING_PLAN", p_c_plan), ("FIRE_NOC", p_c_fire), ("FACULTY_LIST", p_c_fac)]:
            f_res = ForensicService.full_screening(ppath)
            ocr_res = OCRService.extract_document_text(ppath)
            ext_res = ExtractorService.extract_entities(dtype, ocr_res["full_text"])

            # If Fire NOC, explicitly simulate elevated ELA anomaly score to reflect localized modification
            risk_lvl = "HIGH" if dtype == "FIRE_NOC" else f_res["risk_level"]
            ela_score = 78.4 if dtype == "FIRE_NOC" else f_res["ela_anomaly_score"]
            remarks = "High anomaly: Created/modified via Adobe Photoshop; date text recompression noise detected." if dtype == "FIRE_NOC" else "Screened normal."

            doc_rec = Document(
                application_id=case_c_app.id,
                document_type=dtype,
                file_name=ppath.name,
                storage_path=str(ppath),
                sha256_hash=f_res["sha256_hash"],
                file_size_bytes=ppath.stat().st_size,
                mime_type="application/pdf",
                extraction_status="SUCCESS"
            )
            db.add(doc_rec)
            db.flush()

            db.add(DocumentForensics(
                document_id=doc_rec.id,
                ela_anomaly_score=ela_score,
                metadata_mismatch_flag=(dtype == "FIRE_NOC"),
                metadata_dump=f_res["metadata_dump"],
                risk_level=risk_lvl,
                remarks=remarks
            ))
            db.add(ExtractedEntities(
                document_id=doc_rec.id,
                structured_fields=ext_res["structured_fields"],
                confidence_score=0.88,
                ocr_engine="PYMUPDF",
                raw_text=ocr_res["full_text"]
            ))

        db.commit()

        # Findings for Case C
        db.add(ComplianceFinding(
            application_id=case_c_app.id,
            category="AUTHENTICITY",
            severity="CRITICAL",
            rule_code="SYNTH-NORM-6.1.2",
            title="Document Tampering & Metadata Footprint Anomaly",
            description="Fire NOC PDF metadata contains direct traces of 'Adobe Photoshop 2023', combined with high ELA localized compression variance (Score: 78.4). Indicates potential manual tampering of date field.",
            evidence_quote="Producer: Adobe Photoshop 2023 | ModDate: 2026 vs CreationDate: 2022 | ELA: 78.4",
            suggested_remediation="Upload pristine, unmodified digital certificate downloaded directly from the State Fire Services Portal."
        ))
        db.add(ComplianceFinding(
            application_id=case_c_app.id,
            category="REGULATORY",
            severity="CRITICAL",
            rule_code="SYNTH-NORM-3.1.2",
            title="Expired Fire & Life Safety Clearance",
            description="The Fire Safety NOC lapsed on 10/01/2023. Campus occupancy without an active clearance is strictly non-compliant.",
            evidence_quote="Valid Up To: 10/01/2023 (Lapsed)",
            suggested_remediation="Apply for renewal inspection with the Chief Fire Officer and obtain current NOC."
        ))
        db.add(ComplianceFinding(
            application_id=case_c_app.id,
            category="REGULATORY",
            severity="WARNING",
            rule_code="SYNTH-NORM-4.1.1",
            title="Student-to-Faculty Ratio Exceeds Prescribed Limit",
            description="Calculated SFR is 1:22.5, which exceeds the mandatory 1:15 ceiling for Undergraduate Technical Education.",
            evidence_quote="Faculty: 20, Students: 450 (SFR 1:22.5)",
            suggested_remediation="Recruit minimum 10 additional certified faculty members to reach compliant 1:15 ratio."
        ))
        db.add(AssessmentSummary(
            application_id=case_c_app.id,
            authenticity_score=45.0,
            completeness_score=100.0,
            compliance_score=55.0,
            composite_score=65.0,
            recommendation="REJECTED"
        ))
        case_c_app.status = "FLAGGED"
        db.commit()

    created_cases.append({"case": "Case C", "app_num": "APP-2026-CASE-C", "status": "FLAGGED / REJECTED (Photoshop + Expired NOC)"})

    return {
        "success": True,
        "message": "SIH 2026 demo test cases seeded successfully.",
        "cases": created_cases,
        "demo_credentials": {
            "applicant": "applicant@apex.edu / applicant123",
            "reviewer": "reviewer@aicte.gov.in / reviewer123"
        }
    }
