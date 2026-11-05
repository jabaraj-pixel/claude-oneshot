"""Dialogue state-machine tests (Worker 1).

Covers: missing origin/destination, ambiguous locations, caller corrections,
repeated unclear speech, consent enforcement, safe UNKNOWN policies and call
termination. All mobility data is a labelled mock (voice_helpers).
"""
import pytest

from backend.app.conversation.call_records import CallRecordStore
from backend.app.conversation.manager import ConversationManager
from backend.app.conversation.session import InMemoryConversationStore
from backend.tests.voice_helpers import (
    ALANDUR_DEPOT_CANDIDATES,
    FakeMobilityClient,
    mock_journey_result,
)

pytestmark = pytest.mark.asyncio


def make_manager(mobility=None, **kwargs) -> ConversationManager:
    return ConversationManager(
        mobility_client=mobility if mobility is not None else FakeMobilityClient(),
        store=InMemoryConversationStore(),
        call_records=CallRecordStore(),
        **kwargs,
    )


async def test_greeting_welcomes_and_asks():
    manager = make_manager()
    reply = await manager.process_turn("c1", "hello")
    assert "Chennai Mobility AI" in reply.response_text
    assert reply.response_language == "en"
    assert reply.session_state.status == "collecting"


async def test_tamil_greeting_gets_tamil_response():
    manager = make_manager()
    reply = await manager.process_turn("c1", "வணக்கம்")
    assert reply.response_language == "ta"
    assert "வரவேற்கிறது" in reply.response_text


async def test_missing_origin_asks_for_origin():
    manager = make_manager()
    reply = await manager.process_turn("c1", "I want to go to T. Nagar")
    assert reply.session_state.pending_slot == "origin"
    assert reply.session_state.destination == "T. Nagar"
    assert "origin" in reply.response_text.lower()
    assert reply.clarification is not None and reply.clarification.slot == "origin"


async def test_missing_destination_asks_for_destination():
    manager = make_manager()
    reply = await manager.process_turn("c1", "from Tambaram")
    assert reply.session_state.pending_slot == "destination"
    assert reply.session_state.origin == "Tambaram"
    assert "destination" in reply.response_text.lower()


async def test_bare_answers_fill_slots_then_search():
    mobility = FakeMobilityClient()
    manager = make_manager(mobility)
    await manager.process_turn("c1", "I want to go to T. Nagar")
    await manager.process_turn("c1", "Tambaram")
    reply = await manager.process_turn("c1", "Guindy")  # destination already set → new info? no:
    # destination was set; third turn is a bare place with no pending slot →
    # it must NOT silently overwrite anything.
    assert reply.session_state.destination == "T. Nagar"
    assert len(mobility.route_requests) == 1
    request = mobility.route_requests[0]
    assert request.origin == "Tambaram"
    assert request.destination == "T. Nagar"


async def test_bare_place_without_context_asks_role_never_guesses():
    manager = make_manager()
    reply = await manager.process_turn("c1", "Tambaram")
    assert reply.session_state.origin is None
    assert reply.session_state.destination is None
    assert reply.clarification is not None
    reply = await manager.process_turn("c1", "origin")
    assert reply.session_state.origin == "Tambaram"
    assert reply.session_state.pending_slot == "destination"


async def test_low_confidence_extraction_requires_confirmation():
    mobility = FakeMobilityClient()
    manager = make_manager(mobility)
    # Code-mixed utterance using English from/to → low confidence → confirm.
    reply = await manager.process_turn("c1", "from Porur to Guindy poganum")
    assert reply.session_state.status == "confirming_route"
    assert len(mobility.route_requests) == 0  # never search before confirming
    reply = await manager.process_turn("c1", "yes")
    assert len(mobility.route_requests) == 1
    assert reply.session_state.route_found is True


async def test_confirmation_rejected_recollects_origin():
    mobility = FakeMobilityClient()
    manager = make_manager(mobility)
    await manager.process_turn("c1", "from Porur to Guindy poganum")
    reply = await manager.process_turn("c1", "no")
    assert reply.session_state.origin is None
    assert reply.session_state.pending_slot == "origin"
    assert len(mobility.route_requests) == 0


async def test_ambiguous_stop_asks_clarification_and_never_auto_merges():
    mobility = FakeMobilityClient(stops={"alandur depot": ALANDUR_DEPOT_CANDIDATES})
    manager = make_manager(mobility)
    reply = await manager.process_turn("c1", "from Alandur Depot to Guindy")
    state = reply.session_state
    assert state.status == "clarifying_stop"
    assert reply.clarification is not None and reply.clarification.slot == "origin"
    assert len(reply.clarification.candidates) == 3
    assert len(mobility.route_requests) == 0  # did not pick arbitrarily


async def test_ambiguous_stop_ordinal_selection():
    mobility = FakeMobilityClient(stops={"alandur depot": ALANDUR_DEPOT_CANDIDATES})
    manager = make_manager(mobility)
    await manager.process_turn("c1", "from Alandur Depot to Guindy")
    reply = await manager.process_turn("c1", "second")
    assert len(mobility.route_requests) == 1
    assert mobility.route_requests[0].origin == "Alandur Depot"
    assert reply.session_state.route_found is True


async def test_ambiguous_stop_tamil_ordinal_selection():
    mobility = FakeMobilityClient(stops={"alandur depot": ALANDUR_DEPOT_CANDIDATES})
    manager = make_manager(mobility)
    await manager.process_turn("c1", "from Alandur Depot to Guindy")
    reply = await manager.process_turn("c1", "இரண்டாவது")
    assert len(mobility.route_requests) == 1
    assert reply.session_state.status == "result_presented"


async def test_ambiguous_stop_giveup_after_repeated_failures():
    # Every suggested name stays ambiguous (mock) → after the retry limit the
    # manager gives up politely instead of looping forever.
    mobility = FakeMobilityClient(
        stops={
            "alandur depot": ALANDUR_DEPOT_CANDIDATES,
            "xyzzy place": ALANDUR_DEPOT_CANDIDATES,
            "qwerty place": ALANDUR_DEPOT_CANDIDATES,
        }
    )
    manager = make_manager(mobility, max_clarify_attempts=1)
    await manager.process_turn("c1", "from Alandur Depot to Guindy")
    reply = await manager.process_turn("c1", "Xyzzy Place")
    assert reply.session_state.status == "clarifying_stop"
    reply = await manager.process_turn("c1", "Qwerty Place")
    assert reply.session_state.origin is None
    assert reply.session_state.pending_slot == "origin"
    assert len(mobility.route_requests) == 0


async def test_unknown_place_asks_again():
    mobility = FakeMobilityClient(stops={"xyzzy": []}, auto_single_stop=True)
    manager = make_manager(mobility)
    reply = await manager.process_turn("c1", "from Xyzzy to Guindy")
    assert "xyzzy" in reply.response_text.lower()
    assert reply.session_state.origin is None
    assert reply.session_state.pending_slot == "origin"


async def test_caller_correction_updates_origin_and_researches():
    mobility = FakeMobilityClient()
    manager = make_manager(mobility)
    await manager.process_turn("c1", "Tambaram to T. Nagar")
    assert len(mobility.route_requests) == 1
    reply = await manager.process_turn("c1", "actually from Guindy")
    assert len(mobility.route_requests) == 2
    assert mobility.route_requests[1].origin == "Guindy"
    assert mobility.route_requests[1].destination == "T. Nagar"
    assert reply.session_state.origin == "Guindy"


async def test_caller_correction_updates_destination():
    mobility = FakeMobilityClient()
    manager = make_manager(mobility)
    await manager.process_turn("c1", "Tambaram to T. Nagar")
    await manager.process_turn("c1", "destination is Chennai Central")
    assert mobility.route_requests[1].destination == "Chennai Central"


async def test_repeated_unclear_speech_ends_gracefully():
    manager = make_manager(max_unclear_attempts=3)
    r1 = await manager.process_turn("c1", "hello")
    assert r1.session_state.status == "collecting"
    r2 = await manager.process_turn("c1", "???")
    assert r2.session_state.unclear_attempts == 1
    r3 = await manager.process_turn("c1", "mm hmm")
    assert r3.session_state.unclear_attempts == 2
    r4 = await manager.process_turn("c1", "")
    assert r4.session_state.status == "ended"
    assert r4.next_action == "end_call"
    record = manager.call_records.get("c1")
    assert record.status == "completed"
    assert record.metadata["termination_reason"] == "unclear_speech"


async def test_understanding_resets_unclear_counter():
    manager = make_manager()
    await manager.process_turn("c1", "???")
    reply = await manager.process_turn("c1", "Tambaram to Guindy")
    assert reply.session_state.unclear_attempts == 0


async def test_end_call_records_completion_and_summary():
    manager = make_manager()
    await manager.process_turn("c1", "Tambaram to T. Nagar")
    reply = await manager.process_turn("c1", "bye")
    assert reply.next_action == "end_call"
    record = manager.call_records.get("c1")
    assert record.status == "completed"
    assert record.end_time is not None
    assert "Tambaram" in (record.summary or "")
    # Further turns on an ended call only repeat the goodbye.
    reply = await manager.process_turn("c1", "hello again")
    assert reply.next_action == "end_call"


async def test_live_arrival_is_static_only_never_invented():
    manager = make_manager()
    await manager.process_turn("c1", "Tambaram to Guindy")
    reply = await manager.process_turn("c1", "when will the next bus arrive?")
    text = reply.response_text.lower()
    assert "live" in text and "not connected" in text
    # No fabricated minutes/arrival times.
    assert "minutes" not in text.replace("45 minutes", "")  # summary not repeated here


async def test_fare_query_is_unknown_policy():
    manager = make_manager()
    reply = await manager.process_turn("c1", "How much is the bus fare from Tambaram to T Nagar?")
    assert "fare" in reply.response_text.lower()
    assert "verified" in reply.response_text.lower() or "can't quote" in reply.response_text.lower()


async def test_accessibility_query_is_unknown_policy():
    manager = make_manager()
    reply = await manager.process_turn("c1", "Is Guindy station wheelchair accessible?")
    assert "accessibility" in reply.response_text.lower()


async def test_complaint_and_lost_property_redirect():
    manager = make_manager()
    reply = await manager.process_turn("c1", "I want to complain about a bus service.")
    assert "complaint" in reply.response_text.lower()
    reply = await manager.process_turn("c2", "I lost my bag on a bus.")
    assert "lost property" in reply.response_text.lower()


async def test_nearest_stop_requires_location_clarification():
    manager = make_manager()
    reply = await manager.process_turn("c1", "What is the nearest bus stop to this hospital?")
    assert reply.clarification is not None
    assert reply.session_state.pending_slot == "origin"
    assert "hospital" in reply.response_text.lower() or "place" in reply.response_text.lower()


async def test_schedule_query_offers_route_instead_of_times():
    mobility = FakeMobilityClient()
    manager = make_manager(mobility)
    reply = await manager.process_turn("c1", "When is the first bus from Porur to Guindy?")
    assert "timetable" in reply.response_text.lower()
    # Verified route info is appended, but no invented departure times.
    assert len(mobility.route_requests) == 1
    assert "TEST-1" in reply.response_text


async def test_alternate_route_researches():
    mobility = FakeMobilityClient()
    manager = make_manager(mobility)
    await manager.process_turn("c1", "Porur to Guindy")
    reply = await manager.process_turn("c1", "Is there another bus route from Porur to Guindy?")
    assert len(mobility.route_requests) == 2
    assert reply.session_state.route_found is True


async def test_repeat_request_repeats_last_response():
    manager = make_manager()
    first = await manager.process_turn("c1", "hello")
    reply = await manager.process_turn("c1", "repeat please")
    assert reply.response_text == first.response_text


# ---------------------------------------------------------------------------
# Consent flow
# ---------------------------------------------------------------------------


async def _consent_ready_manager(phone="+919840123456"):
    mobility = FakeMobilityClient()
    manager = make_manager(mobility)
    manager.call_records.ensure_session("c1", caller_phone=phone)
    await manager.process_turn("c1", "Tambaram to T. Nagar")
    return manager, mobility


async def test_summary_requires_channel_then_explicit_consent():
    manager, _ = await _consent_ready_manager()
    reply = await manager.process_turn("c1", "send me the summary")
    assert reply.session_state.status == "awaiting_summary_channel"
    reply = await manager.process_turn("c1", "whatsapp")
    assert reply.session_state.status == "awaiting_consent"
    assert "+919840123456" in reply.response_text
    assert reply.session_state.consent_granted is False  # not yet!
    reply = await manager.process_turn("c1", "yes")
    assert reply.session_state.consent_granted is True
    assert reply.next_action == "handoff_message_to_messaging"
    handoff = reply.message_handoff
    assert handoff is not None
    assert handoff.user_consent_granted is True
    assert handoff.channel == "whatsapp"
    assert handoff.recipient_phone == "+919840123456"
    assert handoff.call_id == "c1"
    record = manager.call_records.get("c1")
    assert record.metadata["summary_consent_granted"] is True
    assert record.metadata["message_handoff"]["channel"] == "whatsapp"


async def test_summary_declined_sends_nothing():
    manager, _ = await _consent_ready_manager()
    await manager.process_turn("c1", "yes whatsapp")
    reply = await manager.process_turn("c1", "no")
    assert reply.session_state.consent_granted is False
    assert reply.session_state.consent_declined is True
    assert reply.message_handoff is None
    record = manager.call_records.get("c1")
    assert "message_handoff" not in record.metadata


async def test_ambiguous_answer_never_grants_consent():
    manager, _ = await _consent_ready_manager()
    await manager.process_turn("c1", "yes sms")
    reply = await manager.process_turn("c1", "maybe tomorrow")
    assert reply.session_state.consent_granted is False
    assert reply.message_handoff is None
    assert reply.session_state.status == "awaiting_consent"


async def test_summary_without_caller_number_is_refused():
    manager, _ = await _consent_ready_manager(phone="unknown")
    reply = await manager.process_turn("c1", "yes whatsapp")
    assert reply.session_state.consent_granted is False
    assert reply.message_handoff is None
    assert "number" in reply.response_text.lower()


async def test_summary_without_route_is_refused():
    manager = make_manager()
    manager.call_records.ensure_session("c1", caller_phone="+919840123456")
    reply = await manager.process_turn("c1", "send me the summary")
    assert reply.message_handoff is None
    assert reply.session_state.consent_granted is False


async def test_turn_history_recorded_with_shared_schema():
    manager = make_manager()
    await manager.process_turn("c1", "hello")
    history = await manager.store.get_history("c1")
    assert len(history) == 2
    assert history[0].speaker == "caller"
    assert history[1].speaker == "assistant"
    assert history[0].turn_index == 0 and history[1].turn_index == 1
    assert history[0].latency_ms is not None
