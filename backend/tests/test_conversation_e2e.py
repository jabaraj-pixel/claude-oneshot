"""Scripted end-to-end text conversations (Worker 1).

Definition-of-done proof: a full multi-turn conversation works locally with
NO external credentials — origin/destination → route lookup → spoken-response
text → consent → handoff → termination. Mobility responses are labelled mocks.
"""
import pytest

from backend.app.conversation.call_records import CallRecordStore
from backend.app.conversation.manager import ConversationManager
from backend.app.conversation.mobility_client import UnconfiguredMobilityClient
from backend.app.conversation.session import InMemoryConversationStore
from backend.tests.voice_helpers import FakeMobilityClient, mock_journey_result

pytestmark = pytest.mark.asyncio


def make_manager(mobility) -> ConversationManager:
    return ConversationManager(
        mobility_client=mobility,
        store=InMemoryConversationStore(),
        call_records=CallRecordStore(),
    )


async def test_full_english_call_with_consent_handoff():
    journey = mock_journey_result("Tambaram", "T. Nagar")
    mobility = FakeMobilityClient(journey=journey)
    manager = make_manager(mobility)
    manager.call_records.ensure_session("call-e2e-1", caller_phone="+919840123456")

    script = [
        ("hello", lambda r: "Chennai Mobility AI" in r.response_text),
        ("I need to go from Tambaram to T. Nagar by bus",
         lambda r: journey.spoken_summary_en in r.response_text and r.next_action == "offer_message_summary"),
        ("yes, send it on whatsapp",
         lambda r: r.session_state.status == "awaiting_consent" and "+919840123456" in r.response_text),
        ("yes",
         lambda r: r.next_action == "handoff_message_to_messaging" and r.message_handoff is not None
         and r.message_handoff.user_consent_granted is True),
        ("bye", lambda r: r.next_action == "end_call"),
    ]
    for utterance, check in script:
        reply = await manager.process_turn("call-e2e-1", utterance)
        assert reply.response_text.strip(), f"empty response for {utterance!r}"
        assert check(reply), f"failed expectation for {utterance!r}: {reply.response_text!r}"

    record = manager.call_records.get("call-e2e-1")
    assert record.status == "completed"
    assert record.language == "en"
    assert "Tambaram" in record.summary and "consent granted" in record.summary
    handoff = record.metadata["message_handoff"]
    assert handoff["channel"] == "whatsapp"
    assert handoff["user_consent_granted"] is True
    assert journey.spoken_summary_en in handoff["body"]

    history = await manager.store.get_history("call-e2e-1")
    assert len(history) == 2 * len(script)
    assert [t.speaker for t in history] == ["caller", "assistant"] * len(script)


async def test_full_tamil_call_with_declined_summary():
    journey = mock_journey_result("தாம்பரம்", "தி நகர்")
    mobility = FakeMobilityClient(journey=journey)
    manager = make_manager(mobility)
    manager.call_records.ensure_session("call-e2e-2", caller_phone="+919840123456")

    reply = await manager.process_turn("call-e2e-2", "வணக்கம்")
    assert reply.response_language == "ta"
    reply = await manager.process_turn("call-e2e-2", "தாம்பரத்திலிருந்து தி நகருக்கு போக என்ன பஸ்?")
    assert journey.spoken_summary_ta in reply.response_text
    reply = await manager.process_turn("call-e2e-2", "aama whatsapp")
    assert reply.session_state.status == "awaiting_consent"
    reply = await manager.process_turn("call-e2e-2", "vendam")
    assert reply.session_state.consent_declined is True
    assert reply.message_handoff is None
    reply = await manager.process_turn("call-e2e-2", "நன்றி பை")
    assert reply.next_action == "end_call"
    record = manager.call_records.get("call-e2e-2")
    assert record.status == "completed"
    assert "message_handoff" not in record.metadata


async def test_clarification_then_correction_e2e():
    from backend.tests.voice_helpers import ALANDUR_DEPOT_CANDIDATES

    mobility = FakeMobilityClient(stops={"alandur depot": ALANDUR_DEPOT_CANDIDATES})
    manager = make_manager(mobility)
    reply = await manager.process_turn("call-e2e-3", "from Alandur Depot to Guindy")
    assert reply.session_state.status == "clarifying_stop"
    reply = await manager.process_turn("call-e2e-3", "first")
    assert reply.session_state.route_found is True
    reply = await manager.process_turn("call-e2e-3", "actually from Tambaram")
    assert mobility.route_requests[-1].origin == "Tambaram"
    reply = await manager.process_turn("call-e2e-3", "that's all")
    assert reply.next_action == "end_call"


async def test_no_credentials_e2e_still_collects_and_explains():
    """DoD: local text conversation works without ANY external credentials."""
    manager = make_manager(UnconfiguredMobilityClient())
    reply = await manager.process_turn("call-e2e-4", "hello")
    assert "Chennai Mobility AI" in reply.response_text
    reply = await manager.process_turn("call-e2e-4", "I want to go to T. Nagar")
    assert reply.session_state.pending_slot == "origin"
    reply = await manager.process_turn("call-e2e-4", "Tambaram")
    assert "temporarily unavailable" in reply.response_text.lower()
    reply = await manager.process_turn("call-e2e-4", "retry")
    assert "temporarily unavailable" in reply.response_text.lower()
    reply = await manager.process_turn("call-e2e-4", "bye")
    assert reply.next_action == "end_call"
    record = manager.call_records.get("call-e2e-4")
    assert record.status == "completed"
    assert "unavailable" in record.summary
