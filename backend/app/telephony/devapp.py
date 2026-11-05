"""Worker 1 development harness — NOT the production app entrypoint.

The authoritative contract places telephony at root /telephony/*, which
requires a mount in backend/app/main.py (Integration Lead owned — see the
required diff in backend/app/conversation/README.md). Until that lands, this
harness builds a fresh application via the shared factory and adds the
telephony router, without editing any shared file:

    uvicorn backend.app.telephony.devapp:app --host 0.0.0.0 --port 8000

Exposes: /health, /api/voice/turn, /telephony/inbound,
/telephony/call-completed, WS /telephony/audio/{call_id}.
"""
from fastapi.responses import RedirectResponse

from backend.app.main import create_application
from backend.app.telephony.api import router as telephony_router

app = create_application()
app.include_router(telephony_router, prefix="/telephony", tags=["Telephony"])


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    """Land the browser preview on the interactive API docs."""
    return RedirectResponse(url="/docs")
