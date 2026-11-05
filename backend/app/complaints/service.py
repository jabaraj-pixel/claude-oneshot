"""Complaints module (Worker 3 ownership: worker/frontend-messaging).
Records passenger complaints and tracks resolution status.
"""
from abc import ABC, abstractmethod
from typing import List, Optional
from backend.app.schemas.shared import ComplaintRecord


class BaseComplaintService(ABC):
    """Abstract interface for recording and querying complaints."""

    @abstractmethod
    async def create_complaint(self, complaint: ComplaintRecord) -> ComplaintRecord:
        """Record a passenger complaint."""
        pass

    @abstractmethod
    async def list_complaints(self, limit: int = 50) -> List[ComplaintRecord]:
        """List recorded complaints for the dashboard."""
        pass

