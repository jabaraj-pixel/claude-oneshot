"""Voice API schemas (Worker 1) — exact shapes from docs/API_CONTRACTS.md §3.

The HTTP contract is kept to the documented fields; richer dialogue details
(next action, session state, clarification) live in the internal
DialogueResponse used by the telephony/streaming layer.
"""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

from backend.app.schemas.shared import ConversationTurn


class VoiceTurnRequest(BaseModel):
    call_id: str = Field(..., min_length=1, description="Call/session identifier")
    audio_base64: Optional[str] = Field(
        default=None, description="Optional base64-encoded audio chunk (WAV/PCM)"
    )
    text_input: Optional[str] = Field(
        default=None, description="Recognised text (provider-independent dialogue)"
    )
    language_hint: Optional[Literal["ta", "en", "ta-en"]] = Field(
        default=None, description="Language hint from STT or client"
    )

    @model_validator(mode="after")
    def require_text_or_audio(self) -> "VoiceTurnRequest":
        if not (self.text_input and self.text_input.strip()) and not self.audio_base64:
            raise ValueError("Either text_input or audio_base64 must be provided")
        return self


class VoiceTurnResponse(BaseModel):
    turn: ConversationTurn
    suggested_actions: List[str] = Field(default_factory=list)
    response_audio_url: Optional[str] = None
    response_text: str
