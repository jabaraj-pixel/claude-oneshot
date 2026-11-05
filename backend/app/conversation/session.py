"""Conversation management module (Worker 1 ownership: worker/voice-telephony).
Maintains dialog turn history, caller context, and tool calling orchestration.
"""
from abc import ABC, abstractmethod
from collections import defaultdict
from typing import Dict, List, Optional
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


class InMemoryConversationStore(BaseConversationStore):
    """Process-local conversation store.

    Development/default implementation: turns live in memory only and are lost
    on restart. A durable store can be added later behind the same interface
    once the Integration Lead approves a shared persistence design.
    """

    def __init__(self) -> None:
        self._turns: Dict[str, List[ConversationTurn]] = defaultdict(list)

    async def add_turn(self, turn: ConversationTurn) -> None:
        self._turns[turn.call_id].append(turn)

    async def get_history(self, call_id: str) -> List[ConversationTurn]:
        return list(self._turns.get(call_id, []))

    def next_turn_index(self, call_id: str) -> int:
        return len(self._turns.get(call_id, []))

    def clear(self, call_id: Optional[str] = None) -> None:
        if call_id is None:
            self._turns.clear()
        else:
            self._turns.pop(call_id, None)

