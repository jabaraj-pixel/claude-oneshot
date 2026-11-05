"""Sarvam AI speech adapters (Worker 1).

Implemented behind the existing BaseSpeechToText / BaseTextToSpeech interfaces
against Sarvam's public REST API shape:
  * STT: POST https://api.sarvam.ai/speech-to-text  (Saarika models)
  * TTS: POST https://api.sarvam.ai/text-to-speech  (Bulbul models)

STATUS: NOT LIVE-TESTED — no SARVAM_API_KEY is available in this environment.
Request/response handling follows the documented public API; verify against
the current provider docs and a real key before production use. Credentials
come exclusively from backend/app/config.py (SARVAM_API_KEY).
"""
import base64
import io
import struct
from typing import AsyncGenerator, Optional

import httpx

from backend.app.core.errors import IntegrationNotConfiguredError
from backend.app.core.logging import logger
from backend.app.voice.base import BaseSpeechToText, BaseTextToSpeech
from backend.app.voice.errors import VoiceProviderError

SARVAM_BASE_URL = "https://api.sarvam.ai"
STT_MODEL = "saarika:v2"
TTS_MODEL = "bulbul:v2"
TTS_SPEAKER = "anushka"

# Module language codes → Sarvam BCP-47 codes. Tanglish is transcribed/spoken
# as Tamil (code-mixing handled by the dialogue layer).
_LANGUAGE_CODES = {"ta": "ta-IN", "en": "en-IN", "ta-en": "ta-IN"}


def _language_code(language: str) -> str:
    return _LANGUAGE_CODES.get(language, "ta-IN")


def pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 16000, channels: int = 1, sample_width: int = 2) -> bytes:
    """Wrap raw PCM in a WAV container for REST STT upload."""
    byte_rate = sample_rate * channels * sample_width
    block_align = channels * sample_width
    data_size = len(pcm_bytes)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE", b"fmt ", 16,
        1, channels, sample_rate, byte_rate, block_align, sample_width * 8,
        b"data", data_size,
    )
    return header + pcm_bytes


class SarvamSpeechToText(BaseSpeechToText):
    """Sarvam Saarika STT. Retains the provider-reported language on the side
    (``last_language_code``) since the shared interface returns text only."""

    def __init__(self, api_key: Optional[str], timeout_seconds: float = 15.0, transport: Optional[httpx.AsyncBaseTransport] = None):
        if not api_key:
            raise IntegrationNotConfiguredError("Sarvam AI STT")
        self._api_key = api_key
        self._timeout = timeout_seconds
        self._transport = transport  # test seam (httpx.MockTransport)
        self.last_language_code: Optional[str] = None

    async def transcribe_audio_chunk(self, audio_bytes: bytes, language_hint: str = "ta") -> str:
        if not audio_bytes:
            return ""
        # Accept WAV uploads as-is; wrap bare PCM assuming 16 kHz mono s16le.
        wav_bytes = audio_bytes if audio_bytes[:4] == b"RIFF" else pcm_to_wav(audio_bytes)
        files = {"file": ("chunk.wav", io.BytesIO(wav_bytes), "audio/wav")}
        data = {"model": STT_MODEL, "language_code": _language_code(language_hint)}
        try:
            async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as client:
                response = await client.post(
                    f"{SARVAM_BASE_URL}/speech-to-text",
                    headers={"api-subscription-key": self._api_key},
                    files=files,
                    data=data,
                )
        except httpx.HTTPError as exc:
            raise VoiceProviderError(f"Sarvam STT request failed: {exc}") from exc
        if response.status_code != 200:
            logger.warning("Sarvam STT HTTP %s: %s", response.status_code, response.text[:200])
            raise VoiceProviderError(f"Sarvam STT returned HTTP {response.status_code}")
        try:
            payload = response.json()
            transcript = str(payload.get("transcript", ""))
        except ValueError as exc:
            raise VoiceProviderError("Sarvam STT returned a non-JSON response") from exc
        self.last_language_code = payload.get("language_code")
        return transcript


class SarvamTextToSpeech(BaseTextToSpeech):
    """Sarvam Bulbul TTS streaming decoded WAV chunks to the caller."""

    def __init__(self, api_key: Optional[str], timeout_seconds: float = 15.0, transport: Optional[httpx.AsyncBaseTransport] = None):
        if not api_key:
            raise IntegrationNotConfiguredError("Sarvam AI TTS")
        self._api_key = api_key
        self._timeout = timeout_seconds
        self._transport = transport  # test seam (httpx.MockTransport)

    async def synthesize_speech(self, text: str, language: str = "ta") -> AsyncGenerator[bytes, None]:
        if not text.strip():
            return
        payload = {
            "text": text,
            "target_language_code": _language_code(language),
            "speaker": TTS_SPEAKER,
            "model": TTS_MODEL,
            "enable_preprocessing": True,
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as client:
                response = await client.post(
                    f"{SARVAM_BASE_URL}/text-to-speech",
                    headers={"api-subscription-key": self._api_key, "Content-Type": "application/json"},
                    json=payload,
                )
        except httpx.HTTPError as exc:
            raise VoiceProviderError(f"Sarvam TTS request failed: {exc}") from exc
        if response.status_code != 200:
            logger.warning("Sarvam TTS HTTP %s: %s", response.status_code, response.text[:200])
            raise VoiceProviderError(f"Sarvam TTS returned HTTP {response.status_code}")
        try:
            audios = response.json().get("audios", [])
        except ValueError as exc:
            raise VoiceProviderError("Sarvam TTS returned a non-JSON response") from exc
        if not audios:
            raise VoiceProviderError("Sarvam TTS returned no audio")
        for chunk in audios:
            try:
                yield base64.b64decode(chunk)
            except (ValueError, TypeError) as exc:
                raise VoiceProviderError("Sarvam TTS returned invalid base64 audio") from exc
