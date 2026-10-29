import uuid
import hashlib
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.config import settings
from backend.app.models.models import ValidationRule, RegulatorySource, RegulatoryRAGChunk, Application
from backend.app.schemas.schemas import (
    ValidationRuleResponse,
    RegulatorySourceResponse,
    RegulatorySourceIngestRequest,
    RegulatoryChunkResponse,
    ComplianceEvaluationResponse,
    RegulatoryQueryRequest,
    RegulatoryQueryResponse,
)
from backend.app.services.rag_service import rag_service
from backend.app.services.regulatory_rag.service import regulatory_rag_service
from backend.app.services.regulatory_rag.types import RegulatorySourceMetadata


router = APIRouter(prefix="/regulations", tags=["Regulatory Catalog & Handbook"])

SYNTHETIC_RULES = [
    {
        "chapter": "Chapter 1: Land & Location Norms",
        "rule_code": "SYNTH-NORM-1.1.1",
        "title": "Minimum Urban / Metro Land Extent",
        "threshold": ">= 2.50 Contiguous Acres",
        "description": "An institution offering Undergraduate Degree in Engineering & Technology in Urban/Metro territory must possess a minimum of 2.50 Acres (or 1.01 Hectares) of contiguous, unencumbered land.",
        "mandatory_doc": "Land Title Deed / Registered Sale Deed",
        "severity": "CRITICAL"
    },
    {
        "chapter": "Chapter 1: Land & Location Norms",
        "rule_code": "SYNTH-NORM-1.1.2",
        "title": "Minimum Rural Land Extent",
        "threshold": ">= 5.00 Contiguous Acres",
        "description": "In Rural or non-metro areas, the minimum required contiguous land area for UG Engineering approval is 5.00 Acres.",
        "mandatory_doc": "Land Title Deed & Patta Passbook",
        "severity": "CRITICAL"
    },
    {
        "chapter": "Chapter 1: Land & Location Norms",
        "rule_code": "SYNTH-NORM-1.1.3",
        "title": "Title & Ownership Clearance",
        "threshold": "Clear Title / Lease >= 30 Years",
        "description": "Land must be owned via a registered Sale Deed or registered perpetual lease (minimum 30 years). Title Deed must contain clear survey numbers, subdivision bounds, and registration date.",
        "mandatory_doc": "Encumbrance Certificate & Title Deed",
        "severity": "CRITICAL"
    },
    {
        "chapter": "Chapter 2: Built-up Infrastructure & Master Plan",
        "rule_code": "SYNTH-NORM-2.1.1",
        "title": "Architect Council of Architecture (COA) Endorsement",
        "threshold": "Valid COA Reg Number (CA/YYYY/NNNNN) + Seal",
        "description": "All site plans and building layout diagrams must be certified and signed by an Architect registered with the Council of Architecture (COA) with a verifiable registration number.",
        "mandatory_doc": "Master Site Plan / Floor Plan",
        "severity": "CRITICAL"
    },
    {
        "chapter": "Chapter 2: Built-up Infrastructure & Master Plan",
        "rule_code": "SYNTH-NORM-2.1.2",
        "title": "Competent Authority Sanction Seal",
        "threshold": "Municipal / Urban Planning Sanction Order",
        "description": "Master Plan must bear the official sanction seal and approval number of the competent Urban Planning / Town & Country Planning / Municipal Corporation department.",
        "mandatory_doc": "Approved Master Plan",
        "severity": "CRITICAL"
    },
    {
        "chapter": "Chapter 2: Built-up Infrastructure & Master Plan",
        "rule_code": "SYNTH-NORM-2.1.3",
        "title": "Instructional Area Norms",
        "threshold": ">= 4,000 sqm carpet area for 300 intake",
        "description": "Minimum carpet area for academic classrooms, lecture halls, and laboratories must not fall below 4,000 square meters for an intake of 300 students.",
        "mandatory_doc": "Building Floor Area Schedule",
        "severity": "WARNING"
    },
    {
        "chapter": "Chapter 3: Life Safety & Fire Clearance",
        "rule_code": "SYNTH-NORM-3.1.1",
        "title": "Fire NOC Issuing Authority",
        "threshold": "State Fire Services / CFO Authorized",
        "description": "The Fire Safety Certificate / No-Objection Certificate (NOC) must be issued by the State Fire Services Department or Chief Fire Officer.",
        "mandatory_doc": "Fire Safety Certificate (NOC)",
        "severity": "CRITICAL"
    },
    {
        "chapter": "Chapter 3: Life Safety & Fire Clearance",
        "rule_code": "SYNTH-NORM-3.1.2",
        "title": "Active Fire NOC Validity",
        "threshold": "Validity Unexpired at Evaluation Date",
        "description": "The certificate must be currently active and unexpired. If the validity period has lapsed at the date of application evaluation, the application shall be flagged as DEFICIENT.",
        "mandatory_doc": "Fire Safety Certificate (NOC)",
        "severity": "CRITICAL"
    },
    {
        "chapter": "Chapter 3: Life Safety & Fire Clearance",
        "rule_code": "SYNTH-NORM-3.1.3",
        "title": "Fire Access Road & Hydrants",
        "threshold": "Min 9.0m Width Road & Wet Risers",
        "description": "Fire clearance must verify access roads of minimum 9.0 meters width and operative water hydrant systems for firefighting equipment access.",
        "mandatory_doc": "Fire Inspection Clearance Report",
        "severity": "WARNING"
    },
    {
        "chapter": "Chapter 4: Faculty & Cadre Ratio",
        "rule_code": "SYNTH-NORM-4.1.1",
        "title": "Student-Faculty Ratio (SFR)",
        "threshold": "<= 1:15 (UG Engineering)",
        "description": "For undergraduate Engineering programs, the overall Student-to-Faculty Ratio (SFR) shall not exceed 1:15.",
        "mandatory_doc": "Faculty Cadre Declaration Affidavit",
        "severity": "CRITICAL"
    },
    {
        "chapter": "Chapter 4: Faculty & Cadre Ratio",
        "rule_code": "SYNTH-NORM-4.1.2",
        "title": "Teaching Cadre Ratio Balance",
        "threshold": "1 Professor : 2 Assoc Prof : 6 Asst Prof",
        "description": "The teaching faculty cadre ratio shall maintain a statutory balance of approximately 1 Professor : 2 Associate Professors : 6 Assistant Professors.",
        "mandatory_doc": "Faculty Appointment & Roster Register",
        "severity": "WARNING"
    },
    {
        "chapter": "Chapter 4: Faculty & Cadre Ratio",
        "rule_code": "SYNTH-NORM-4.1.3",
        "title": "Regular Principal / Director Appointment",
        "threshold": "Ph.D. Qualified + Seniority Clearance",
        "description": "The institution must have an appointed regular Principal/Director with Ph.D. credentials and approved council seniority.",
        "mandatory_doc": "Principal Ph.D. Degree & Appointment Order",
        "severity": "CRITICAL"
    },
    {
        "chapter": "Chapter 5: Cross-Document Integrity",
        "rule_code": "SYNTH-NORM-5.1.1",
        "title": "Multi-Document Land Acreage Consistency",
        "threshold": "Mismatch <= 0.05 Acres",
        "description": "The total land acreage cited in the registered Land Title Deed must exactly reconcile with the total plot area shown on the approved Master Site Plan and the Application Declaration.",
        "mandatory_doc": "Title Deed vs Master Plan Alignment",
        "severity": "CRITICAL"
    },
    {
        "chapter": "Chapter 5: Cross-Document Integrity",
        "rule_code": "SYNTH-NORM-5.1.2",
        "title": "Principal Identity Cross-Check",
        "threshold": "100% Identity Match",
        "description": "The individual designated as Principal in the Institutional Application Form must match the Appointment Order and Council Declaration Affidavit.",
        "mandatory_doc": "Application Form & Appointment Order",
        "severity": "CRITICAL"
    },
    {
        "chapter": "Chapter 6: Document Authenticity Screening",
        "rule_code": "SYNTH-NORM-6.1.1",
        "title": "Cryptographic Hash Collision Check",
        "threshold": "Zero Duplicate SHA-256 Hashes Across Unrelated Apps",
        "description": "Identical document file hashes (SHA-256) submitted across unrelated institution IDs trigger an immediate audit flag.",
        "mandatory_doc": "Cryptographic File Fingerprint",
        "severity": "CRITICAL"
    },
    {
        "chapter": "Chapter 6: Document Authenticity Screening",
        "rule_code": "SYNTH-NORM-6.1.2",
        "title": "Software Footprint & Metadata Integrity",
        "threshold": "Absence of Desktop Editor Artifacts (Photoshop/InDesign)",
        "description": "Documents showing editing software footprints or contradictory creation/modification timestamps trigger an Authenticity Warning for human verification.",
        "mandatory_doc": "PDF / Image Header Metadata Dump",
        "severity": "WARNING"
    },
    {
        "chapter": "Chapter 6: Document Authenticity Screening",
        "rule_code": "SYNTH-NORM-6.1.3",
        "title": "Error Level Analysis (ELA) Noise Verification",
        "threshold": "Variance Score < 50.0",
        "description": "Algorithmic forensic screening (ELA, metadata diffs) serves as risk identification for human verification, not conclusive proof of fraudulent intent.",
        "mandatory_doc": "ELA Recompression Analysis Map",
        "severity": "WARNING"
    }
]

@router.get("/rules")
def get_regulatory_rules(
    chapter: str = Query(None, description="Filter by chapter name"),
    search: str = Query(None, description="Search keyword in rules")
):
    rules = SYNTHETIC_RULES
    if chapter:
        rules = [r for r in rules if chapter.lower() in r["chapter"].lower()]
    if search:
        s = search.lower()
        rules = [
            r for r in rules
            if s in r["rule_code"].lower()
            or s in r["title"].lower()
            or s in r["description"].lower()
            or s in r["mandatory_doc"].lower()
        ]
    return {
        "handbook_version": "Synthetic Regulations Handbook v2026-Demo",
        "disclaimer": "FOR HACKATHON EVALUATION & DEMONSTRATION PURPOSES ONLY. Synthetic benchmark norms.",
        "total_rules": len(rules),
        "rules": rules
    }

@router.get("/rules/versions", response_model=list[ValidationRuleResponse])
def get_rule_versions_catalog(db: Session = Depends(get_db)):
    """Retrieve full relational rule catalog with active version parameters from database."""
    return db.query(ValidationRule).filter(ValidationRule.is_active == True).all()


@router.get("/sources", response_model=List[RegulatorySourceResponse])
def get_regulatory_sources(db: Session = Depends(get_db)):
    """Retrieve all ingested regulatory source documents and their chunk indexes."""
    if not regulatory_rag_service.chunks_map or db.query(RegulatorySource).count() == 0:
        regulatory_rag_service.initialize_default_sources(db=db)

    sources = db.query(RegulatorySource).all()
    results = []
    for s in sources:
        chunks_count = db.query(RegulatoryRAGChunk).filter(RegulatoryRAGChunk.source_id == s.id).count()
        results.append(
            RegulatorySourceResponse(
                id=s.id,
                source_name=s.source_name,
                authority=s.authority,
                edition_year=s.edition_year,
                version=s.version or "v2026.1",
                official_url_or_ref=s.official_url_or_ref,
                published_date=s.published_date,
                effective_date=s.effective_date,
                is_active=s.is_active if s.is_active is not None else True,
                sha256_hash=s.sha256_hash,
                chunks_count=chunks_count,
                created_at=s.created_at or datetime.now(timezone.utc)
            )
        )
    return results


@router.post("/sources/ingest")
def ingest_regulatory_source(
    req: RegulatorySourceIngestRequest,
    db: Session = Depends(get_db)
):
    """
    Ingest a verified regulatory source document, generate embeddings,
    and index into the FAISS vector store with DB persistence.
    """
    file_path = Path(req.file_path) if req.file_path else settings.REGULATIONS_DIR / "handbook_2026_demo.md"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Regulatory source file not found at: {file_path}")

    with open(file_path, "rb") as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()

    source_meta = RegulatorySourceMetadata(
        id=f"src-{uuid.uuid4().hex[:8]}",
        source_name=req.source_name,
        authority=req.authority,
        edition_year=req.edition_year,
        version=req.version,
        official_url_or_ref=req.official_url_or_ref,
        publication_date=datetime.now(timezone.utc),
        effective_date=req.effective_date or datetime.now(timezone.utc),
        is_active=req.is_active,
        sha256_hash=file_hash
    )

    result = regulatory_rag_service.ingest_source(source_meta, file_path, db=db)
    return {
        "status": "SUCCESS",
        "message": f"Successfully ingested and indexed '{req.source_name}'",
        "data": result
    }


@router.post("/sources/upload")
async def upload_regulatory_source_file(
    file: UploadFile = File(...),
    source_name: str = Form(...),
    authority: str = Form(...),
    edition_year: str = Form("2026-2027"),
    version: str = Form("v2026.1"),
    official_url_or_ref: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload a statutory regulatory PDF or Markdown document, validate format,
    index into FAISS vector space, and persist metadata.
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in [".pdf", ".md", ".txt"]:
        raise HTTPException(status_code=400, detail="Only PDF, MD, and TXT regulatory documents are supported.")

    save_path = settings.REGULATIONS_DIR / f"{uuid.uuid4().hex[:8]}_{file.filename}"
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    file_hash = hashlib.sha256(content).hexdigest()
    source_meta = RegulatorySourceMetadata(
        id=f"src-{uuid.uuid4().hex[:8]}",
        source_name=source_name,
        authority=authority,
        edition_year=edition_year,
        version=version,
        official_url_or_ref=official_url_or_ref,
        publication_date=datetime.now(timezone.utc),
        effective_date=datetime.now(timezone.utc),
        is_active=True,
        sha256_hash=file_hash
    )

    result = regulatory_rag_service.ingest_source(source_meta, save_path, db=db)
    return {
        "status": "SUCCESS",
        "message": f"Uploaded and indexed '{source_name}'",
        "data": result
    }


@router.post("/evaluate/{application_id}", response_model=ComplianceEvaluationResponse)
def evaluate_application_compliance(
    application_id: str,
    db: Session = Depends(get_db)
):
    """
    Evaluates an institutional application's facts against verified regulatory clauses.
    Categorizes every finding into one of the 5 epistemic compliance states:
    - EXPLICITLY_SATISFIED
    - APPARENTLY_VIOLATED
    - AMBIGUOUS_REQUIREMENT
    - OUTDATED_OR_UNAVAILABLE_SOURCE
    - NEEDS_HUMAN_REVIEW
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail=f"Application {application_id} not found.")

    try:
        dossier = regulatory_rag_service.evaluate_application(application_id, db=db)
        return ComplianceEvaluationResponse(
            application_id=dossier.application_id,
            evaluated_at=dossier.evaluated_at,
            overall_compliance_state=dossier.overall_compliance_state.value,
            compliance_score=dossier.compliance_score,
            total_evaluated_clauses=dossier.total_evaluated_clauses,
            explicitly_satisfied_count=dossier.explicitly_satisfied_count,
            apparently_violated_count=dossier.apparently_violated_count,
            ambiguous_count=dossier.ambiguous_count,
            outdated_source_count=dossier.outdated_source_count,
            needs_review_count=dossier.needs_review_count,
            findings=[
                {
                    "clause_number": f.clause_number,
                    "rule_title": f.rule_title,
                    "compliance_state": f.compliance_state.value,
                    "severity": f.severity,
                    "explanation": f.explanation,
                    "evidence_found": f.evidence_found,
                    "regulatory_source_ref": f.regulatory_source_ref,
                    "citation_verified": f.citation_verified,
                    "suggested_remediation": f.suggested_remediation
                }
                for f in dossier.findings
            ],
            regulatory_sources_used=dossier.regulatory_sources_used,
            disclaimer=dossier.disclaimer
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


@router.post("/query", response_model=RegulatoryQueryResponse)
def query_regulations_grounded(
    req: RegulatoryQueryRequest,
    db: Session = Depends(get_db)
):
    """
    Answers regulatory compliance queries strictly grounded in retrieved evidence.
    Validates all clause citations verbatim against indexed chunks to prevent AI hallucinations.
    """
    if not regulatory_rag_service.chunks_map or db.query(RegulatorySource).count() == 0:
        regulatory_rag_service.initialize_default_sources(db=db)

    result = regulatory_rag_service.query_regulations_grounded(
        query=req.query,
        top_k=req.top_k,
        language=req.language
    )

    retrieved_chunks = [
        RegulatoryChunkResponse(
            id=c.id,
            source_id="src-aicte-aph-2026",
            chapter="Regulatory Norms",
            section=c.clause_number,
            clause_number=c.clause_number,
            page_number=c.page_number,
            title=c.title,
            content=c.content,
            token_count=len(c.content.split()),
            is_ambiguous=c.is_ambiguous,
            source_name=c.source_title,
            official_url=c.official_url
        )
        for c in regulatory_rag_service.search_regulations(req.query, top_k=req.top_k)
    ]

    return RegulatoryQueryResponse(
        query=result["query"],
        answer=result["answer"],
        citations=result["citations"],
        retrieved_chunks=retrieved_chunks,
        citation_verification=result["citation_verification"],
        vector_search_mode=result["vector_search_mode"]
    )


@router.get("/search")
def search_regulations_rag(query: str, top_k: int = 4):
    """
    Hybrid search combining FAISS dense vector retrieval and BM25 sparse keyword matching.
    """
    try:
        clauses = regulatory_rag_service.search_regulations(query, top_k=top_k)
        return {
            "query": query,
            "search_mode": "HYBRID_FAISS_BM25",
            "results": [
                {
                    "rule_code": c.clause_number,
                    "title": c.title,
                    "content": c.content,
                    "page_number": c.page_number,
                    "relevance_score": round(c.relevance_score, 4),
                    "source_title": c.source_title,
                    "official_url": c.official_url,
                    "is_ambiguous": c.is_ambiguous
                }
                for c in clauses
            ]
        }
    except Exception:
        # Fallback to prototype rag_service
        results = rag_service.search_regulations(query, top_k=top_k)
        return {
            "query": query,
            "search_mode": "LEGACY_BM25",
            "results": results
        }


