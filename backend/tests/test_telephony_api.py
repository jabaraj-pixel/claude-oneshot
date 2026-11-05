"""Telephony webhook + WebSocket tests (Worker 1).

Valid payload, invalid payload, duplicate events, auth checks, call completion
and the audio stream protocol — all locally, with labelled mocks. No real
Exotel integration was tested (no credentials/number in this environment).
"""
import pytest
from fastapi.testclient import TestClient

from backend.app.config import get_settings
from backend.app.conversation.call_records import CallRecordStore
from backend.app.conversation.manager import ConversationManager
from backend.app.conversation.session import InMemoryConversationStore
from backend.app.main import create_application
from backend.app.telephony.api import get_conversation_manager, router as telephony_router
from backend.app.voice.api import get_conversation_manager as voice_manager_dep
from backend.tests.voice_helpers import FakeMobilityClient

INBOUND_FORM = {
    "CallSid": "exotel-call-001",
    "CallFrom": "+919840123456",
    "CallTo": "+914440001234",
    "AccountSid": "AC-test",
    "Direction": "inbound",
}


@pytest.fixture()
def tel_app():
    app = create_application()
    app.include_router(telephony_router, prefix="/telephony", tags=["Telephony"])
    manager = ConversationManager(
        mobility_client=FakeMobilityClient(),
        store=InMemoryConversationStore(),
        call_records=CallRecordStore(),
    )
    app.dependency_overrides[get_conversation_manager] = lambda: manager
    app.dependency_overrides[voice_manager_dep] = lambda: manager
    yield app, manager
    app.dependency_overrides.clear()


@pytest.fixture()
def client(tel_app):
    with TestClient(tel_app[0]) as test_client:
        yield test_client


# ---------------------------------------------------------------------------
# POST /telephony/inbound
# ---------------------------------------------------------------------------


def test_inbound_valid_form_returns_stream_xml(client, tel_app):
    _, manager = tel_app
    response = client.post("/telephony/inbound", data=INBOUND_FORM)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    body = response.text
    assert "<Response>" in body and "<Stream" in body
    assert "/telephony/audio/exotel-call-001" in body
    session = manager.call_records.get("exotel-call-001")
    assert session is not None
    assert session.caller_phone == "+919840123456"
    assert session.metadata["telephony_provider"] == "exotel"
    assert session.status == "active"


def test_inbound_json_payload_also_accepted(client):
    response = client.post("/telephony/inbound", json=INBOUND_FORM)
    assert response.status_code == 200
    assert "<Stream" in response.text


def test_inbound_duplicate_event_is_idempotent(client, tel_app):
    _, manager = tel_app
    r1 = client.post("/telephony/inbound", data=INBOUND_FORM)
    session = manager.call_records.get("exotel-call-001")
    first_start = session.start_time
    r2 = client.post("/telephony/inbound", data=INBOUND_FORM)
    assert r2.status_code == 200
    assert r2.text == r1.text
    session = manager.call_records.get("exotel-call-001")
    assert session.start_time == first_start  # no reset, no second session
    assert len(manager.call_records.list_sessions()) == 1


def test_inbound_missing_fields_is_400(client):
    response = client.post("/telephony/inbound", data={"CallSid": "only-sid"})
    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "BAD_REQUEST"
    assert "CallFrom" in body["error"]["message"]


def test_inbound_empty_payload_is_400(client):
    assert client.post("/telephony/inbound", data={}).status_code == 400


def test_inbound_account_sid_mismatch_is_403(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "EXOTEL_ACCOUNT_SID", "AC-real")
    response = client.post("/telephony/inbound", data={**INBOUND_FORM, "AccountSid": "AC-impostor"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_inbound_webhook_token_enforced(client, monkeypatch):
    monkeypatch.setenv("EXOTEL_WEBHOOK_TOKEN", "secret-token")
    assert client.post("/telephony/inbound", data=INBOUND_FORM).status_code == 403
    assert client.post("/telephony/inbound?token=wrong", data=INBOUND_FORM).status_code == 403
    assert client.post("/telephony/inbound?token=secret-token", data=INBOUND_FORM).status_code == 200


# ---------------------------------------------------------------------------
# POST /telephony/call-completed
# ---------------------------------------------------------------------------


def test_call_completed_records_session(client, tel_app):
    _, manager = tel_app
    client.post("/telephony/inbound", data=INBOUND_FORM)
    response = client.post(
        "/telephony/call-completed",
        json={"call_id": "exotel-call-001", "duration_seconds": 120,
              "termination_reason": "caller_hangup",
              "recording_url": "https://storage.example/call-001.wav"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "recorded"
    assert data["session"]["status"] == "completed"
    assert data["session"]["duration_seconds"] == 120
    assert data["session"]["metadata"]["recording_url"] == "https://storage.example/call-001.wav"


def test_call_completed_duplicate_is_idempotent(client, tel_app):
    _, manager = tel_app
    client.post("/telephony/inbound", data=INBOUND_FORM)
    payload = {"call_id": "exotel-call-001", "duration_seconds": 120, "termination_reason": "caller_hangup"}
    r1 = client.post("/telephony/call-completed", json=payload)
    end_time = r1.json()["session"]["end_time"]
    r2 = client.post("/telephony/call-completed", json={**payload, "duration_seconds": 999})
    assert r2.status_code == 200
    assert r2.json()["session"]["end_time"] == end_time
    assert r2.json()["session"]["duration_seconds"] == 120  # not overwritten


def test_call_completed_unknown_call_is_404(client):
    response = client.post("/telephony/call-completed", json={"call_id": "nope"})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_call_completed_invalid_payload_is_422(client):
    assert client.post("/telephony/call-completed", json={}).status_code == 422
    assert client.post(
        "/telephony/call-completed", json={"call_id": "x", "duration_seconds": -5}
    ).status_code == 422


# ---------------------------------------------------------------------------
# WS /telephony/audio/{call_id}
# ---------------------------------------------------------------------------


def test_ws_control_frames_unconfigured_stt(client):
    with client.websocket_connect("/telephony/audio/ws-call-1") as ws:
        ws.send_json({"event": "start", "call_id": "ws-call-1"})
        ready = ws.receive_json()
        assert ready["event"] == "ready"
        assert ready["stt_configured"] is False
        # Duplicate start is harmless.
        ws.send_json({"event": "start", "call_id": "ws-call-1"})
        assert ws.receive_json()["event"] == "ready"
        # Audio without STT → honest error, connection stays alive.
        ws.send_bytes(b"\x00\x01" * 100)
        ws.send_json({"event": "utterance_end"})
        error = ws.receive_json()
        assert error["event"] == "error"
        assert error["code"] == "INTEGRATION_NOT_CONFIGURED"
        ws.send_json({"event": "stop"})
        assert ws.receive_json()["event"] == "stopped"


def test_ws_invalid_json_and_unknown_event(client):
    with client.websocket_connect("/telephony/audio/ws-call-2") as ws:
        ws.send_text("this is not json")
        error = ws.receive_json()
        assert error["code"] == "VALIDATION_ERROR"
        ws.send_json({"event": "bogus"})
        assert ws.receive_json()["code"] == "VALIDATION_ERROR"
        ws.send_json({"event": "stop"})
        assert ws.receive_json()["event"] == "stopped"


def test_ws_full_voice_loop_with_labelled_mocks(client, tel_app, monkeypatch):
    monkeypatch.setenv("VOICE_USE_MOCK", "1")
    _, manager = tel_app
    manager.call_records.ensure_session("ws-call-3", caller_phone="+919840123456")
    with client.websocket_connect("/telephony/audio/ws-call-3") as ws:
        ws.send_json({"event": "start", "call_id": "ws-call-3"})
        ready = ws.receive_json()
        assert ready["stt_configured"] is True and ready["tts_configured"] is True
        ws.send_bytes(b"\x00\x01" * 800)
        ws.send_json({"event": "utterance_end"})
        response = ws.receive_json()
        assert response["event"] == "response"
        # Mock STT script begins with "Tambaram to T. Nagar by bus".
        assert response["transcript"] == "Tambaram to T. Nagar by bus"
        assert "TEST-1" in response["response_text"]
        audio = ws.receive_bytes()  # mock TTS silence in a WAV container
        assert audio[:4] == b"RIFF"
        ws.send_json({"event": "stop"})
        assert ws.receive_json()["event"] == "stopped"
    session = manager.call_records.get("ws-call-3")
    assert session.status == "completed"


def test_ws_stop_completes_call_record(client, tel_app):
    _, manager = tel_app
    client.post("/telephony/inbound", data={**INBOUND_FORM, "CallSid": "ws-call-4"})
    with client.websocket_connect("/telephony/audio/ws-call-4") as ws:
        ws.send_json({"event": "start"})
        ws.receive_json()
        ws.send_json({"event": "stop"})
        ws.receive_json()
    session = manager.call_records.get("ws-call-4")
    assert session.status == "completed"
    assert session.metadata["termination_reason"] == "stream_stop"
