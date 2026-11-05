"""Mobility integration tests (Worker 1).

Success, no-route, timeout, malformed response, unconfigured engine and the
HTTP contract client (httpx.MockTransport — no network). All payloads are
labelled mocks; the dialogue must speak the engine's summaries verbatim.
"""
import httpx
import pytest

from backend.app.conversation.call_records import CallRecordStore
from backend.app.conversation.manager import ConversationManager
from backend.app.conversation.mobility_client import (
    HttpMobilityClient,
    MobilityBadRequestError,
    MobilityBadResponseError,
    MobilityTimeoutError,
    MobilityUnavailableError,
    StopsLookupUnsupported,
    UnconfiguredMobilityClient,
)
from backend.app.conversation.session import InMemoryConversationStore
from backend.app.schemas.shared import JourneyRequest
from backend.tests.voice_helpers import FakeMobilityClient, mock_journey_result

pytestmark = pytest.mark.asyncio


def make_manager(mobility) -> ConversationManager:
    return ConversationManager(
        mobility_client=mobility,
        store=InMemoryConversationStore(),
        call_records=CallRecordStore(),
    )


async def test_successful_lookup_spoken_verbatim_from_engine():
    journey = mock_journey_result("Tambaram", "T. Nagar")
    mobility = FakeMobilityClient(journey=journey)
    manager = make_manager(mobility)
    reply = await manager.process_turn("c1", "Tambaram to T. Nagar by bus")
    assert journey.spoken_summary_en in reply.response_text
    assert journey.disclaimer in reply.response_text
    assert "execute_mobility_search" in reply.suggested_actions
    assert reply.session_state.route_found is True
    request = mobility.route_requests[0]
    assert request.preferred_mode == "bus"
    assert request.language == "en"


async def test_tamil_session_speaks_tamil_summary():
    journey = mock_journey_result("தாம்பரம்", "தி நகர்")
    mobility = FakeMobilityClient(journey=journey)
    manager = make_manager(mobility)
    reply = await manager.process_turn("c1", "தாம்பரத்திலிருந்து தி நகருக்கு போக என்ன பஸ்?")
    assert reply.response_language == "ta"
    assert journey.spoken_summary_ta in reply.response_text


async def test_no_route_never_invents_details():
    mobility = FakeMobilityClient(journey=mock_journey_result(found=False))
    manager = make_manager(mobility)
    reply = await manager.process_turn("c1", "Tambaram to T. Nagar")
    assert "no verified route" in reply.response_text.lower()
    assert reply.session_state.route_found is False
    assert "TEST-1" not in reply.response_text  # nothing invented


async def test_timeout_explains_unavailability_and_offers_retry():
    mobility = FakeMobilityClient(route_error=MobilityTimeoutError("timeout"))
    manager = make_manager(mobility)
    reply = await manager.process_turn("c1", "Tambaram to T. Nagar")
    assert "temporarily unavailable" in reply.response_text.lower()
    assert "retry" in reply.response_text.lower()
    assert reply.session_state.status == "search_failed"
    # Retry succeeds once the service recovers.
    mobility.route_error = None
    reply = await manager.process_turn("c1", "retry")
    assert reply.session_state.route_found is True
    assert len(mobility.route_requests) == 2


async def test_malformed_response_is_graceful():
    mobility = FakeMobilityClient(route_error=MobilityBadResponseError("bad payload"))
    manager = make_manager(mobility)
    reply = await manager.process_turn("c1", "Tambaram to T. Nagar")
    assert "temporarily unavailable" in reply.response_text.lower()
    assert reply.session_state.status == "search_failed"


async def test_unconfigured_engine_keeps_dialogue_usable():
    manager = make_manager(UnconfiguredMobilityClient())
    reply = await manager.process_turn("c1", "hello")
    assert "Chennai Mobility AI" in reply.response_text
    reply = await manager.process_turn("c1", "I want to go to T. Nagar")
    assert reply.session_state.pending_slot == "origin"
    reply = await manager.process_turn("c1", "Tambaram")
    assert "temporarily unavailable" in reply.response_text.lower()


async def test_bad_request_clears_places_and_asks_again():
    mobility = FakeMobilityClient(route_error=MobilityBadRequestError("unresolved"))
    manager = make_manager(mobility)
    reply = await manager.process_turn("c1", "Tambaram to T. Nagar")
    assert reply.session_state.origin is None
    assert reply.session_state.destination is None
    assert reply.session_state.pending_slot == "origin"
    assert "verify" in reply.response_text.lower()


async def test_stops_lookup_unsupported_skips_resolution():
    mobility = FakeMobilityClient(stops_error=StopsLookupUnsupported("no endpoint"))
    manager = make_manager(mobility)
    reply = await manager.process_turn("c1", "Tambaram to T. Nagar")
    assert reply.session_state.route_found is True
    assert mobility.route_requests[0].origin == "Tambaram"


# ---------------------------------------------------------------------------
# HTTP contract client (MockTransport — exact endpoint paths & payloads)
# ---------------------------------------------------------------------------


def _client(handler) -> HttpMobilityClient:
    return HttpMobilityClient("http://mobility.test", transport=httpx.MockTransport(handler))


async def test_http_client_posts_exact_contract():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["method"] = request.method
        return httpx.Response(200, json=mock_journey_result().model_dump(mode="json"))

    result = await _client(handler).search_routes(JourneyRequest(origin="Tambaram", destination="T. Nagar"))
    assert seen == {"path": "/api/mobility/routes/search", "method": "POST"}
    assert result.found is True
    assert result.options[0].route_numbers == ["TEST-1"]


async def test_http_client_error_mapping():
    def handler_400(request):
        return httpx.Response(400, json={"error": {"code": "BAD_REQUEST", "message": "unresolved", "details": None}})

    with pytest.raises(MobilityBadRequestError):
        await _client(handler_400).search_routes(JourneyRequest(origin="Xx", destination="Yy"))

    def handler_500(request):
        return httpx.Response(500, text="boom")

    with pytest.raises(MobilityUnavailableError):
        await _client(handler_500).search_routes(JourneyRequest(origin="Xx", destination="Yy"))

    def handler_501(request):
        return httpx.Response(501, json={})

    with pytest.raises(MobilityUnavailableError):
        await _client(handler_501).search_routes(JourneyRequest(origin="Xx", destination="Yy"))


async def test_http_client_timeout_mapping():
    def handler(request):
        raise httpx.ReadTimeout("too slow", request=request)

    with pytest.raises(MobilityTimeoutError):
        await _client(handler).search_routes(JourneyRequest(origin="Xx", destination="Yy"))


async def test_http_client_malformed_payload_mapping():
    def handler(request):
        return httpx.Response(200, json={"found": "yes", "options": "not-a-list"})

    with pytest.raises(MobilityBadResponseError):
        await _client(handler).search_routes(JourneyRequest(origin="Xx", destination="Yy"))


async def test_http_client_stops_lookup_contract():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["query"] = dict(request.url.params)
        return httpx.Response(200, json=[{"stop_id": "S1", "stop_name": "Tambaram",
                                          "stop_name_tamil": "தாம்பரம்", "latitude": 12.9,
                                          "longitude": 80.1, "modes": ["bus"]}])

    stops = await _client(handler).search_stops("Tambaram", limit=5)
    assert seen["path"] == "/api/mobility/stops/search"
    assert seen["query"] == {"query": "Tambaram", "limit": "5"}
    assert stops[0]["stop_name"] == "Tambaram"


async def test_http_client_stops_unsupported_and_malformed():
    with pytest.raises(StopsLookupUnsupported):
        await _client(lambda r: httpx.Response(501)).search_stops("Tambaram")
    with pytest.raises(MobilityBadResponseError):
        await _client(lambda r: httpx.Response(200, json={"not": "a list"})).search_stops("Tambaram")
