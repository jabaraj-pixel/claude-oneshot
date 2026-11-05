"""Voice provider errors (Worker 1)."""
from fastapi import status

from backend.app.core.errors import AppException


class VoiceProviderError(AppException):
    """Upstream STT/TTS provider failure (timeout, bad response, auth)."""

    def __init__(self, message: str, details=None):
        super().__init__(
            message=message,
            code="VOICE_PROVIDER_ERROR",
            status_code=status.HTTP_502_BAD_GATEWAY,
            details=details,
        )
