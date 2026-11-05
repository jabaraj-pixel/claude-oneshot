"""STT/TTS adapter tests (Worker 1).

Provider-not-configured mode, provider failure mapping, and explicitly
labelled mocks. Sarvam HTTP behaviour is exercised with httpx.MockTransport —
NO live Sarvam calls were made (no API key in this environment).
"""
import base64

import httpx
import pytest

from backend.app.config import get_settings
from backend.app.core.errors import IntegrationNotConfiguredError
from backend.app.voice import factory
from backend.app.voice.errors import VoiceProviderError
from backend.app.voice.mock import MOCK_LABEL, MockSpeechToText, MockTextToSpeech
from backend.app.voice.sarvam import (
    SarvamSpeechToText,
    SarvamTextToSpeech,
    pcm_to_wav,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Provider-not-configured mode
# ---------------------------------------------------------------------------


async def test_factory_unconfigured_returns_none(monkeypatch):
    monkeypatch.delenv("VOICE_USE_MOCK", raising=False)
    monkeypatch.setattr(get_settings(), "SARVAM_API_KEY", None)
    assert factory.build_stt() is None
    assert factory.build_tts() is None


async def test_factory_mock_mode_is_explicit(monkeypatch):
    monkeypatch.setenv("VOICE_USE_MOCK", "1")
    stt, tts = factory.build_stt(), factory.build_tts()
    assert isinstance(stt, MockSpeechToText)
    assert isinstance(tts, MockTextToSpeech)


async def test_factory_configured_key_builds_sarvam(monkeypatch):
    monkeypatch.delenv("VOICE_USE_MOCK", raising=False)
    monkeypatch.setattr(get_settings(), "SARVAM_API_KEY", "test-key-not-real")
    assert isinstance(factory.build_stt(), SarvamSpeechToText)
    assert isinstance(factory.build_tts(), SarvamTextToSpeech)


async def test_sarvam_requires_key():
    with pytest.raises(IntegrationNotConfiguredError):
        SarvamSpeechToText(None)
    with pytest.raises(IntegrationNotConfiguredError):
        SarvamTextToSpeech("")


# ---------------------------------------------------------------------------
# Sarvam STT (mock transport)
# ---------------------------------------------------------------------------


async def test_sarvam_stt_success_retains_language():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/speech-to-text"
        assert request.headers["api-subscription-key"] == "test-key"
        return httpx.Response(200, json={"transcript": "தாம்பரம்", "language_code": "ta-IN"})

    stt = SarvamSpeechToText("test-key", transport=httpx.MockTransport(handler))
    text = await stt.transcribe_audio_chunk(b"\x00\x01" * 100, language_hint="ta")
    assert text == "தாம்பரம்"
    assert stt.last_language_code == "ta-IN"


async def test_sarvam_stt_empty_audio_returns_empty():
    stt = SarvamSpeechToText("test-key")
    assert await stt.transcribe_audio_chunk(b"") == ""


async def test_sarvam_stt_provider_failure():
    stt = SarvamSpeechToText("test-key", transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    with pytest.raises(VoiceProviderError):
        await stt.transcribe_audio_chunk(b"\x00\x01")


async def test_sarvam_stt_network_failure():
    def handler(request):
        raise httpx.ConnectError("no route", request=request)

    stt = SarvamSpeechToText("test-key", transport=httpx.MockTransport(handler))
    with pytest.raises(VoiceProviderError):
        await stt.transcribe_audio_chunk(b"\x00\x01")


async def test_sarvam_stt_non_json_response():
    stt = SarvamSpeechToText(
        "test-key", transport=httpx.MockTransport(lambda r: httpx.Response(200, text="<html>"))
    )
    with pytest.raises(VoiceProviderError):
        await stt.transcribe_audio_chunk(b"\x00\x01")


# ---------------------------------------------------------------------------
# Sarvam TTS (mock transport)
# ---------------------------------------------------------------------------


async def test_sarvam_tts_success_decodes_audio():
    audio = b"RIFFfake-wav-bytes"

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/text-to-speech"
        return httpx.Response(200, json={"audios": [base64.b64encode(audio).decode()]})

    tts = SarvamTextToSpeech("test-key", transport=httpx.MockTransport(handler))
    chunks = [chunk async for chunk in tts.synthesize_speech("வணக்கம்", "ta")]
    assert chunks == [audio]


async def test_sarvam_tts_tanglish_maps_to_tamil():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen.update(json.loads(request.content))
        return httpx.Response(200, json={"audios": [base64.b64encode(b"x").decode()]})

    tts = SarvamTextToSpeech("test-key", transport=httpx.MockTransport(handler))
    _ = [c async for c in tts.synthesize_speech("vanakkam", "ta-en")]
    assert seen["target_language_code"] == "ta-IN"


async def test_sarvam_tts_failure_and_empty_audio():
    tts = SarvamTextToSpeech("test-key", transport=httpx.MockTransport(lambda r: httpx.Response(503)))
    with pytest.raises(VoiceProviderError):
        _ = [c async for c in tts.synthesize_speech("hello", "en")]
    tts = SarvamTextToSpeech("test-key", transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"audios": []})))
    with pytest.raises(VoiceProviderError):
        _ = [c async for c in tts.synthesize_speech("hello", "en")]


# ---------------------------------------------------------------------------
# Labelled mocks + WAV helper
# ---------------------------------------------------------------------------


async def test_mock_stt_is_scripted_and_labelled():
    stt = MockSpeechToText(["Tambaram to Guindy"])
    assert await stt.transcribe_audio_chunk(b"anything") == "Tambaram to Guindy"
    with pytest.raises(VoiceProviderError) as exc:
        await stt.transcribe_audio_chunk(b"more")
    assert MOCK_LABEL in str(exc.value.message)


async def test_mock_tts_emits_valid_wav_silence():
    tts = MockTextToSpeech()
    chunks = [c async for c in tts.synthesize_speech("hello", "en")]
    assert len(chunks) == 1
    assert chunks[0][:4] == b"RIFF"
    assert chunks[0][8:12] == b"WAVE"


async def test_pcm_to_wav_header():
    wav = pcm_to_wav(b"\x00\x00" * 8000, sample_rate=16000)
    assert wav[:4] == b"RIFF"
    assert wav[8:12] == b"WAVE"
    assert len(wav) == 44 + 16000
