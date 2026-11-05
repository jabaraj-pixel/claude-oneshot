"""Voice/dialogue-specific schemas (Worker 1 ownership: worker/voice-telephony).

These models are internal to the Voice AI module. Shared cross-module contracts
remain in backend/app/schemas/shared.py (Integration Lead ownership) and are
reused here, never redefined.
"""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from backend.app.schemas.shared import ConversationTurn, MessageRequest

DialogueStatus = Literal[
    "collecting",
    "confirming_route",
    "clarifying_stop",
    "search_failed",
    "result_presented",
    "awaiting_summary_channel",
    "awaiting_consent",
    "ended",
]

NextAction = Literal[
    "await_caller_input",
    "request_clarification",
    "confirm_route",
    "execute_mobility_search",
    "offer_message_summary",
    "await_consent",
    "handoff_message_to_messaging",
    "end_call",
]


class ClarificationRequest(BaseModel):
    """A structured clarification question posed to the caller."""

    slot: Literal["origin", "destination", "route", "summary_channel", "consent"] = Field(
        ..., description="Which piece of information needs clarification"
    )
    question: str = Field(..., description="Spoken clarification question")
    candidates: List[str] = Field(
        default_factory=list,
        description="Candidate stop names when disambiguating (empty otherwise)",
    )


class DialogueStateSnapshot(BaseModel):
    """Serializable view of the multi-turn dialogue state for a call."""

    call_id: str
    status: DialogueStatus
    language: str = Field(default="ta", description="Session language (ta, en, ta-en)")
    origin: Optional[str] = None
    destination: Optional[str] = None
    preferred_mode: Literal["all", "bus", "metro", "suburban_train"] = "all"
    pending_slot: Optional[Literal["origin", "destination"]] = None
    unclear_attempts: int = 0
    route_found: Optional[bool] = None
    summary_channel: Optional[Literal["whatsapp", "sms"]] = None
    consent_granted: bool = False
    consent_declined: bool = False


class DialogueResponse(BaseModel):
    """Provider-independent dialogue output for one caller turn.

    Matches the Module 1 handover contract: response text, response language,
    next action, session state and any clarification request.
    """

    call_id: str
    response_text: str = Field(..., description="Text to be spoken to the caller")
    response_language: str = Field(..., description="Language of response_text")
    next_action: NextAction
    suggested_actions: List[str] = Field(
        default_factory=list,
        description="Machine-readable actions performed/suggested this turn",
    )
    session_state: DialogueStateSnapshot
    clarification: Optional[ClarificationRequest] = None
    turn: ConversationTurn = Field(..., description="The recorded caller turn")
    message_handoff: Optional[MessageRequest] = Field(
        default=None,
        description=(
            "Consented summary request for the shared messaging boundary. "
            "The voice module NEVER dispatches messages itself."
        ),
    )
