import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.core.database import Base, engine, SessionLocal, ensure_db_schema
from backend.app.core.masking import SensitiveContentLogFilter
from backend.app.api.v1.router import api_router
from backend.app.models.models import User, ValidationRule, RuleVersion, InstitutionRegistration
from backend.app.core.security import get_password_hash

# Attach zero-knowledge privacy filter to loggers
privacy_filter = SensitiveContentLogFilter()
logging.getLogger().addFilter(privacy_filter)
logging.getLogger("uvicorn.access").addFilter(privacy_filter)
logging.getLogger("uvicorn.error").addFilter(privacy_filter)

# Create tables and execute dynamic schema updates
Base.metadata.create_all(bind=engine)
ensure_db_schema()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure default demo accounts and regulatory rules exist
    db = SessionLocal()
    try:
        reviewer = db.query(User).filter(User.email == "reviewer@aicte.gov.in").first()
        if not reviewer:
            reviewer = User(
                email="reviewer@aicte.gov.in",
                password_hash=get_password_hash("reviewer123"),
                full_name="Dr. Arvind Sharma (Senior Scrutiny Officer)",
                role="REVIEWER",
                institution_name="Regulatory Council Scrutiny Cell",
                employee_id="AICTE-SCR-8491",
                department="Central Scrutiny Cell",
                designation="Senior Scrutiny Officer",
                approval_status="APPROVED",
                is_active=True
            )
            db.add(reviewer)
        else:
            if not reviewer.employee_id:
                reviewer.employee_id = "AICTE-SCR-8491"
            if not reviewer.approval_status:
                reviewer.approval_status = "APPROVED"
            reviewer.is_active = True

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
            db.flush()

        # Seed Apex Institute of Technology permanent registration if not present
        if applicant:
            existing_reg = db.query(InstitutionRegistration).filter(
                InstitutionRegistration.applicant_user_id == applicant.id
            ).first()
            if not existing_reg:
                from datetime import datetime, timezone, timedelta
                now = datetime.now(timezone.utc)
                apex_reg = InstitutionRegistration(
                    institution_code="AICTE-1-439877261",
                    registration_number="1-439877261",
                    institution_name="Apex Institute of Technology",
                    applicant_user_id=applicant.id,
                    institution_type="Private / Self-Financed",
                    affiliation_university="Delhi Technological University (DTU)",
                    state="Delhi",
                    district="New Delhi",
                    address="Plot No. 12, Institutional Area, Sector 62, New Delhi - 110001",
                    contact_email="principal@apex.edu",
                    contact_phone="+91-11-28945601",
                    head_of_institution="Dr. K. S. Ramanujam (Principal)",
                    valid_from=now - timedelta(days=365 * 3 - 30),
                    valid_upto=now + timedelta(days=30),  # In Renewal Due window
                    status="ACTIVE",
                    is_autonomous=False,
                    accreditation_grade="NAAC A+"
                )
                db.add(apex_reg)

        auditor = db.query(User).filter(User.email == "auditor@cag.gov.in").first()
        if not auditor:
            auditor = User(
                email="auditor@cag.gov.in",
                password_hash=get_password_hash("auditor123"),
                full_name="Ms. Priyadarshini Rao (Statutory Vigilance Auditor)",
                role="AUDITOR",
                institution_name="Institutional Compliance Audit Cell"
            )
            db.add(auditor)

        admin = db.query(User).filter(User.email == "admin@aicte.gov.in").first()
        if not admin:
            admin = User(
                email="admin@aicte.gov.in",
                password_hash=get_password_hash("admin123"),
                full_name="System Administrator (TrustDoc Core)",
                role="ADMIN",
                institution_name="Technical Education Regulatory Council"
            )
            db.add(admin)

        # Seed Validation Rules if table is empty
        if db.query(ValidationRule).count() == 0:
            from backend.app.api.v1.endpoints.regulations import SYNTHETIC_RULES
            for r in SYNTHETIC_RULES:
                cat = "REGULATORY"
                if "Forensic" in r.get("title", "") or "6." in r.get("rule_code", ""):
                    cat = "AUTHENTICITY"
                elif "Cross" in r.get("title", "") or "5." in r.get("rule_code", ""):
                    cat = "COMPLETENESS"

                val_rule = ValidationRule(
                    rule_code=r["rule_code"],
                    category=cat,
                    title=r["title"],
                    description=r["description"],
                    default_severity=r.get("severity", "CRITICAL"),
                    authority="AICTE / Statutory Regulatory Council",
                    is_active=True
                )
                db.add(val_rule)
                db.flush()

                rule_ver = RuleVersion(
                    rule_id=val_rule.id,
                    version_tag="v2026.1",
                    parameters_json={"threshold": r.get("threshold", "Mandatory")},
                    logic_handler=f"eval_{r['rule_code'].replace('-', '_').lower()}"
                )
                db.add(rule_ver)

        db.commit()
    finally:
        db.close()

    yield


app = FastAPI(
    title="TrustDoc Backend",
    description="TrustDoc AI-Powered Institutional Application Validation & Regulatory Compliance",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "project": "TrustDoc",
        "project_id": "TRUSTDOC-2026",
        "status": "operational",
        "version": "2.0.0",
        "docs_url": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/api/health", tags=["health"])
def api_health():
    """Lightweight service health check for frontend and infrastructure probes."""
    return {"status": "healthy"}
