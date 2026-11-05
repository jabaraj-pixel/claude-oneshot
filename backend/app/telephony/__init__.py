"""Telephony module (Worker 1 ownership: worker/voice-telephony).
Handles inbound SIP/PSTN webhooks, call lifecycle, and real-time audio WebSockets.
"""
from typing import Dict, Set
from fastapi import WebSocket


class TelephonyConnectionManager:
    """
    Manages active telephone call WebSocket audio streams.
    Skeletal connection manager ready for Worker 1 to implement streaming protocols.
    """

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, call_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[call_id] = websocket

    def disconnect(self, call_id: str):
        if call_id in self.active_connections:
            del self.active_connections[call_id]

    async def send_audio_chunk(self, call_id: str, data: bytes):
        if call_id in self.active_connections:
            await self.active_connections[call_id].send_bytes(data)

    async def send_json(self, call_id: str, payload: dict):
        if call_id in self.active_connections:
            await self.active_connections[call_id].send_json(payload)

    def is_connected(self, call_id: str) -> bool:
        return call_id in self.active_connections


telephony_manager = TelephonyConnectionManager()

