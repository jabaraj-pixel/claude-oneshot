from fastapi import APIRouter
from backend.app.api.health import router as health_router
from backend.app.voice.api import router as voice_router

api_router = APIRouter()

# Core health routes
api_router.include_router(health_router, prefix="", tags=["Health"])

# Modular router mount points for workers:
# Worker 1 (worker/voice-telephony):
#   Telephony is ROOT-level (/telephony/*) per docs/API_CONTRACTS.md and must be
#   mounted in main.py by the Integration Lead (diff documented in
#   backend/app/conversation/README.md; dev harness: telephony/devapp.py).
api_router.include_router(voice_router, prefix="/voice", tags=["Voice AI"])
# Worker 2 (worker/mobility-backend):
#   - api_router.include_router(mobility_router, prefix="/mobility", tags=["Mobility"])
# Worker 3 (worker/frontend-messaging):
#   - api_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
#   - api_router.include_router(messaging_router, prefix="/messages", tags=["Messaging"])
#   - api_router.include_router(complaints_router, prefix="/complaints", tags=["Complaints"])

