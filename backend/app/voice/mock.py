"""MOCK speech adapters — DEVELOPMENT/TEST ONLY (Worker 1).

#####################################################################
# MOCK ADAPTERS — NOT REAL SPEECH PROCESSING.                         #
# MockSpeechToText replays scripted transcripts; MockTextToSpeech     #
# emits silence in a valid WAV container. Never present their output  #
# as real recognition or synthesis. Enabled only explicitly via       #
# VOICE_USE_MOCK=1 or direct construction in tests.                   #
#####################################################################
"""
from typing import AsyncGenerator, List, Optional

from backend.app.voice.base import BaseSpeechToText, BaseTextToSpeech
from backend.app.voice.errors import VoiceProviderError
from backend.app.voice.sarvam import pcm_to_wav

MOCK_LABEL = "MOCK ADAPTER - DEVELOPMENT ONLY - NOT REAL SPEECH"

_DEFAULT_SCRIPT = [
    "Tambaram to T. Nagar by bus",
    "yes whatsapp",
    "yes",
    "bye",
]


class MockSpeechToText(BaseSpeechToText):
    """Replays a scripted transcript list, one entry per audio chunk."""

    def __init__(self, transcripts: Optional[List[str]] = None):
        self._transcripts = list(transcripts) if transcripts is not None else list(_DEFAULT_SCRIPT)
        self._index = 0
        self.last_language_code = None

    async def transcribe_audio_chunk(self, audio_bytes: bytes, language_hint: str = "ta") -> str:
        if self._index >= len(self._transcripts):
            raise VoiceProviderError(f"{MOCK_LABEL}: scripted transcripts exhausted")
        transcript = self._transcripts[self._index]
        self._index += 1
        return transcript


class MockTextToSpeech(BaseTextToSpeech):
    """Emits 0.4 s of silence per call as a valid 16 kHz mono WAV."""

    async def synthesize_speech(self, text: str, language: str = "ta") -> AsyncGenerator[bytes, None]:
        silence = b"\x00\x00" * 6400  # 0.4 s at 16 kHz, 16-bit mono
        yield pcm_to_wav(silence, sample_rate=16000)
