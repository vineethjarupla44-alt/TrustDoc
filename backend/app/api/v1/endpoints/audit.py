import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role
from backend.app.models.models import User, Application, ApplicationAuditEvent
from backend.app.schemas.schemas import AuditLogResponse, AuditChainVerificationResponse

from typing import Optional

router = APIRouter(prefix="/audit", tags=["Audit Trail & Chain Verification"])

def compute_event_hash(
    event_id: str,
    app_id: Optional[str] = None,
    action: Optional[str] = None,
    actor_id: Optional[str] = None,
    timestamp_iso: Optional[str] = None,
    prev_hash: Optional[str] = None
) -> str:
    """
    Computes a cryptographic SHA-256 event hash.
    Supports:
    1. Single-argument digest computation: compute_event_hash("payload_str")
    2. Chained audit event verification: compute_event_hash(id, app_id, action, actor_id, ts, prev_hash)
    """
    if app_id is None and action is None and timestamp_iso is None:
        return hashlib.sha256(event_id.encode("utf-8")).hexdigest()
    raw = f"{event_id}:{app_id or 'none'}:{action or 'none'}:{actor_id or 'none'}:{timestamp_iso or ''}:{prev_hash or 'genesis'}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

@router.get("/applications/{application_id}", response_model=list[AuditLogResponse])
def get_application_audit_trail(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["REVIEWER", "AUDITOR", "ADMIN"]))
):
    """Retrieve full audit log journal for an application."""
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    events = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == application_id
    ).order_by(ApplicationAuditEvent.timestamp.asc()).all()
    return events

@router.get("/applications/{application_id}/verify-chain", response_model=AuditChainVerificationResponse)
def verify_audit_chain_integrity(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["REVIEWER", "AUDITOR", "ADMIN"]))
):
    """
    Cryptographically verifies the SHA-256 tamper-evident hash chain of all audit events.
    Returns chain validity status, event count, and current head hash.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    events = db.query(ApplicationAuditEvent).filter(
        ApplicationAuditEvent.application_id == application_id
    ).order_by(ApplicationAuditEvent.timestamp.asc()).all()

    if not events:
        return {
            "chain_valid": True,
            "event_count": 0,
            "head_hash": None,
            "verified_at": datetime.now(timezone.utc)
        }

    chain_valid = True
    prev_hash = None

    for evt in events:
        expected_prev = prev_hash
        # If event has a recorded previous_event_hash, check consistency
        if evt.previous_event_hash and expected_prev and evt.previous_event_hash != expected_prev:
            chain_valid = False
            break

        # Compute hash
        ts_str = evt.timestamp.isoformat() if evt.timestamp else ""
        computed_hash = compute_event_hash(evt.id, evt.application_id, evt.action, evt.actor_id, ts_str, evt.previous_event_hash)
        
        # If event had an event_hash, verify it matches
        if evt.event_hash and evt.event_hash != computed_hash:
            chain_valid = False
            break

        prev_hash = evt.event_hash or computed_hash

    return {
        "chain_valid": chain_valid,
        "event_count": len(events),
        "head_hash": prev_hash,
        "verified_at": datetime.now(timezone.utc)
    }
