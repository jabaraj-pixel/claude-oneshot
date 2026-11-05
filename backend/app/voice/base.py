"""Voice AI module (Worker 1 ownership: worker/voice-telephony).
Provides Speech-To-Text (STT) and Text-To-Speech (TTS) provider contracts.
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional


class BaseSpeechToText(ABC):
    """Abstract interface for Speech-to-Text provider (e.g. Sarvam STT)."""

    @abstractmethod
    async def transcribe_audio_chunk(
        self, audio_bytes: bytes, language_hint: str = "ta"
    ) -> str:
        """Transcribe streaming or buffered audio chunk to text."""
        pass


class BaseTextToSpeech(ABC):
    """Abstract interface for Text-to-Speech provider (e.g. Sarvam Bulbul)."""

    @abstractmethod
    async def synthesize_speech(
        self, text: str, language: str = "ta"
    ) -> AsyncGenerator[bytes, None]:
        """Synthesize text into streaming audio bytes."""
        pass

