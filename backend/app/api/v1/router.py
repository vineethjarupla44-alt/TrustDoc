from fastapi import APIRouter
from backend.app.api.v1.endpoints import (
    auth, applications, documents, validation, chat, reviewer, reports, demo, regulations, audit, admin, registrations
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(applications.router)
api_router.include_router(documents.router)
api_router.include_router(validation.router)
api_router.include_router(chat.router)
api_router.include_router(reviewer.router)
api_router.include_router(admin.router)
api_router.include_router(reports.router)
api_router.include_router(demo.router)
api_router.include_router(regulations.router)
api_router.include_router(audit.router)
api_router.include_router(registrations.router)


