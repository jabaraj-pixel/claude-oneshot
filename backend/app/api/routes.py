from fastapi import APIRouter
from backend.app.api.health import router as health_router

api_router = APIRouter()

# Core health routes
api_router.include_router(health_router, prefix="", tags=["Health"])

# Modular router mount points for workers:
# Worker 1 (worker/voice-telephony):
#   - api_router.include_router(telephony_router, prefix="/telephony", tags=["Telephony"])
#   - api_router.include_router(voice_router, prefix="/voice", tags=["Voice AI"])
# Worker 2 (worker/mobility-backend):
#   - api_router.include_router(mobility_router, prefix="/mobility", tags=["Mobility"])
# Worker 3 (worker/frontend-messaging):
#   - api_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
#   - api_router.include_router(messaging_router, prefix="/messages", tags=["Messaging"])
#   - api_router.include_router(complaints_router, prefix="/complaints", tags=["Complaints"])

