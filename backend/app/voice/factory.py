"""Speech provider selection (Worker 1).

Modes:
  * SARVAM_API_KEY set        → real Sarvam adapters (not live-tested here).
  * VOICE_USE_MOCK=1          → explicitly labelled mock adapters for dev/tests.
  * neither                   → None → callers raise INTEGRATION_NOT_CONFIGURED
                                  (HTTP 501) for audio; text dialogue still works.

VOICE_USE_MOCK is a non-secret dev switch read from the environment; adopting
it into backend/app/config.py is proposed in the module README for the
Integration Lead.
"""
import os
from typing import Optional

from backend.app.config import get_settings
from backend.app.core.logging import logger
from backend.app.voice.base import BaseSpeechToText, BaseTextToSpeech
from backend.app.voice.mock import MockSpeechToText, MockTextToSpeech
from backend.app.voice.sarvam import SarvamSpeechToText, SarvamTextToSpeech


def _mock_enabled() -> bool:
    return os.environ.get("VOICE_USE_MOCK", "").strip() == "1"


def build_stt() -> Optional[BaseSpeechToText]:
    if _mock_enabled():
        logger.warning("VOICE_USE_MOCK=1 — using MOCK STT (not real recognition)")
        return MockSpeechToText()
    key = get_settings().SARVAM_API_KEY
    if key:
        return SarvamSpeechToText(key)
    return None


def build_tts() -> Optional[BaseTextToSpeech]:
    if _mock_enabled():
        logger.warning("VOICE_USE_MOCK=1 — using MOCK TTS (silence, not real speech)")
        return MockTextToSpeech()
    key = get_settings().SARVAM_API_KEY
    if key:
        return SarvamTextToSpeech(key)
    return None
