"""Telephony API schemas (Worker 1) — docs/API_CONTRACTS.md §4-6."""
from typing import Optional

from pydantic import BaseModel, Field

from backend.app.schemas.shared import CallSession


class CallCompletedRequest(BaseModel):
    call_id: str = Field(..., min_length=1)
    duration_seconds: Optional[int] = Field(default=None, ge=0)
    termination_reason: Optional[str] = None
    recording_url: Optional[str] = None


class CallCompletedResponse(BaseModel):
    status: str = "recorded"
    session: CallSession
