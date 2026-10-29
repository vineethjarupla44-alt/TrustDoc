from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.models import User, Application, ChatMessage, ComplianceFinding
from backend.app.schemas.schemas import (
    ChatMessageCreate, ChatMessageResponse, SuggestedQuestionsResponse, SuggestedQuestionItem
)
from backend.app.services.copilot_service import copilot_service

router = APIRouter(prefix="/chat", tags=["Applicant Compliance Copilot"])


def _verify_application_access(app: Application, user: User) -> None:
    """
    Strict Multi-Tenant Authorization Guardrail:
    Applicants can only interact with applications belonging to their own institution.
    Reviewers, Auditors, and Admins have institutional review access.
    """
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found."
        )

    # Scrutiny roles have review clearance across assigned applications
    if user.role in ("REVIEWER", "AUDITOR", "ADMIN"):
        return

    # Institutional applicant multi-tenancy enforcement
    if user.role == "APPLICANT" and app.applicant_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not authorized to view or query another institution's compliance records."
        )


@router.post("/{application_id}", response_model=ChatMessageResponse)
def send_chat_message(
    application_id: str,
    chat_in: ChatMessageCreate,
    lang: str = Query("en", pattern="^(en|hi|te)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sends a query to the Applicant Compliance Copilot:
    - Explains requirements in plain language.
    - Cites verified regulatory clauses, pages, and official URLs.
    - Answers queries grounded in active application findings and document inventory.
    - Strictly blocks cross-tenant access, approval promises, and finding overrides.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    _verify_application_access(app, current_user)

    # 1. Persist applicant question
    user_msg = ChatMessage(
        application_id=application_id,
        user_id=current_user.id,
        sender="USER",
        message_text=chat_in.message.strip(),
        cited_rule_references=[]
    )
    db.add(user_msg)
    db.flush()

    # 2. Consult Compliance Copilot Service
    copilot_response = copilot_service.answer_copilot_query(
        application=app,
        user=current_user,
        query=chat_in.message.strip(),
        language=lang,
        db=db
    )

    # 3. Persist AI Advisor response with rich citations
    ai_msg = ChatMessage(
        application_id=application_id,
        user_id=None,
        sender="AI_ADVISOR",
        message_text=copilot_response["answer"],
        cited_rule_references=copilot_response.get("citations", [])
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)

    return ai_msg


@router.get("/{application_id}/history", response_model=List[ChatMessageResponse])
def get_chat_history(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves chronological conversation history with multi-tenant privacy enforcement."""
    app = db.query(Application).filter(Application.id == application_id).first()
    _verify_application_access(app, current_user)

    messages = db.query(ChatMessage).filter(
        ChatMessage.application_id == application_id
    ).order_by(ChatMessage.timestamp.asc()).all()

    return messages


@router.get("/{application_id}/suggested-questions", response_model=SuggestedQuestionsResponse)
def get_suggested_questions(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns dynamic suggested questions tailored to the application's actual findings,
    missing documents, and extraction uncertainties.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    _verify_application_access(app, current_user)

    suggestions_raw = copilot_service.generate_suggested_questions(app, db)
    items = [
        SuggestedQuestionItem(
            category=s["category"],
            prompt=s["prompt"],
            label=s["label"],
            rule_code=s.get("rule_code")
        )
        for s in suggestions_raw
    ]

    return SuggestedQuestionsResponse(
        application_id=application_id,
        suggested_questions=items
    )


@router.delete("/{application_id}/history")
def clear_chat_history(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clears conversation history for the current application."""
    app = db.query(Application).filter(Application.id == application_id).first()
    _verify_application_access(app, current_user)

    db.query(ChatMessage).filter(ChatMessage.application_id == application_id).delete()
    db.commit()

    return {"message": "Chat history cleared successfully.", "application_id": application_id}
