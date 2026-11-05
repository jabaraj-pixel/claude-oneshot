"""Telephony endpoints (Worker 1) — docs/API_CONTRACTS.md §4-6.

  * POST /telephony/inbound        Exotel inbound webhook → stream XML
  * POST /telephony/call-completed call lifecycle completion (idempotent)
  * WS   /telephony/audio/{id}     bidirectional audio + JSON control frames

Mounting: these paths are ROOT-level per the authoritative API contract, so
the router must be mounted in backend/app/main.py (Integration Lead owned).
The exact one-line diff is documented in backend/app/conversation/README.md;
backend/app/telephony/devapp.py provides a fully-wired development harness in
the meantime. Real-phone behaviour is NOT live-tested (no Exotel credentials).
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, Request, Response, WebSocket, WebSocketDisconnect, status

from backend.app.conversation.call_records import UNKNOWN_CALLER
from backend.app.conversation.manager import ConversationManager
from backend.app.conversation.runtime import conversation_manager
from backend.app.core.errors import ResourceNotFoundError
from backend.app.core.logging import logger
from backend.app.telephony import telephony_manager
from backend.app.telephony.exotel import (
    build_stream_response_xml,
    public_ws_base_url,
    validate_inbound_payload,
    validate_webhook_token,
)
from backend.app.telephony.schemas import CallCompletedRequest, CallCompletedResponse
from backend.app.voice.base import BaseSpeechToText, BaseTextToSpeech
from backend.app.voice.errors import VoiceProviderError
from backend.app.voice.factory import build_stt, build_tts

router = APIRouter()

MAX_AUDIO_BUFFER_BYTES = 8 * 1024 * 1024  # ~4 min of 16 kHz 16-bit mono


def get_conversation_manager() -> ConversationManager:
    return conversation_manager


@router.post(
    "/inbound",
    summary="Exotel inbound call webhook",
    response_class=Response,
    responses={
        200: {"content": {"application/xml": {}}, "description": "Stream connect instructions"},
        400: {"description": "Missing required provider fields"},
        403: {"description": "AccountSid/token mismatch"},
    },
)
async def telephony_inbound(
    request: Request,
    token: Optional[str] = None,
    manager: ConversationManager = Depends(get_conversation_manager),
) -> Response:
    validate_webhook_token(token)

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            payload = await request.json()
        except ValueError:
            payload = {}
        if not isinstance(payload, dict):
            payload = {}
    else:
        form = await request.form()
        payload = dict(form)

    validated = validate_inbound_payload(payload)
    call_id = validated["call_sid"]

    # Duplicate provider events are idempotent: same call → same instructions,
    # no second session, no state reset.
    is_new = manager.call_records.mark_event_processed(f"inbound:{call_id}")
    session = manager.call_records.ensure_session(
        call_id,
        caller_phone=validated["caller"],
        metadata={
            "telephony_provider": "exotel",
            "exotel_call_to": validated["callee"],
        },
    )
    if is_new:
        logger.info("Inbound call %s from %s", call_id, validated["caller"])
    else:
        logger.info("Duplicate inbound event for call %s ignored", call_id)

    ws_base = public_ws_base_url(str(request.base_url))
    xml = build_stream_response_xml(call_id, ws_base)
    return Response(content=xml, media_type="application/xml", status_code=status.HTTP_200_OK)


@router.post(
    "/call-completed",
    response_model=CallCompletedResponse,
    summary="Record call completion (idempotent)",
    responses={404: {"description": "Unknown call_id"}},
)
async def telephony_call_completed(
    request: CallCompletedRequest,
    manager: ConversationManager = Depends(get_conversation_manager),
) -> CallCompletedResponse:
    session = manager.call_records.get(request.call_id)
    if session is None:
        raise ResourceNotFoundError("Call", request.call_id)

    # Record provider completion data first (duration, recording), then mark
    # the dialogue state ended. CallRecordStore.complete is idempotent, so the
    # end_session call below will not overwrite the provider's numbers.
    updated = manager.call_records.complete(
        request.call_id,
        duration_seconds=request.duration_seconds,
        termination_reason=request.termination_reason or "provider_completed",
        recording_url=request.recording_url,
    )
    manager.end_session(request.call_id, reason=request.termination_reason or "provider_completed")
    return CallCompletedResponse(status="recorded", session=updated or session)


@router.websocket("/audio/{call_id}")
async def telephony_audio_stream(
    websocket: WebSocket,
    call_id: str,
    manager: ConversationManager = Depends(get_conversation_manager),
) -> None:
    """Bidirectional call audio per contract §5.

    Inbound: binary PCM/µ-law frames + JSON control frames
    ({"event":"start"...}, {"event":"utterance_end"}, {"event":"stop"}).
    Outbound: synthesised audio binary frames + JSON status/text frames.

    Without STT credentials the stream stays usable for control events and
    reports INTEGRATION_NOT_CONFIGURED for audio, instead of crashing.
    """
    await telephony_manager.connect(call_id, websocket)
    manager.call_records.ensure_session(call_id, caller_phone=UNKNOWN_CALLER)
    stt: Optional[BaseSpeechToText] = build_stt()
    tts: Optional[BaseTextToSpeech] = build_tts()
    buffer = bytearray()
    started = False

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break

            if (data := message.get("bytes")) is not None:
                if len(buffer) + len(data) > MAX_AUDIO_BUFFER_BYTES:
                    buffer.clear()
                    await websocket.send_json(
                        {"event": "error", "code": "AUDIO_BUFFER_OVERFLOW",
                         "message": "Audio buffer limit exceeded; buffer cleared."}
                    )
                    continue
                buffer.extend(data)
                continue

            if (raw := message.get("text")) is not None:
                try:
                    control = json.loads(raw)
                    if not isinstance(control, dict):
                        raise ValueError("Control frame must be a JSON object")
                except ValueError:
                    await websocket.send_json(
                        {"event": "error", "code": "VALIDATION_ERROR",
                         "message": "Invalid JSON control frame."}
                    )
                    continue

                event = control.get("event")
                if event == "start":
                    started = True  # duplicate start events are harmless
                    await websocket.send_json(
                        {"event": "ready", "call_id": call_id,
                         "stt_configured": stt is not None, "tts_configured": tts is not None}
                    )
                elif event == "utterance_end":
                    await _process_utterance(websocket, manager, call_id, stt, tts, buffer)
                    buffer.clear()
                    state = manager.get_state(call_id)
                    if state is not None and state.status == "ended":
                        await websocket.send_json({"event": "stopped", "call_id": call_id})
                        break
                elif event == "stop":
                    manager.end_session(call_id, reason="stream_stop")
                    await websocket.send_json({"event": "stopped", "call_id": call_id})
                    break
                else:
                    await websocket.send_json(
                        {"event": "error", "code": "VALIDATION_ERROR",
                         "message": f"Unknown control event: {event!r}"}
                    )
    except WebSocketDisconnect:
        pass
    finally:
        telephony_manager.disconnect(call_id)
        if started:
            manager.end_session(call_id, reason="stream_disconnected")


async def _process_utterance(
    websocket: WebSocket,
    manager: ConversationManager,
    call_id: str,
    stt: Optional[BaseSpeechToText],
    tts: Optional[BaseTextToSpeech],
    buffer: bytearray,
) -> None:
    if not buffer:
        await websocket.send_json(
            {"event": "error", "code": "EMPTY_AUDIO", "message": "No audio buffered for this utterance."}
        )
        return
    if stt is None:
        await websocket.send_json(
            {"event": "error", "code": "INTEGRATION_NOT_CONFIGURED",
             "message": "STT provider not configured; set SARVAM_API_KEY or VOICE_USE_MOCK=1."}
        )
        return
    try:
        transcript = await stt.transcribe_audio_chunk(bytes(buffer))
    except VoiceProviderError as exc:
        await websocket.send_json({"event": "error", "code": exc.code, "message": exc.message})
        return

    dialogue = await manager.process_turn(call_id, transcript)
    await websocket.send_json(
        {
            "event": "response",
            "call_id": call_id,
            "transcript": transcript,
            "response_text": dialogue.response_text,
            "response_language": dialogue.response_language,
            "next_action": dialogue.next_action,
        }
    )
    if tts is not None:
        try:
            async for chunk in tts.synthesize_speech(dialogue.response_text, dialogue.response_language):
                await websocket.send_bytes(chunk)
        except VoiceProviderError as exc:
            await websocket.send_json({"event": "error", "code": exc.code, "message": exc.message})
