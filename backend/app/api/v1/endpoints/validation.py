from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.models import (
    User, Application, Document, ExtractedEntities, DocumentForensics,
    ComplianceFinding, AssessmentSummary, ApplicationAuditLog
)
from backend.app.schemas.schemas import ComplianceFindingResponse, AssessmentSummaryResponse
from backend.app.services.cross_validator import CrossValidator
from backend.app.services.rules_engine import RulesEngine

router = APIRouter(prefix="/validation", tags=["Validation & Compliance"])

@router.post("/{application_id}/run", response_model=AssessmentSummaryResponse)
def run_validation_pipeline(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    # 1. Fetch all documents and extracted entities
    docs = db.query(Document).filter(Document.application_id == application_id).all()
    docs_dict = {}
    forensics_list = []

    for d in docs:
        fields = d.extracted_entities.structured_fields if d.extracted_entities else {}
        docs_dict[d.document_type] = {
            "doc_id": d.id,
            "fields": fields,
            "file_name": d.file_name
        }
    # 2. Extract forensics metadata
    for d in docs:
        if d.forensics:
            forensics_list.append({
                "doc_id": d.id,
                "file_name": d.file_name,
                "risk_level": d.forensics.risk_level,
                "ela_anomaly_score": d.forensics.ela_anomaly_score,
                "metadata_mismatch_flag": d.forensics.metadata_mismatch_flag,
                "remarks": d.forensics.remarks
            })

    # 3. Clear old findings for fresh deterministic evaluation
    db.query(ComplianceFinding).filter(ComplianceFinding.application_id == application_id).delete()

    # 4. Run Deterministic Validation Engine (7 Modules)
    from backend.app.services.validation_engine import ValidationEngine, ValidationStatus
    engine_result = ValidationEngine.evaluate(
        application=app,
        documents=docs,
        db=db,
        forensics_list=forensics_list
    )

    # 5. Persist Authenticity Forensics Findings if flagged
    for f in forensics_list:
        if f["risk_level"] in ("HIGH", "MEDIUM"):
            f_finding = ComplianceFinding(
                application_id=application_id,
                source_document_id=f["doc_id"],
                category="AUTHENTICITY",
                severity="CRITICAL" if f["risk_level"] == "HIGH" else "WARNING",
                rule_code="RULE-FOR-ELA-001",
                title=f"Forensic Noise Anomaly: {f['file_name']}",
                description=f["remarks"] or "Elevated pixel noise variance and/or editing software metadata detected.",
                evidence_quote=f"Risk Level: {f['risk_level']}, ELA Anomaly Score: {f['ela_anomaly_score']:.1f}",
                suggested_remediation="Upload the original unedited digital document directly from issuing authority.",
                status="OPEN",
                finding_status="FAIL",
                source_field_ref={"doc_id": f["doc_id"], "risk_level": f["risk_level"]}
            )
            db.add(f_finding)

    # 6. Persist 7-Module Validation Engine Findings
    for vf in engine_result["findings"]:
        # Persist non-PASS findings, or all findings
        finding = ComplianceFinding(
            application_id=application_id,
            source_document_id=vf.source_field_ref.get("doc_id") if vf.source_field_ref else None,
            category=vf.category.value,
            severity=vf.severity.value,
            rule_code=vf.rule_id,
            title=vf.rule_name,
            description=vf.explanation,
            evidence_quote=vf.evidence,
            suggested_remediation=vf.recommended_action,
            status="OPEN",
            finding_status=vf.status.value,
            source_field_ref=vf.source_field_ref,
            resolved_by_applicant=False
        )
        db.add(finding)

    # 7. Assessment Scorecard
    scorecard = engine_result["scorecard"]

    # 8. Save or Update AssessmentSummary
    summary = db.query(AssessmentSummary).filter(AssessmentSummary.application_id == application_id).first()
    if not summary:
        summary = AssessmentSummary(application_id=application_id)
        db.add(summary)

    summary.authenticity_score = scorecard["authenticity_score"]
    summary.completeness_score = scorecard["completeness_score"]
    summary.compliance_score = scorecard["compliance_score"]
    summary.composite_score = scorecard["composite_score"]
    summary.recommendation = scorecard["recommendation"]
    summary.evaluated_at = datetime.now(timezone.utc)

    # Update application status
    if scorecard["recommendation"] == "ELIGIBLE":
        app.status = "APPROVED"
    elif scorecard["recommendation"] == "REJECTED":
        app.status = "FLAGGED"
    else:
        app.status = "DEFICIENT"

    # Chained Audit event
    from backend.app.models.models import ApplicationAuditEvent
    from backend.app.api.v1.endpoints.audit import compute_event_hash

    last_event = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == application_id
    ).order_by(ApplicationAuditEvent.timestamp.desc()).first()
    prev_hash = last_event.event_hash if last_event else None

    audit_log = ApplicationAuditEvent(
        application_id=application_id,
        actor_id=current_user.id,
        actor_role=current_user.role,
        action="VALIDATION_RUN",
        ip_address="127.0.0.1",
        diff_payload={
            "composite_score": scorecard["composite_score"],
            "recommendation": scorecard["recommendation"],
            "total_findings": len(engine_result["findings"])
        },
        previous_event_hash=prev_hash
    )
    db.add(audit_log)
    db.flush()
    audit_log.event_hash = compute_event_hash(
        audit_log.id, audit_log.application_id, audit_log.action, audit_log.actor_id,
        audit_log.timestamp.isoformat(), audit_log.previous_event_hash
    )

    db.commit()
    db.refresh(summary)
    return summary

@router.get("/{application_id}/findings", response_model=list[ComplianceFindingResponse])
def get_application_findings(
    application_id: str,
    db: Session = Depends(get_db)
):
    findings = db.query(ComplianceFinding).filter(
        ComplianceFinding.application_id == application_id
    ).order_by(ComplianceFinding.created_at.asc()).all()
    return findings

@router.get("/{application_id}/scorecard", response_model=AssessmentSummaryResponse)
def get_application_scorecard(
    application_id: str,
    db: Session = Depends(get_db)
):
    summary = db.query(AssessmentSummary).filter(AssessmentSummary.application_id == application_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Scorecard not found. Run validation first.")
    return summary
