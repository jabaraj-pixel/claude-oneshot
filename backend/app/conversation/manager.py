"""Multi-turn dialogue manager (Worker 1).

Provider-independent conversation orchestration: accepts recognised text and
returns a structured DialogueResponse, so the full dialogue can be tested
without any telephony or speech credentials.

Safety rules (Module 1 handover + chennai_transport research package):
  * Never guess slots — ask for missing/ambiguous information.
  * Route results are spoken verbatim from the mobility engine's verified
    JourneyResult; this module never computes or invents routes.
  * Fares, live arrivals, exact timetables and accessibility are answered with
    honest UNKNOWN/static-only policies until verified sources are connected.
  * Written summaries require explicit spoken consent and are handed to the
    shared messaging boundary — never dispatched by this module.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
import re
import time
import uuid
from typing import Dict, List, Optional, Tuple

from backend.app.core.logging import logger
from backend.app.schemas.shared import ConversationTurn, JourneyRequest, JourneyResult, MessageRequest

from backend.app.conversation import nlu, responses
from backend.app.conversation.call_records import CallRecordStore, UNKNOWN_CALLER
from backend.app.conversation.mobility_client import (
    BaseMobilityClient,
    MobilityBadRequestError,
    MobilityBadResponseError,
    MobilityTimeoutError,
    MobilityUnavailableError,
    StopsLookupUnsupported,
    build_default_mobility_client,
)
from backend.app.conversation.schemas import (
    ClarificationRequest,
    DialogueResponse,
    DialogueStateSnapshot,
)
from backend.app.conversation.session import BaseConversationStore, InMemoryConversationStore

MAX_UNCLEAR_ATTEMPTS = 3
MAX_CLARIFY_ATTEMPTS = 2
MAX_CLARIFY_CANDIDATES = 3


@dataclass
class _SessionState:
    call_id: str
    language: str = "ta"
    status: str = "collecting"
    started: bool = False
    origin: Optional[str] = None
    destination: Optional[str] = None
    canonical_origin: Optional[str] = None
    canonical_destination: Optional[str] = None
    preferred_mode: str = "all"
    pending_slot: Optional[str] = None
    awaiting_role_for: Optional[str] = None
    needs_confirmation: bool = False
    clarify_slot: Optional[str] = None
    clarify_query: str = ""
    clarify_candidates: List[dict] = field(default_factory=list)
    clarify_attempts: int = 0
    unclear_attempts: int = 0
    last_journey: Optional[JourneyResult] = None
    last_search_failed: bool = False
    summary_channel: Optional[str] = None
    consent_granted: bool = False
    consent_declined: bool = False
    message_handoff: Optional[MessageRequest] = None
    last_response_text: str = ""
    turn_count: int = 0


@dataclass
class _Reply:
    text: str
    next_action: str = "await_caller_input"
    suggested_actions: List[str] = field(default_factory=list)
    clarification: Optional[ClarificationRequest] = None
    unclear: bool = False


_ORDINALS = {
    0: {"1", "first", "one", "first one", "option 1", "number 1", "onnu", "ondhu", "முதல்", "முதலாவது", "ஒன்று", "1வது"},
    1: {"2", "second", "two", "second one", "option 2", "number 2", "rendu", "ரெண்டு", "இரண்டு", "ரெண்டாவது", "இரண்டாவது", "2வது"},
    2: {"3", "third", "three", "third one", "option 3", "number 3", "moonu", "மூன்று", "மூன்றாவது", "3வது"},
}
_ORIGIN_ROLE = re.compile(
    r"\b(origin|start|starting|from|beginning)\b|புறப்படும்|கிளம்பும்|இருந்து|ஆரம்ப", re.IGNORECASE
)
_DEST_ROLE = re.compile(
    r"\b(destination|going|to|end|reach)\b|சேரும்|செல்ல|போக வேண்டிய|போகவேண்டிய", re.IGNORECASE
)
_QUESTION_WORDS = re.compile(
    r"\b(what|why|how|when|which|who)\b|என்ன|எப்படி|எப்போது|ஏன்|enna|epdi|eppo", re.IGNORECASE
)
_FILLER_TOKENS = {
    "mm", "mmm", "hmm", "hmmm", "hm", "uh", "um", "ah", "oh", "er", "ahh",
    "ok", "okay", "haan", "han", "huh", "achha", "accha", "hmmmm",
}


def _looks_like_place(text: str) -> bool:
    cleaned = text.strip(" \t,.?!\"'")
    if not cleaned or len(cleaned) < 2:
        return False
    if "?" in text or _QUESTION_WORDS.search(cleaned):
        return False
    tokens = cleaned.lower().split()
    if all(token in _FILLER_TOKENS for token in tokens):
        return False
    if cleaned.isdigit():
        return False
    return len(tokens) <= 5


def _response_language(session_language: str) -> str:
    return session_language if session_language in ("ta", "en", "ta-en") else "ta"


class ConversationManager:
    """Text-in / text-out dialogue orchestration for one deployment.

    Holds per-call session state in memory; call records and turn history are
    kept in the injected stores (shared CallSession / ConversationTurn schemas).
    """

    def __init__(
        self,
        mobility_client: Optional[BaseMobilityClient] = None,
        store: Optional[BaseConversationStore] = None,
        call_records: Optional[CallRecordStore] = None,
        max_unclear_attempts: int = MAX_UNCLEAR_ATTEMPTS,
        max_clarify_attempts: int = MAX_CLARIFY_ATTEMPTS,
    ) -> None:
        self.mobility = mobility_client if mobility_client is not None else build_default_mobility_client()
        self.store = store if store is not None else InMemoryConversationStore()
        self.call_records = call_records if call_records is not None else CallRecordStore()
        self.max_unclear_attempts = max_unclear_attempts
        self.max_clarify_attempts = max_clarify_attempts
        self._sessions: Dict[str, _SessionState] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def get_state(self, call_id: str) -> Optional[DialogueStateSnapshot]:
        state = self._sessions.get(call_id)
        return self._snapshot(state) if state else None

    def end_session(self, call_id: str, reason: str = "caller_hangup") -> None:
        """Externally terminate a call (e.g. telephony stop/completion event).

        Completes the call record even when no dialogue turn ever happened
        (caller hung up before speaking). Idempotent via CallRecordStore.
        """
        state = self._sessions.get(call_id)
        if state is not None and state.status != "ended":
            state.status = "ended"
            self._sync_call_summary(state)
        self.call_records.complete(call_id, termination_reason=reason)

    async def process_turn(
        self,
        call_id: str,
        text: str,
        language_hint: Optional[str] = None,
        event_timestamp: Optional[datetime] = None,
    ) -> DialogueResponse:
        started = time.perf_counter()
        state = self._sessions.get(call_id)
        if state is None:
            state = _SessionState(call_id=call_id, language=language_hint or "ta")
            self._sessions[call_id] = state
        self.call_records.ensure_session(call_id, language=state.language)

        extraction = nlu.extract(text or "", language_hint)
        if (text or "").strip():
            state.language = extraction.language

        caller_turn = ConversationTurn(
            turn_id=f"turn-{uuid.uuid4().hex[:12]}",
            call_id=call_id,
            turn_index=self._next_turn_index(call_id),
            speaker="caller",
            language=extraction.language,
            transcript_raw=text or "",
            intent=extraction.intent,
            timestamp=event_timestamp or datetime.now(timezone.utc),
        )
        await self.store.add_turn(caller_turn)

        if state.status == "ended":
            reply = _Reply(responses.render("goodbye", state.language), next_action="end_call")
        else:
            reply = await self._dispatch(state, extraction, text or "")
            state.started = True
            if not reply.unclear:
                state.unclear_attempts = 0

        state.last_response_text = reply.text
        response_language = _response_language(state.language)

        assistant_turn = ConversationTurn(
            turn_id=f"turn-{uuid.uuid4().hex[:12]}",
            call_id=call_id,
            turn_index=self._next_turn_index(call_id),
            speaker="assistant",
            language=response_language,
            transcript_raw=reply.text,
            timestamp=datetime.now(timezone.utc),
        )
        await self.store.add_turn(assistant_turn)
        self._sync_call_summary(state)

        caller_turn.latency_ms = round((time.perf_counter() - started) * 1000, 2)

        return DialogueResponse(
            call_id=call_id,
            response_text=reply.text,
            response_language=response_language,
            next_action=reply.next_action,
            suggested_actions=reply.suggested_actions,
            session_state=self._snapshot(state),
            clarification=reply.clarification,
            turn=caller_turn,
            message_handoff=state.message_handoff if reply.next_action == "handoff_message_to_messaging" else None,
        )

    # ------------------------------------------------------------------
    # Dispatch
    # ------------------------------------------------------------------
    async def _dispatch(self, state: _SessionState, ex: nlu.ExtractionResult, text: str) -> _Reply:
        intent = ex.intent

        # -- Global intents -------------------------------------------
        if intent == "end_call":
            return self._end(state, reason="caller_hangup")
        if intent == "repeat_request":
            if state.last_response_text:
                return _Reply(state.last_response_text)
            return _Reply(responses.render("repeat_unavailable", state.language))
        if intent == "help":
            return _Reply(responses.render("help", state.language), suggested_actions=["provide_help"])
        if intent == "complaint":
            return _Reply(responses.render("complaint_redirect", state.language))
        if intent == "lost_property":
            return _Reply(responses.render("lost_property_redirect", state.language))
        if intent == "accessibility_query":
            return _Reply(responses.render("accessibility_unknown", state.language))
        if intent == "fare_query":
            self._absorb_slots(state, ex)
            return _Reply(responses.render("fare_unknown", state.language))
        if intent == "live_arrival_query":
            return self._live_answer(state)
        if intent == "schedule_query":
            self._absorb_slots(state, ex)
            reply_text = responses.render("schedule_static_only", state.language)
            if state.origin and state.destination:
                search = await self._resolve_and_search(state)
                return _Reply(reply_text + " " + search.text, search.next_action, search.suggested_actions)
            return _Reply(reply_text)
        if intent == "nearest_stop":
            state.pending_slot = "origin"
            return _Reply(
                responses.render("nearest_stop_ask", state.language),
                next_action="request_clarification",
                clarification=ClarificationRequest(
                    slot="origin", question=responses.render("nearest_stop_ask", state.language)
                ),
            )
        if intent == "request_summary":
            return await self._start_summary_flow(state, ex.channel)
        if intent == "retry_request":
            if state.last_search_failed and state.origin and state.destination:
                return await self._resolve_and_search(state)
            return _Reply(responses.render("nothing_to_retry", state.language))
        if intent == "alternate_route":
            self._absorb_slots(state, ex, reset_journey=True)
            if state.origin and state.destination:
                return await self._resolve_and_search(state)
            return self._ask_missing(state)

        # -- Yes/no in confirmation states -----------------------------
        if state.status == "confirming_route":
            if intent == "confirm_yes":
                state.needs_confirmation = False
                return await self._resolve_and_search(state)
            if intent == "confirm_no":
                state.status = "collecting"
                state.origin = None
                state.canonical_origin = None
                state.pending_slot = "origin"
                return _Reply(
                    responses.render("which_part_wrong", state.language),
                    next_action="request_clarification",
                    clarification=ClarificationRequest(
                        slot="origin", question=responses.render("which_part_wrong", state.language)
                    ),
                )
        if state.status == "awaiting_summary_channel":
            if ex.channel:
                state.summary_channel = ex.channel
                return self._ask_consent(state)
            if intent == "confirm_no":
                return self._decline_summary(state)
            return self._unclear(state)
        if state.status == "awaiting_consent":
            if intent == "confirm_yes":
                return self._grant_consent(state)
            if intent == "confirm_no":
                return self._decline_summary(state)
            if ex.channel:
                state.summary_channel = ex.channel
                return self._ask_consent(state)
            # Never interpret anything else as consent.
            return self._unclear(state)

        # -- Stop disambiguation ---------------------------------------
        if state.status == "clarifying_stop":
            handled = await self._handle_clarification(state, ex, text)
            if handled is not None:
                return handled

        # -- Corrections ------------------------------------------------
        if intent == "correct_origin" and ex.origin:
            state.origin = ex.origin
            state.canonical_origin = None
            state.needs_confirmation = False
            return await self._after_slot_update(
                state, prefix=responses.render("slot_updated", state.language, slot=responses.render("origin_word", state.language), value=ex.origin) + " "
            )
        if intent == "correct_destination" and ex.destination:
            state.destination = ex.destination
            state.canonical_destination = None
            state.needs_confirmation = False
            return await self._after_slot_update(
                state, prefix=responses.render("slot_updated", state.language, slot=responses.render("destination_word", state.language), value=ex.destination) + " "
            )

        # -- Explicit partial slots --------------------------------------
        if intent == "provide_origin" and ex.origin:
            state.origin = ex.origin
            state.canonical_origin = None
            state.pending_slot = None
            return await self._after_slot_update(state)
        if intent == "provide_destination" and ex.destination:
            state.destination = ex.destination
            state.canonical_destination = None
            state.pending_slot = None
            return await self._after_slot_update(state)

        # -- Full route query ---------------------------------------------
        if intent == "route_query":
            if ex.origin and ex.destination:
                self._reset_journey(state)
                state.origin = ex.origin
                state.destination = ex.destination
                state.canonical_origin = None
                state.canonical_destination = None
                state.needs_confirmation = ex.confidence == "low"
                state.pending_slot = None
                if ex.preferred_mode:
                    state.preferred_mode = ex.preferred_mode
                if state.needs_confirmation:
                    state.status = "confirming_route"
                    question = responses.render("confirm_route", state.language, origin=state.origin, destination=state.destination)
                    return _Reply(question, next_action="confirm_route", suggested_actions=["confirm_route"],
                                  clarification=ClarificationRequest(slot="route", question=question))
                return await self._resolve_and_search(state)
            self._absorb_slots(state, ex)
            return self._ask_missing(state)

        # -- Greeting / acknowledgement -----------------------------------
        if intent == "greeting":
            return _Reply(responses.render("welcome", state.language))
        if intent == "acknowledge":
            if state.status == "result_presented" and state.last_journey and state.last_journey.found:
                return _Reply(responses.render("summary_ask", state.language), next_action="offer_message_summary")
            return self._ask_missing(state)

        # -- Yes/no outside dedicated states -------------------------------
        if intent == "confirm_yes" and state.status == "result_presented":
            return await self._start_summary_flow(state, ex.channel)
        if intent == "confirm_no" and state.status == "result_presented":
            return self._decline_summary(state)

        # -- Bare place name answers ---------------------------------------
        if state.awaiting_role_for:
            if _ORIGIN_ROLE.search(text) and not _DEST_ROLE.search(text):
                state.origin = state.awaiting_role_for
                state.awaiting_role_for = None
                return await self._after_slot_update(state)
            if _DEST_ROLE.search(text):
                state.destination = state.awaiting_role_for
                state.awaiting_role_for = None
                return await self._after_slot_update(state)
            # fall through: caller may have said something else entirely

        if _looks_like_place(ex.cleaned_text):
            value = ex.cleaned_text
            if state.pending_slot == "origin":
                state.origin = value
                state.canonical_origin = None
                state.pending_slot = None
                return await self._after_slot_update(state)
            if state.pending_slot == "destination":
                state.destination = value
                state.canonical_destination = None
                state.pending_slot = None
                return await self._after_slot_update(state)
            if state.status == "collecting" and not state.origin and not state.destination:
                state.awaiting_role_for = value
                question = responses.render("role_ask", state.language, value=value)
                return _Reply(question, next_action="request_clarification",
                              clarification=ClarificationRequest(slot="origin", question=question))

        # -- First-turn welcome / unclear speech -----------------------------
        if not state.started and intent == "unknown":
            return _Reply(responses.render("welcome", state.language))
        return self._unclear(state)

    # ------------------------------------------------------------------
    # Slot helpers
    # ------------------------------------------------------------------
    def _absorb_slots(self, state: _SessionState, ex: nlu.ExtractionResult, reset_journey: bool = False) -> None:
        if ex.origin:
            if state.origin != ex.origin:
                state.canonical_origin = None
            state.origin = ex.origin
        if ex.destination:
            if state.destination != ex.destination:
                state.canonical_destination = None
            state.destination = ex.destination
        if ex.preferred_mode:
            state.preferred_mode = ex.preferred_mode
        if reset_journey:
            state.last_journey = None
            state.last_search_failed = False

    def _reset_journey(self, state: _SessionState) -> None:
        state.last_journey = None
        state.last_search_failed = False
        state.summary_channel = None
        state.consent_granted = False
        state.consent_declined = False
        state.message_handoff = None
        state.clarify_slot = None
        state.clarify_candidates = []
        state.clarify_attempts = 0

    def _ask_missing(self, state: _SessionState, prefix: str = "") -> _Reply:
        state.status = "collecting"
        if not state.origin:
            state.pending_slot = "origin"
            question = responses.render("ask_origin", state.language)
        elif not state.destination:
            state.pending_slot = "destination"
            question = responses.render("ask_destination", state.language)
        else:
            state.pending_slot = None
            question = responses.render("welcome", state.language)
        return _Reply(
            prefix + question,
            next_action="request_clarification" if prefix == "" else "await_caller_input",
            clarification=ClarificationRequest(slot=state.pending_slot or "route", question=question),
        )

    async def _after_slot_update(self, state: _SessionState, prefix: str = "") -> _Reply:
        if state.origin and state.destination:
            return await self._resolve_and_search(state, prefix=prefix)
        return self._ask_missing(state, prefix=prefix)

    # ------------------------------------------------------------------
    # Stop resolution + mobility search
    # ------------------------------------------------------------------
    async def _resolve_and_search(self, state: _SessionState, prefix: str = "") -> _Reply:
        state.status = "collecting"
        for slot in ("origin", "destination"):
            value = getattr(state, slot)
            canonical = getattr(state, f"canonical_{slot}")
            if canonical or not value:
                continue
            if len(value.strip()) < 2:
                setattr(state, slot, None)
                state.pending_slot = slot
                question = responses.render("unknown_place", state.language, query=value)
                return _Reply(question, next_action="request_clarification",
                              clarification=ClarificationRequest(slot=slot, question=question))
            try:
                candidates = await self.mobility.search_stops(value, limit=5)
            except StopsLookupUnsupported:
                setattr(state, f"canonical_{slot}", value)
                continue
            except (MobilityTimeoutError, MobilityUnavailableError, MobilityBadResponseError) as exc:
                return self._search_failure(state, exc)

            if not candidates:
                setattr(state, slot, None)
                state.pending_slot = slot
                question = responses.render("unknown_place", state.language, query=value)
                return _Reply(question, next_action="request_clarification",
                              clarification=ClarificationRequest(slot=slot, question=question))

            exact = [c for c in candidates if str(c.get("stop_name", "")).strip().lower() == value.strip().lower()]
            if len(candidates) == 1 or len(exact) == 1:
                chosen = exact[0] if exact else candidates[0]
                setattr(state, f"canonical_{slot}", chosen.get("stop_name") or value)
                continue

            # Ambiguous — never choose arbitrarily (duplicate names may be
            # different sides/platforms/entrances per the data quality report).
            state.status = "clarifying_stop"
            state.clarify_slot = slot
            state.clarify_query = value
            state.clarify_candidates = candidates[:MAX_CLARIFY_CANDIDATES]
            names = self._candidate_display_names(state)
            question = responses.render("clarify_stop", state.language, query=value, candidates="; ".join(names))
            return _Reply(question, next_action="request_clarification", suggested_actions=["request_clarification"],
                          clarification=ClarificationRequest(slot=slot, question=question, candidates=names))

        request = JourneyRequest(
            origin=state.canonical_origin or state.origin,
            destination=state.canonical_destination or state.destination,
            language=state.language,
            preferred_mode=state.preferred_mode,
        )
        try:
            result = await self.mobility.search_routes(request)
        except MobilityBadRequestError as exc:
            logger.info("Mobility rejected places for call %s: %s", state.call_id, exc)
            state.origin = None
            state.destination = None
            state.canonical_origin = None
            state.canonical_destination = None
            state.pending_slot = "origin"
            state.status = "collecting"
            question = responses.render("places_unresolved", state.language)
            return _Reply(question, next_action="request_clarification",
                          clarification=ClarificationRequest(slot="route", question=question))
        except (MobilityTimeoutError, MobilityUnavailableError, MobilityBadResponseError) as exc:
            return self._search_failure(state, exc)

        state.last_journey = result
        state.last_search_failed = False
        state.status = "result_presented"
        state.pending_slot = None

        if result.found and result.options:
            summary = (
                result.spoken_summary_ta
                if state.language in ("ta", "ta-en")
                else result.spoken_summary_en
            ) or responses.render("no_verified_info", state.language)
            ask = responses.render("summary_ask", state.language)
            return _Reply(
                prefix + summary + " " + result.disclaimer + " " + ask,
                next_action="offer_message_summary",
                suggested_actions=["execute_mobility_search", "offer_message_summary"],
            )
        question = responses.render("no_route", state.language, origin=request.origin, destination=request.destination)
        return _Reply(prefix + question, suggested_actions=["execute_mobility_search"])

    def _search_failure(self, state: _SessionState, exc: Exception) -> _Reply:
        logger.warning("Mobility lookup failed for call %s: %s", state.call_id, exc)
        state.status = "search_failed"
        state.last_search_failed = True
        return _Reply(
            responses.render("mobility_unavailable", state.language),
            suggested_actions=["execute_mobility_search_failed", "offer_retry"],
        )

    def _candidate_display_names(self, state: _SessionState) -> List[str]:
        names = []
        for candidate in state.clarify_candidates:
            if state.language in ("ta", "ta-en") and candidate.get("stop_name_tamil"):
                names.append(str(candidate["stop_name_tamil"]))
            else:
                names.append(str(candidate.get("stop_name", "")))
        return names

    async def _handle_clarification(self, state: _SessionState, ex: nlu.ExtractionResult, text: str) -> Optional[_Reply]:
        norm = re.sub(r"\s+", " ", text.strip().lower().rstrip(".!?"))
        candidates = state.clarify_candidates

        # Ordinal selection ("first", "2", "இரண்டாவது"...).
        for index, tokens in _ORDINALS.items():
            if norm in tokens and index < len(candidates):
                return await self._select_candidate(state, index)

        # Name match against candidates (English or Tamil).
        if norm:
            for index, candidate in enumerate(candidates):
                for key in ("stop_name", "stop_name_tamil"):
                    name = str(candidate.get(key, "")).strip().lower()
                    if name and (norm == name or (len(norm) >= 3 and norm in name)):
                        return await self._select_candidate(state, index)

        # A fresh place name replaces the ambiguous value and is re-resolved.
        if ex.intent in ("route_query", "correct_origin", "correct_destination", "provide_origin", "provide_destination"):
            state.clarify_slot = None
            state.clarify_candidates = []
            state.status = "collecting"
            return None  # fall through to normal handling
        if _looks_like_place(ex.cleaned_text):
            state.clarify_attempts += 1
            if state.clarify_attempts > self.max_clarify_attempts:
                slot = state.clarify_slot or "origin"
                setattr(state, slot, None)
                setattr(state, f"canonical_{slot}", None)
                state.clarify_slot = None
                state.clarify_candidates = []
                state.clarify_attempts = 0
                state.pending_slot = slot
                state.status = "collecting"
                question = responses.render("clarify_giveup", state.language)
                return _Reply(question, next_action="request_clarification",
                              clarification=ClarificationRequest(slot=slot, question=question))
            setattr(state, state.clarify_slot or "origin", ex.cleaned_text)
            setattr(state, f"canonical_{state.clarify_slot or 'origin'}", None)
            state.clarify_slot = None
            state.clarify_candidates = []
            state.status = "collecting"
            return await self._resolve_and_search(state)
        return self._unclear(state)

    async def _select_candidate(self, state: _SessionState, index: int) -> _Reply:
        candidate = state.clarify_candidates[index]
        slot = state.clarify_slot or "origin"
        setattr(state, f"canonical_{slot}", candidate.get("stop_name") or getattr(state, slot))
        state.clarify_slot = None
        state.clarify_candidates = []
        state.clarify_attempts = 0
        state.status = "collecting"
        return await self._resolve_and_search(state)

    # ------------------------------------------------------------------
    # Live arrivals / summaries / consent
    # ------------------------------------------------------------------
    def _live_answer(self, state: _SessionState) -> _Reply:
        source = ""
        if state.last_journey and state.last_journey.options:
            freshness = state.last_journey.options[0].freshness
            if not freshness.is_live:
                source = freshness.source
        return _Reply(
            responses.render(
                "live_static_only",
                state.language,
                source_part=responses.static_source_part(state.language, source),
            )
        )

    async def _start_summary_flow(self, state: _SessionState, channel: Optional[str]) -> _Reply:
        if not state.last_journey or not state.last_journey.found:
            return _Reply(responses.render("no_route_to_send", state.language))
        if state.consent_granted:
            return _Reply(responses.render("consent_granted", state.language, channel=state.summary_channel or "sms"))
        state.summary_channel = channel or state.summary_channel
        if not state.summary_channel:
            state.status = "awaiting_summary_channel"
            question = responses.render("summary_channel_ask", state.language)
            return _Reply(question, next_action="request_clarification",
                          clarification=ClarificationRequest(slot="summary_channel", question=question))
        return self._ask_consent(state)

    def _ask_consent(self, state: _SessionState) -> _Reply:
        session = self.call_records.get(state.call_id)
        phone = session.caller_phone if session else UNKNOWN_CALLER
        if not phone or phone == UNKNOWN_CALLER:
            state.status = "result_presented"
            return _Reply(responses.render("no_contact_available", state.language))
        state.status = "awaiting_consent"
        question = responses.render("consent_confirm", state.language, number=phone, channel=state.summary_channel)
        return _Reply(question, next_action="await_consent", suggested_actions=["request_consent"],
                      clarification=ClarificationRequest(slot="consent", question=question))

    def _grant_consent(self, state: _SessionState) -> _Reply:
        session = self.call_records.get(state.call_id)
        phone = session.caller_phone if session else UNKNOWN_CALLER
        journey = state.last_journey
        if not session or not phone or phone == UNKNOWN_CALLER or journey is None or not state.summary_channel:
            state.status = "result_presented"
            return _Reply(responses.render("no_contact_available", state.language))
        summary = (
            journey.spoken_summary_ta if state.language in ("ta", "ta-en") else journey.spoken_summary_en
        )
        body = f"Chennai Mobility AI: {summary} {journey.disclaimer}"
        handoff = MessageRequest(
            recipient_phone=phone,
            channel=state.summary_channel,
            template_name=f"journey_summary_{'ta' if state.language in ('ta', 'ta-en') else 'en'}",
            body=body,
            call_id=state.call_id,
            user_consent_granted=True,  # explicit spoken consent captured above
        )
        state.consent_granted = True
        state.consent_declined = False
        state.message_handoff = handoff
        state.status = "result_presented"
        self.call_records.set_consent(state.call_id, True, state.summary_channel)
        self.call_records.attach_message_handoff(state.call_id, handoff.model_dump(mode="json"))
        return _Reply(
            responses.render("consent_granted", state.language, channel=state.summary_channel),
            next_action="handoff_message_to_messaging",
            suggested_actions=["handoff_message_to_messaging"],
        )

    def _decline_summary(self, state: _SessionState) -> _Reply:
        state.consent_declined = True
        state.consent_granted = False
        state.message_handoff = None
        state.status = "result_presented"
        self.call_records.set_consent(state.call_id, False)
        return _Reply(responses.render("consent_declined", state.language))

    # ------------------------------------------------------------------
    # Call lifecycle helpers
    # ------------------------------------------------------------------
    def _end(self, state: _SessionState, reason: str) -> _Reply:
        state.status = "ended"
        self.call_records.complete(state.call_id, termination_reason=reason)
        self._sync_call_summary(state)
        return _Reply(responses.render("goodbye", state.language), next_action="end_call", suggested_actions=["end_call"])

    def _unclear(self, state: _SessionState) -> _Reply:
        state.unclear_attempts += 1
        if state.unclear_attempts >= self.max_unclear_attempts:
            state.status = "ended"
            self.call_records.complete(state.call_id, termination_reason="unclear_speech")
            self._sync_call_summary(state)
            return _Reply(responses.render("unclear_final", state.language), next_action="end_call",
                          suggested_actions=["end_call"], unclear=True)
        question = responses.render("unclear", state.language)
        return _Reply(question, next_action="request_clarification", unclear=True,
                      clarification=ClarificationRequest(slot="route", question=question))

    def _next_turn_index(self, call_id: str) -> int:
        state = self._sessions.get(call_id)
        if state is None:
            return 0
        index = state.turn_count
        state.turn_count += 1
        return index

    def _snapshot(self, state: _SessionState) -> DialogueStateSnapshot:
        return DialogueStateSnapshot(
            call_id=state.call_id,
            status=state.status,
            language=state.language,
            origin=state.origin,
            destination=state.destination,
            preferred_mode=state.preferred_mode,
            pending_slot=state.pending_slot,
            unclear_attempts=state.unclear_attempts,
            route_found=state.last_journey.found if state.last_journey else None,
            summary_channel=state.summary_channel,
            consent_granted=state.consent_granted,
            consent_declined=state.consent_declined,
        )

    def _sync_call_summary(self, state: _SessionState) -> None:
        parts: List[str] = []
        if state.origin or state.destination:
            parts.append(f"Journey enquiry: {state.origin or '?'} -> {state.destination or '?'}")
        if state.last_journey is not None:
            parts.append("verified route offered" if state.last_journey.found else "no verified route found")
        elif state.last_search_failed:
            parts.append("mobility service unavailable")
        if state.consent_granted:
            parts.append(f"summary consent granted ({state.summary_channel})")
        elif state.consent_declined:
            parts.append("summary consent declined")
        if state.status == "ended":
            parts.append("call ended")
        self.call_records.update_summary(
            state.call_id, "; ".join(parts) if parts else "Call in progress", language=state.language
        )
