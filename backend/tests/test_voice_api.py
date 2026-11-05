"""POST /api/voice/turn endpoint tests (Worker 1).

Contract: docs/API_CONTRACTS.md §3 — 200 success shape, 422 validation,
400 bad audio, 501 provider-not-configured, 502 provider failure.
"""
import base64

import pytest
from fastapi.testclient import TestClient

from backend.app.conversation.call_records import CallRecordStore
from backend.app.conversation.manager import ConversationManager
from backend.app.conversation.session import InMemoryConversationStore
from backend.app.main import create_application
from backend.app.voice.api import get_conversation_manager, get_stt
from backend.app.voice.errors import VoiceProviderError
from backend.app.voice.mock import MockSpeechToText
from backend.tests.voice_helpers import FakeMobilityClient


@pytest.fixture()
def voice_app():
    app = create_application()
    manager = ConversationManager(
        mobility_client=FakeMobilityClient(),
        store=InMemoryConversationStore(),
        call_records=CallRecordStore(),
    )
    app.dependency_overrides[get_conversation_manager] = lambda: manager
    app.dependency_overrides[get_stt] = lambda: None  # unconfigured by default
    yield app, manager
    app.dependency_overrides.clear()


@pytest.fixture()
def client(voice_app):
    with TestClient(voice_app[0]) as test_client:
        yield test_client


def test_text_turn_success_contract_shape(client):
    response = client.post(
        "/api/voice/turn",
        json={"call_id": "call-api-1", "text_input": "Tambaram to T. Nagar", "language_hint": "en"},
    )
    assert response.status_code == 200
    data = response.json()
    assert set(data.keys()) == {"turn", "suggested_actions", "response_audio_url", "response_text"}
    assert data["response_audio_url"] is None
    assert data["turn"]["call_id"] == "call-api-1"
    assert data["turn"]["speaker"] == "caller"
    assert data["turn"]["intent"] == "route_query"
    assert data["turn"]["transcript_raw"] == "Tambaram to T. Nagar"
    assert "TEST-1" in data["response_text"]  # spoken from the mock engine verbatim
    assert "execute_mobility_search" in data["suggested_actions"]


def test_multi_turn_text_conversation(client):
    r1 = client.post("/api/voice/turn", json={"call_id": "call-api-2", "text_input": "I want to go to Guindy"})
    assert r1.status_code == 200
    assert "origin" in r1.json()["response_text"].lower()
    r2 = client.post("/api/voice/turn", json={"call_id": "call-api-2", "text_input": "Tambaram"})
    assert r2.status_code == 200
    assert "TEST-1" in r2.json()["response_text"]


def test_tamil_turn(client):
    response = client.post(
        "/api/voice/turn",
        json={"call_id": "call-api-3", "text_input": "தாம்பரத்திலிருந்து தி நகருக்கு போக என்ன பஸ்?"},
    )
    assert response.status_code == 200
    assert response.json()["turn"]["language"] == "ta"
    assert "சோதனை" in response.json()["response_text"]  # Tamil mock summary


def test_validation_errors(client):
    assert client.post("/api/voice/turn", json={}).status_code == 422
    assert client.post("/api/voice/turn", json={"call_id": "x"}).status_code == 422
    assert client.post("/api/voice/turn", json={"text_input": "hello"}).status_code == 422
    response = client.post(
        "/api/voice/turn",
        json={"call_id": "x", "text_input": "hello", "language_hint": "fr"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_audio_without_stt_is_501(client):
    response = client.post(
        "/api/voice/turn",
        json={"call_id": "call-api-4", "audio_base64": base64.b64encode(b"\x00\x01").decode()},
    )
    assert response.status_code == 501
    assert response.json()["error"]["code"] == "INTEGRATION_NOT_CONFIGURED"


def test_audio_with_mock_stt(client, voice_app):
    app, _ = voice_app
    app.dependency_overrides[get_stt] = lambda: MockSpeechToText(["Tambaram to Guindy"])
    response = client.post(
        "/api/voice/turn",
        json={"call_id": "call-api-5", "audio_base64": base64.b64encode(b"\x00\x01" * 50).decode()},
    )
    assert response.status_code == 200
    assert response.json()["turn"]["transcript_raw"] == "Tambaram to Guindy"
    assert "TEST-1" in response.json()["response_text"]


def test_invalid_base64_is_400(client, voice_app):
    app, _ = voice_app
    app.dependency_overrides[get_stt] = lambda: MockSpeechToText(["hello"])
    response = client.post(
        "/api/voice/turn",
        json={"call_id": "call-api-6", "audio_base64": "!!!not-base64!!!"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "BAD_REQUEST"


def test_stt_provider_failure_is_502(client, voice_app):
    class FailingStt:
        async def transcribe_audio_chunk(self, audio_bytes, language_hint="ta"):
            raise VoiceProviderError("provider exploded")

    app, _ = voice_app
    app.dependency_overrides[get_stt] = lambda: FailingStt()
    response = client.post(
        "/api/voice/turn",
        json={"call_id": "call-api-7", "audio_base64": base64.b64encode(b"\x00").decode()},
    )
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "VOICE_PROVIDER_ERROR"


def test_error_payload_standard_shape(client):
    response = client.post("/api/voice/turn", json={"call_id": "x"})
    body = response.json()
    assert "error" in body and "timestamp" in body and "request_id" in body
    assert set(body["error"].keys()) == {"code", "message", "details"}
