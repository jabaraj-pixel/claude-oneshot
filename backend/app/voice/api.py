"""Voice turn API (Worker 1) — POST /api/voice/turn per docs/API_CONTRACTS.md §3.

Provider-independent: text_input drives the dialogue without any credentials.
audio_base64 requires a configured STT provider (else HTTP 501
INTEGRATION_NOT_CONFIGURED). response_audio_url stays null in this revision —
synthesised audio is streamed over the telephony WebSocket, not stored.
"""
import base64
import binascii
from typing import Optional

from fastapi import APIRouter, Depends, status

from backend.app.conversation.manager import ConversationManager
from backend.app.conversation.runtime import conversation_manager
from backend.app.core.errors import AppException, IntegrationNotConfiguredError
from backend.app.voice.base import BaseSpeechToText
from backend.app.voice.errors import VoiceProviderError
from backend.app.voice.factory import build_stt
from backend.app.voice.schemas import VoiceTurnRequest, VoiceTurnResponse

router = APIRouter()


def get_conversation_manager() -> ConversationManager:
    """FastAPI dependency — override in tests to inject an isolated manager."""
    return conversation_manager


def get_stt() -> Optional[BaseSpeechToText]:
    """FastAPI dependency — None when no STT provider is configured."""
    return build_stt()


@router.post(
    "/turn",
    response_model=VoiceTurnResponse,
    status_code=status.HTTP_200_OK,
    summary="Process one conversational turn (text or audio)",
    responses={
        400: {"description": "Invalid audio payload"},
        422: {"description": "Validation failed (neither text nor audio supplied)"},
        501: {"description": "STT provider not configured for audio input"},
        502: {"description": "Speech provider failure"},
    },
)
async def process_voice_turn(
    request: VoiceTurnRequest,
    manager: ConversationManager = Depends(get_conversation_manager),
    stt: Optional[BaseSpeechToText] = Depends(get_stt),
) -> VoiceTurnResponse:
    text = (request.text_input or "").strip()

    if not text and request.audio_base64:
        if stt is None:
            raise IntegrationNotConfiguredError(
                "Sarvam AI STT",
                message="Audio input requires SARVAM_API_KEY (or VOICE_USE_MOCK=1 for development). "
                "Text dialogue via text_input works without credentials.",
            )
        try:
            audio_bytes = base64.b64decode(request.audio_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise AppException(
                message="audio_base64 is not valid base64 data.",
                code="BAD_REQUEST",
                status_code=status.HTTP_400_BAD_REQUEST,
            ) from exc
        try:
            text = await stt.transcribe_audio_chunk(
                audio_bytes, language_hint=request.language_hint or "ta"
            )
        except VoiceProviderError:
            raise
        except Exception as exc:  # provider adapter contract violations
            raise VoiceProviderError(f"STT adapter failure: {exc}") from exc

    dialogue = await manager.process_turn(
        call_id=request.call_id,
        text=text,
        language_hint=request.language_hint,
    )
    return VoiceTurnResponse(
        turn=dialogue.turn,
        suggested_actions=dialogue.suggested_actions,
        response_audio_url=None,
        response_text=dialogue.response_text,
    )
