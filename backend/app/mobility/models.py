"""Pydantic data models for the Chennai Transit Mobility data access layer.

Every model carries data provenance (source_id, data_status, retrieved_on).
"""
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class TransitBaseModel(BaseModel):
    """Base model enforcing data provenance tracking."""
    source_id: str = Field(default="S_MTC_GTFS", description="Source identifier from SOURCE_REGISTER")
    data_status: str = Field(default="HISTORICAL_UNVERIFIED", description="Verification level (e.g. HISTORICAL_UNVERIFIED)")
    retrieved_on: Optional[str] = Field(default="2026-11-05", description="ISO date when underlying dataset was retrieved")


class Stop(TransitBaseModel):
    """Transit stop or station."""
    stop_id: str = Field(..., description="Namespaced stop identifier (e.g. MTC:5738)")
    stop_name: str = Field(..., description="Stop or station name in English")
    stop_name_ta: Optional[str] = Field(None, description="Stop or station name in Tamil")
    latitude: Optional[float] = Field(None, description="WGS84 latitude")
    longitude: Optional[float] = Field(None, description="WGS84 longitude")
    mode: str = Field(default="bus", description="Transit mode (bus, metro, suburban)")
    parent_station_id: Optional[str] = Field(None, description="Parent station if hierarchical")
    platform_code: Optional[str] = Field(None, description="Platform identifier if available")
    zone_id: Optional[str] = Field(None, description="Fare zone identifier")


class Leg(TransitBaseModel):
    """A segment or leg of a journey."""
    leg_id: str = Field(..., description="Unique leg identifier")
    mode: str = Field(..., description="Transit mode for this leg (bus, metro, suburban, walk)")
    route_id: Optional[str] = Field(None, description="Route identifier")
    route_number: Optional[str] = Field(None, description="Public route number / line name")
    trip_id: Optional[str] = Field(None, description="Trip identifier")
    pattern_id: Optional[str] = Field(None, description="Sequence pattern identifier")
    board_stop: Stop = Field(..., description="Boarding stop")
    alight_stop: Stop = Field(..., description="Alighting stop")
    departure_time: Optional[str] = Field(None, description="Scheduled departure local clock time HH:MM")
    arrival_time: Optional[str] = Field(None, description="Scheduled arrival local clock time HH:MM")
    stops_count: int = Field(default=0, ge=0, description="Number of intermediate stops")


class Advisory(TransitBaseModel):
    """Advisory, caveat or known limitation notice."""
    advisory_id: str = Field(..., description="Unique advisory identifier")
    code: str = Field(..., description="Advisory classification code")
    message_ta: str = Field(..., description="Advisory text in Tamil")
    message_en: str = Field(..., description="Advisory text in English")
    severity: Literal["info", "warning", "critical"] = Field(default="warning")


class FareResult(TransitBaseModel):
    """Fare estimation result with calculation status."""
    status: Literal["AVAILABLE", "UNKNOWN"] = Field(
        default="UNKNOWN", description="Whether fare calculation was possible"
    )
    reason: Optional[str] = Field(None, description="Explanation if fare is UNKNOWN")
    amount_inr: Optional[float] = Field(None, description="Fare in Indian Rupees if calculated")
    service_category: Optional[str] = Field(None, description="MTC or transit service category")
    currency: str = Field(default="INR")


class DistanceResult(TransitBaseModel):
    """Distance computation between stops."""
    straight_line_m: Optional[float] = Field(None, description="Haversine straight-line distance in metres")
    walking_distance_m: Optional[float] = Field(None, description="Verified pedestrian walking distance in metres")
    method: str = Field(default="haversine_candidate", description="Calculation method or proxy used")


class JourneyOption(TransitBaseModel):
    """A single complete journey option composed of one or more legs."""
    option_id: str = Field(..., description="Unique journey option candidate ID")
    legs: List[Leg] = Field(default_factory=list, description="Ordered trip legs")
    transfers: int = Field(default=0, ge=0, description="Number of transfers")
    fare: FareResult = Field(default_factory=FareResult, description="Fare information")
    distance: DistanceResult = Field(default_factory=DistanceResult, description="Distance information")
    advisories: List[Advisory] = Field(default_factory=list, description="Associated warnings/advisories")


class JourneyResponse(TransitBaseModel):
    """Complete response returned by journey queries."""
    status: Literal["FOUND", "UNKNOWN", "NEEDS_CLARIFICATION"] = Field(..., description="Journey resolution status")
    reason: Optional[str] = Field(None, description="Explanation if status is UNKNOWN or NEEDS_CLARIFICATION")
    query_origin: str = Field(..., description="Original origin input")
    query_destination: str = Field(..., description="Original destination input")
    options: List[JourneyOption] = Field(default_factory=list, description="Candidate options")
    disclaimer: str = Field(
        default="Research and historical GTFS data only. Not verified for operational passenger advice.",
        description="Public transit disclaimer"
    )
    diagnostics: Dict[str, Any] = Field(default_factory=dict, description="Metadata and repository diagnostics")
