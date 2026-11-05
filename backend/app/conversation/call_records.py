"""Call record keeping (Worker 1).

Records call start/end/status and a concise interaction summary using the
shared ``CallSession`` schema. Process-local in-memory implementation; the
telephony layer and the dialogue manager share one instance. A durable store
can be introduced later behind this interface by the Integration Lead.
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional

from backend.app.schemas.shared import CallSession

UNKNOWN_CALLER = "unknown"


class CallRecordStore:
    """In-memory registry of CallSession records (shared schema, no redefinition)."""

    def __init__(self) -> None:
        self._sessions: Dict[str, CallSession] = {}
        self._processed_events: set = set()

    def ensure_session(
        self,
        call_id: str,
        caller_phone: str = UNKNOWN_CALLER,
        language: str = "ta",
        metadata: Optional[dict] = None,
    ) -> CallSession:
        session = self._sessions.get(call_id)
        if session is None:
            session = CallSession(
                call_id=call_id,
                caller_phone=caller_phone or UNKNOWN_CALLER,
                start_time=datetime.now(timezone.utc),
                language=language,
                status="active",
                metadata=metadata or {},
            )
            self._sessions[call_id] = session
        return session

    def get(self, call_id: str) -> Optional[CallSession]:
        return self._sessions.get(call_id)

    def list_sessions(self, limit: int = 50, offset: int = 0) -> List[CallSession]:
        ordered = sorted(
            self._sessions.values(), key=lambda s: s.start_time, reverse=True
        )
        return ordered[offset : offset + limit]

    def update_summary(self, call_id: str, summary: str, language: Optional[str] = None) -> None:
        session = self._sessions.get(call_id)
        if session is not None:
            session.summary = summary
            if language:
                session.language = language

    def set_consent(self, call_id: str, granted: bool, channel: Optional[str] = None) -> None:
        session = self._sessions.get(call_id)
        if session is not None:
            session.metadata["summary_consent_granted"] = granted
            if channel:
                session.metadata["summary_channel"] = channel

    def attach_message_handoff(self, call_id: str, handoff: dict) -> None:
        """Store the consented MessageRequest for the shared messaging boundary.

        Worker 3's messaging service picks this up; the voice module never
        dispatches messages itself.
        """
        session = self._sessions.get(call_id)
        if session is not None:
            session.metadata["message_handoff"] = handoff

    def complete(
        self,
        call_id: str,
        duration_seconds: Optional[int] = None,
        termination_reason: Optional[str] = None,
        recording_url: Optional[str] = None,
        status: str = "completed",
    ) -> Optional[CallSession]:
        session = self._sessions.get(call_id)
        if session is None:
            return None
        if session.status in ("completed", "dropped", "failed"):
            # Idempotent: a repeated completion event must not distort records.
            return session
        end_time = datetime.now(timezone.utc)
        session.end_time = end_time
        session.status = status
        if duration_seconds is not None:
            session.duration_seconds = duration_seconds
        else:
            session.duration_seconds = max(
                0, int((end_time - session.start_time).total_seconds())
            )
        if termination_reason:
            session.metadata["termination_reason"] = termination_reason
        if recording_url:
            session.metadata["recording_url"] = recording_url
        return session

    # -- Provider event deduplication -------------------------------------
    def mark_event_processed(self, event_key: str) -> bool:
        """Return True if this event is new; False if it was already processed."""
        if event_key in self._processed_events:
            return False
        self._processed_events.add(event_key)
        return True

    def clear(self) -> None:
        self._sessions.clear()
        self._processed_events.clear()
