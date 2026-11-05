from datetime import datetime, timezone
import os
from fastapi import APIRouter, status
from backend.app.config import get_settings
from backend.app.database.session import check_db_health
from backend.app.schemas.common import HealthResponse

router = APIRouter(tags=["Health"])
settings = get_settings()


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Application Health Check",
    description="Returns the operational health of the application, database, and integration readiness.",
)
async def health_check() -> HealthResponse:
    db_health = check_db_health()

    integrations_status = {
        "sarvam_ai": bool(settings.SARVAM_API_KEY),
        "exotel_telephony": bool(settings.EXOTEL_ACCOUNT_SID and settings.EXOTEL_API_KEY),
        "whatsapp_messaging": bool(settings.WHATSAPP_API_TOKEN),
        "sms_gateway": bool(settings.SMS_PROVIDER_API_KEY),
        "gtfs_fixtures": os.path.exists(settings.GTFS_DATA_DIR),
    }

    # Determine overall status: ok if service is up.
    # Note: PostgreSQL is explicitly NOT mandatory for health checks during initial baseline.
    overall_status = "ok" if db_health.get("connected") else "ok_standalone"

    return HealthResponse(
        status=overall_status,
        timestamp=datetime.now(timezone.utc),
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        database=db_health,
        integrations=integrations_status,
    )

