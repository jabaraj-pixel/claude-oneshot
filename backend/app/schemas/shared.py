from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class DataFreshness(BaseModel):
    """Metadata regarding data source and last update."""
    source: str = Field(..., description="Data source name (e.g. MTC GTFS, CMRL Metro, Southern Railway)")
    last_updated: datetime = Field(..., description="Timestamp when schedule data was verified or refreshed")
    is_live: bool = Field(default=False, description="Whether this information represents real-time vehicle positions")
    notes: Optional[str] = Field(None, description="Freshness notes or known limitations")


class CallSession(BaseModel):
    """Telephone call session data model."""
    call_id: str = Field(..., description="Unique call identifier from telephony provider or system")
    caller_phone: str = Field(..., description="E.164 phone number of the caller")
    start_time: datetime = Field(..., description="Call initiation timestamp")
    end_time: Optional[datetime] = Field(None, description="Call completion timestamp")
    duration_seconds: Optional[int] = Field(None, description="Total call duration in seconds")
    language: str = Field(default="ta", description="Detected/selected primary language (ta, en, ta-en)")
    status: Literal["active", "completed", "dropped", "failed"] = Field(
        default="active", description="Lifecycle status of the call"
    )
    summary: Optional[str] = Field(None, description="Brief AI-generated journey query summary")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Telephony provider raw metadata")


class ConversationTurn(BaseModel):
    """Single conversational turn between caller and AI assistant."""
    turn_id: str = Field(..., description="Unique turn identifier")
    call_id: str = Field(..., description="Associated call session ID")
    turn_index: int = Field(..., ge=0, description="Sequential turn index within call")
    speaker: Literal["caller", "assistant", "system"] = Field(..., description="Source of the utterance")
    language: str = Field(default="ta", description="Detected language of this turn")
    transcript_raw: str = Field(..., description="Original STT or spoken text")
    transcript_translated: Optional[str] = Field(None, description="English normalized transcript if applicable")
    intent: Optional[str] = Field(None, description="Classified caller intent (e.g. route_query, complaint, greeting)")
    audio_url: Optional[str] = Field(None, description="Storage URL for turn audio if recorded")
    latency_ms: Optional[float] = Field(None, description="Round-trip response latency in milliseconds")
    timestamp: datetime = Field(..., description="Timestamp of turn occurrence")


class JourneyRequest(BaseModel):
    """Origin-destination mobility route inquiry."""
    origin: str = Field(..., min_length=2, description="Origin stop, locality, or landmark in Chennai")
    destination: str = Field(..., min_length=2, description="Destination stop, locality, or landmark in Chennai")
    departure_time: Optional[datetime] = Field(None, description="Requested departure time (defaults to current time)")
    language: str = Field(default="ta", description="Preferred response language")
    max_transfers: Optional[int] = Field(default=2, ge=0, le=4, description="Maximum allowed transfers")
    preferred_mode: Literal["all", "bus", "metro", "suburban_train"] = Field(
        default="all", description="Preferred public transit mode"
    )


class RouteOption(BaseModel):
    """A single verified route choice."""
    option_id: str = Field(..., description="Unique route candidate ID")
    mode: Literal["bus", "metro", "suburban_train", "multimodal"] = Field(..., description="Transit mode")
    route_numbers: List[str] = Field(..., description="Bus or line numbers (e.g. ['29C'], ['Blue Line'])")
    origin_stop: str = Field(..., description="Boarding stop name")
    destination_stop: str = Field(..., description="Alighting stop name")
    transfers: int = Field(default=0, ge=0, description="Number of transfers required")
    estimated_duration_minutes: int = Field(..., gt=0, description="Estimated transit duration in minutes")
    fare_estimate_inr: Optional[float] = Field(None, ge=0.0, description="Estimated fare in INR")
    instructions_tamil: str = Field(..., description="Step-by-step guidance in Tamil")
    instructions_english: str = Field(..., description="Step-by-step guidance in English")
    freshness: DataFreshness = Field(..., description="Data provenance and freshness information")


class JourneyResult(BaseModel):
    """Complete route guidance response."""
    query: JourneyRequest = Field(..., description="Original query parameters")
    found: bool = Field(..., description="Whether viable transit routes were identified")
    options: List[RouteOption] = Field(default_factory=list, description="List of recommended route options")
    spoken_summary_ta: str = Field(..., description="Concise conversational Tamil script for TTS playback")
    spoken_summary_en: str = Field(..., description="Concise conversational English script for reference")
    disclaimer: str = Field(
        default="Schedules based on static transit feeds. Real-time conditions may vary.",
        description="Public transit operational disclaimer",
    )


class MessageRequest(BaseModel):
    """Post-call journey summary dispatch request."""
    recipient_phone: str = Field(..., description="Caller phone number in E.164 format")
    channel: Literal["whatsapp", "sms"] = Field(..., description="Messaging delivery channel")
    template_name: Optional[str] = Field(None, description="Provider template identifier")
    body: str = Field(..., min_length=1, description="Message text content")
    call_id: Optional[str] = Field(None, description="Associated call session ID")
    user_consent_granted: bool = Field(
        ...,
        description="CRITICAL: Explicit passenger consent must be granted during the call before dispatch",
    )

    @field_validator("user_consent_granted")
    @classmethod
    def validate_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Message dispatch requires explicit caller consent (user_consent_granted=True)")
        return v


class MessageStatus(BaseModel):
    """Delivery status of a dispatched message."""
    message_id: str = Field(..., description="System message tracking identifier")
    recipient_phone: str = Field(..., description="Recipient phone number")
    channel: Literal["whatsapp", "sms"] = Field(..., description="Channel used")
    status: Literal["queued", "sent", "delivered", "failed", "rejected_no_consent"] = Field(
        ..., description="Delivery lifecycle status"
    )
    error_reason: Optional[str] = Field(None, description="Failure reason if delivery was not successful")
    sent_at: Optional[datetime] = Field(None, description="Dispatch timestamp")


class ComplaintRecord(BaseModel):
    """Passenger complaint record."""
    complaint_id: str = Field(..., description="Unique complaint tracking ID")
    caller_phone: str = Field(..., description="Caller phone number")
    category: Literal[
        "bus_delay",
        "crew_behavior",
        "overcrowding",
        "infrastructure",
        "safety",
        "other",
    ] = Field(..., description="Complaint category")
    description: str = Field(..., min_length=5, description="Complaint details provided by caller")
    route_number: Optional[str] = Field(None, description="Relevant bus or transit route number")
    stop_name: Optional[str] = Field(None, description="Transit stop or location of incident")
    logged_at: datetime = Field(..., description="Timestamp when complaint was recorded")
    status: Literal["recorded", "pending_review", "forwarded", "resolved"] = Field(
        default="recorded", description="Workflow status"
    )
    official_submission_confirmed: bool = Field(
        default=False,
        description="Must remain False until official authorized government/MTC API integration is established",
    )

