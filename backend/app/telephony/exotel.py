"""Exotel webhook helpers (Worker 1).

STATUS: NOT LIVE-TESTED — no Exotel credentials/number exist in this
environment. Payload field names follow Exotel's documented call passthrough
(CallSid, CallFrom, CallTo, AccountSid, ...). The stream-connect XML below is
an Exotel-style response; verify the exact applet/verb against the provider
console and docs before pointing a real number at this service.

Validation layers:
  * Required fields: CallSid, CallFrom, CallTo (400 on missing).
  * AccountSid must match EXOTEL_ACCOUNT_SID when configured (403).
  * Optional shared secret: when EXOTEL_WEBHOOK_TOKEN is set, inbound requests
    must carry ?token=<value> (403 otherwise). Non-secret dev mode allows
    unauthenticated local testing and is clearly logged.
"""
import os
from typing import Optional
from xml.sax.saxutils import escape

from backend.app.config import get_settings
from backend.app.core.errors import AppException
from fastapi import status


class TelephonyValidationError(AppException):
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, code: str = "BAD_REQUEST"):
        super().__init__(message=message, code=code, status_code=status_code)


def validate_inbound_payload(payload: dict) -> dict:
    """Normalise and validate an Exotel inbound webhook payload."""
    call_sid = str(payload.get("CallSid") or payload.get("call_sid") or "").strip()
    caller = str(payload.get("CallFrom") or payload.get("call_from") or payload.get("From") or "").strip()
    callee = str(payload.get("CallTo") or payload.get("call_to") or payload.get("To") or "").strip()
    account_sid = str(payload.get("AccountSid") or payload.get("account_sid") or "").strip()

    missing = [name for name, value in (("CallSid", call_sid), ("CallFrom", caller), ("CallTo", callee)) if not value]
    if missing:
        raise TelephonyValidationError(
            f"Missing required inbound field(s): {', '.join(missing)}"
        )

    settings = get_settings()
    if settings.EXOTEL_ACCOUNT_SID:
        if account_sid != settings.EXOTEL_ACCOUNT_SID:
            raise TelephonyValidationError(
                "AccountSid does not match the configured Exotel account.",
                status_code=status.HTTP_403_FORBIDDEN,
                code="FORBIDDEN",
            )
    return {"call_sid": call_sid, "caller": caller, "callee": callee, "account_sid": account_sid}


def validate_webhook_token(token: Optional[str]) -> None:
    expected = os.environ.get("EXOTEL_WEBHOOK_TOKEN", "").strip()
    if expected and token != expected:
        raise TelephonyValidationError(
            "Webhook token missing or invalid.",
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
        )


def public_ws_base_url(request_base_url: str) -> str:
    """Public WebSocket base for the stream URL.

    VOICE_PUBLIC_BASE_URL (e.g. wss://calls.example.com) overrides the derived
    value when running behind a TLS-terminating proxy.
    """
    override = os.environ.get("VOICE_PUBLIC_BASE_URL", "").strip()
    if override:
        return override.rstrip("/")
    base = request_base_url.rstrip("/")
    if base.startswith("https://"):
        return "wss://" + base[len("https://"):]
    if base.startswith("http://"):
        return "ws://" + base[len("http://"):]
    return base


def build_stream_response_xml(call_id: str, ws_base_url: str) -> str:
    """Exotel-style response instructing the carrier to stream call audio.

    NOTE: provider-specific verb — verify against Exotel docs/console before
    production (no live Exotel testing was possible in this environment).
    """
    stream_url = escape(f"{ws_base_url}/telephony/audio/{call_id}", {'"': "&quot;"})
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<Response>\n"
        "  <Connect>\n"
        f'    <Stream url="{stream_url}" />\n'
        "  </Connect>\n"
        "</Response>"
    )
