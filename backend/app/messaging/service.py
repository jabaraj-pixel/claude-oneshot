"""Messaging module (Worker 3 ownership: worker/frontend-messaging).
Dispatches journey summaries via SMS or WhatsApp with verified passenger consent.
"""
from abc import ABC, abstractmethod
from backend.app.schemas.shared import MessageRequest, MessageStatus


class BaseMessagingService(ABC):
    """Abstract interface for messaging providers."""

    @abstractmethod
    async def send_message(self, request: MessageRequest) -> MessageStatus:
        """
        Send summary message over selected channel.
        Caller consent must be checked prior to dispatch.
        """
        pass

