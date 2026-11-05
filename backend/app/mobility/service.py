"""Mobility backend module (Worker 2 ownership: worker/mobility-backend).
Performs Chennai transit GTFS route discovery, origin-destination matching, and stops lookup.
"""
from abc import ABC, abstractmethod
from typing import List
from backend.app.schemas.shared import JourneyRequest, JourneyResult


class BaseMobilityEngine(ABC):
    """Abstract interface for Chennai transit route lookup engine."""

    @abstractmethod
    async def search_routes(self, request: JourneyRequest) -> JourneyResult:
        """Find transit route recommendations between origin and destination."""
        pass

    @abstractmethod
    async def search_stops(self, query: str, limit: int = 10) -> List[dict]:
        """Search transit stops by name or landmark."""
        pass

