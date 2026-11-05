"""Shared test doubles for Worker 1 voice/telephony tests.

#####################################################################
# MOCK DATA ONLY — NOT VERIFIED TRANSIT INFORMATION.                  #
# Route numbers like "TEST-1" below are fictional placeholders used   #
# to prove the dialogue speaks the mobility engine's response         #
# verbatim. Real duplicated stop names/IDs (Alandur Depot) are cited  #
# from the chennai_transport research package bus_stops.csv and are   #
# HISTORICAL_UNVERIFIED.                                              #
#####################################################################
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional

from backend.app.conversation.mobility_client import BaseMobilityClient
from backend.app.schemas.shared import DataFreshness, JourneyRequest, JourneyResult, RouteOption

MOCK_SOURCE = "MOCK FIXTURE ONLY - NOT LIVE DATA"


def mock_freshness(is_live: bool = False) -> DataFreshness:
    return DataFreshness(
        source=MOCK_SOURCE,
        last_updated=datetime(2026, 11, 5, tzinfo=timezone.utc),
        is_live=is_live,
        notes="Test fixture. Not for passenger dispatch.",
    )


def mock_journey_result(
    origin: str = "Tambaram",
    destination: str = "T. Nagar",
    found: bool = True,
    language: str = "en",
) -> JourneyResult:
    options: List[RouteOption] = []
    if found:
        options.append(
            RouteOption(
                option_id="opt-mock-test-1",
                mode="bus",
                route_numbers=["TEST-1"],
                origin_stop=origin,
                destination_stop=destination,
                transfers=0,
                estimated_duration_minutes=45,
                fare_estimate_inr=None,  # fares unverified → never quoted
                instructions_tamil="இது ஒரு சோதனை வழி மட்டுமே (TEST-1).",
                instructions_english="This is a mock test route only (TEST-1).",
                freshness=mock_freshness(),
            )
        )
    return JourneyResult(
        query=JourneyRequest(origin=origin, destination=destination, language=language),
        found=found,
        options=options,
        spoken_summary_ta=f"{origin} இலிருந்து {destination} க்கு TEST-1 சோதனை பேருந்து உள்ளது (மாதிரி தரவு மட்டும்).",
        spoken_summary_en=f"Mock test bus TEST-1 runs from {origin} to {destination} (sample fixture only).",
        disclaimer="MOCK FIXTURE ONLY - NOT FOR OFFICIAL DISPATCH.",
    )


# Real duplicated stop nodes from the research package (HISTORICAL_UNVERIFIED):
# same name, different coordinates — must NOT be auto-merged.
ALANDUR_DEPOT_CANDIDATES = [
    {"stop_id": "MTC:11", "stop_name": "Alandur Depot", "stop_name_tamil": "ஆலந்தூர் டிப்போ",
     "latitude": 12.99708, "longitude": 80.19136, "modes": ["bus"]},
    {"stop_id": "MTC:8936", "stop_name": "Alandur Depot", "stop_name_tamil": "ஆலந்தூர் டிப்போ",
     "latitude": 12.99584, "longitude": 80.18871, "modes": ["bus"]},
    {"stop_id": "MTC:8929", "stop_name": "Alandur Depot", "stop_name_tamil": "ஆலந்தூர் டிப்போ",
     "latitude": 12.99719, "longitude": 80.19060, "modes": ["bus"]},
]


class FakeMobilityClient(BaseMobilityClient):
    """Configurable mock mobility engine for dialogue tests (labelled above)."""

    def __init__(
        self,
        stops: Optional[Dict[str, List[dict]]] = None,
        journey: Optional[JourneyResult] = None,
        route_error: Optional[Exception] = None,
        stops_error: Optional[Exception] = None,
        auto_single_stop: bool = True,
    ):
        self.stops = {k.lower(): v for k, v in (stops or {}).items()}
        self.journey = journey
        self.route_error = route_error
        self.stops_error = stops_error
        self.auto_single_stop = auto_single_stop
        self.route_requests: List[JourneyRequest] = []
        self.stop_queries: List[str] = []

    async def search_stops(self, query: str, limit: int = 5) -> List[dict]:
        self.stop_queries.append(query)
        if self.stops_error is not None:
            raise self.stops_error
        key = query.strip().lower()
        if key in self.stops:
            return self.stops[key][:limit]
        if self.auto_single_stop:
            return [{"stop_id": f"MOCK:{key}", "stop_name": query.strip(),
                     "stop_name_tamil": None, "modes": ["bus"]}]
        return []

    async def search_routes(self, request: JourneyRequest) -> JourneyResult:
        self.route_requests.append(request)
        if self.route_error is not None:
            raise self.route_error
        if self.journey is not None:
            return self.journey
        return mock_journey_result(request.origin, request.destination, language=request.language)
