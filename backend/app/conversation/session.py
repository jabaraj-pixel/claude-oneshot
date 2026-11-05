"""Conversation management module (Worker 1 ownership: worker/voice-telephony).
Maintains dialog turn history, caller context, and tool calling orchestration.
"""
from abc import ABC, abstractmethod
from typing import List, Optional
from backend.app.schemas.shared import ConversationTurn


class BaseConversationStore(ABC):
    """Abstract interface for storing conversational turns and state."""

    @abstractmethod
    async def add_turn(self, turn: ConversationTurn) -> None:
        """Record a conversation turn."""
        pass

    @abstractmethod
    async def get_history(self, call_id: str) -> List[ConversationTurn]:
        """Fetch chronological turns for a given call."""
        pass

