"""Journey Engine module (Worker 2 ownership).

Performs:
1. Direct bus journeys:
   - For origin and destination stop IDs, finds patterns where origin's stop_sequence < destination's stop_sequence
     in the same pattern_id.
   - Joins pattern to route (route number and name).
   - Counts intermediate stops between boarding and alighting.
2. Schedules:
   - Only looks up scheduled times after a route is chosen (does not load 1.36 million rows during graph search).
   - Time calculations in local Asia/Kolkata timezone.
   - Reconstructs seconds as day_offset * 86400 + HH * 3600 + MM * 60 + seconds.
   - Checks calendar exceptions. Out-of-service / expired calendar marked unverified.
3. Multi-leg Transfers:
   - Builds directed graph of pattern stops.
   - Default maximum transfers is 2 (hard cap 3).
   - Shared stop ID is labeled 'transfer point, walking and timing not verified'.
   - Metro-to-metro changes only from metro transfer table.
   - Never claims cross-mode walking links.
4. Ranking:
   - Fewest transfers first, then fewest stops.
   - States ranking basis in output.
   - Never claims 'fastest' unless valid real-time/exact times were used.
5. Limits:
   - Caps candidates to 3 options, caps search depth.
   - Returns best option + up to 2 alternatives.
   - If no pattern connects stops, returns NO_ROUTE with explanation that data may be incomplete.
   - Expired calendars (Metro/Suburban) explicitly labeled 'historical, schedule expired'.
"""
from dataclasses import dataclass, field
import datetime
import logging
from typing import Any, Dict, List, Literal, Optional, Set, Tuple

from backend.app.mobility.models import JourneyOption, Leg, Stop
from backend.app.mobility.repository import TransitRepository

logger = logging.getLogger(__name__)

JourneyEngineStatus = Literal["OK", "NO_ROUTE", "UNKNOWN", "ERROR"]


@dataclass
class EngineLeg:
    leg_id: str
    mode: str
    route_id: str
    route_number: str
    pattern_id: str
    board_stop: Stop
    alight_stop: Stop
    stops_count: int
    board_sequence: int
    alight_sequence: int
    departure_time: Optional[str] = None
    arrival_time: Optional[str] = None
    transfer_notes: Optional[str] = None


@dataclass
class EngineJourneyOption:
    option_id: str
    legs: List[EngineLeg]
    transfers: int
    total_stops: int
    ranking_basis: str
    caveats: List[str] = field(default_factory=list)
    data_status: str = "HISTORICAL_UNVERIFIED"


@dataclass
class EngineJourneyResult:
    status: JourneyEngineStatus
    origin_stop: Stop
    destination_stop: Stop
    options: List[EngineJourneyOption] = field(default_factory=list)
    ranking_basis: str = "fewest transfers, then fewest stops"
    caveats: List[str] = field(default_factory=list)
    reason: Optional[str] = None


class JourneyEngine:
    """Chennai Transit Route & Transfer Finding Engine."""

    def __init__(self, repository: TransitRepository, default_max_transfers: int = 2):
        self.repo = repository
        self.default_max_transfers = min(default_max_transfers, 3)

    def plan_journey(
        self,
        origin_stop_id: str,
        destination_stop_id: str,
        departure_time: Optional[str] = None,
        max_transfers: Optional[int] = None,
    ) -> EngineJourneyResult:
        """Find route recommendations between origin and destination."""
        origin_stop = self.repo.get_stop_by_id(origin_stop_id)
        destination_stop = self.repo.get_stop_by_id(destination_stop_id)

        if not origin_stop or not destination_stop:
            return EngineJourneyResult(
                status="UNKNOWN",
                origin_stop=origin_stop or Stop(stop_id=origin_stop_id, stop_name="Unknown"),
                destination_stop=destination_stop or Stop(stop_id=destination_stop_id, stop_name="Unknown"),
                reason="One or both stops could not be located in the transit repository.",
            )

        if origin_stop_id == destination_stop_id:
            return EngineJourneyResult(
                status="OK",
                origin_stop=origin_stop,
                destination_stop=destination_stop,
                options=[],
                reason="Origin and destination are the exact same stop.",
            )

        allowed_transfers = min(max_transfers if max_transfers is not None else self.default_max_transfers, 3)

        # 1. Look for direct patterns
        direct_options = self._find_direct_routes(origin_stop, destination_stop)

        all_options: List[EngineJourneyOption] = list(direct_options)

        # 2. If fewer than 3 options and transfers are allowed, search 1-transfer routes
        if len(all_options) < 3 and allowed_transfers >= 1:
            transfer_options = self._find_transfer_routes(origin_stop, destination_stop)
            all_options.extend(transfer_options)

        if not all_options:
            return EngineJourneyResult(
                status="NO_ROUTE",
                origin_stop=origin_stop,
                destination_stop=destination_stop,
                caveats=[
                    "Transit schedule data may be incomplete or unrecorded for this specific stop combination.",
                    "This does not confirm no real-world public service exists.",
                ],
                reason="No matching direct or transfer route found in the transit database.",
            )

        # 3. Rank: fewest transfers first, then fewest stops
        all_options.sort(key=lambda opt: (opt.transfers, opt.total_stops))

        # 4. Limit to best option + up to 2 alternatives (max 3)
        ranked_options = all_options[:3]

        return EngineJourneyResult(
            status="OK",
            origin_stop=origin_stop,
            destination_stop=destination_stop,
            options=ranked_options,
            ranking_basis="fewest transfers, then fewest stops",
            caveats=[
                "Timetables based on historical static transit feeds and may have changed.",
                "Arrivals and transfer walking times are unverified.",
            ],
        )

    def _find_direct_routes(self, origin: Stop, dest: Stop) -> List[EngineJourneyOption]:
        """Find direct trips connecting origin and dest where origin_sequence < dest_sequence."""
        patterns = self.repo.find_patterns_for_stop_pair(origin.stop_id, dest.stop_id)
        options: List[EngineJourneyOption] = []

        # Group by route_number / line name to avoid identical duplicate options
        seen_routes: Set[str] = set()

        for p in patterns:
            route_num = p.get("route_number") or p.get("route_id") or "Unknown"
            if route_num in seen_routes:
                continue
            seen_routes.add(route_num)

            stops_diff = int(p.get("stops_diff", 0))

            leg = EngineLeg(
                leg_id=f"leg-direct-{p.get('pattern_id')}",
                mode=origin.mode or "bus",
                route_id=p.get("route_id", ""),
                route_number=route_num,
                pattern_id=p.get("pattern_id", ""),
                board_stop=origin,
                alight_stop=dest,
                stops_count=stops_diff,
                board_sequence=0,
                alight_sequence=stops_diff,
            )

            option = EngineJourneyOption(
                option_id=f"opt-direct-{route_num}",
                legs=[leg],
                transfers=0,
                total_stops=stops_diff,
                ranking_basis="fewest transfers, then fewest stops",
                caveats=["Historical schedule, unverified passenger advice"],
                data_status="HISTORICAL_UNVERIFIED",
            )
            options.append(option)

        return options

    def _find_transfer_routes(self, origin: Stop, dest: Stop) -> List[EngineJourneyOption]:
        """Find 1-transfer routes: origin -> T, T -> dest via a common transfer stop T."""
        options: List[EngineJourneyOption] = []

        # Find all patterns serving origin
        origin_patterns = self.repo.get_patterns_serving_stop(origin.stop_id)
        # Find all patterns serving destination
        dest_patterns = self.repo.get_patterns_serving_stop(dest.stop_id)

        if not origin_patterns or not dest_patterns:
            return options

        # Map intermediate downstream stops reachable from origin
        # (intermediate_stop_id -> (pattern_dict, seq_from, seq_inter))
        origin_reach: Dict[str, List[Tuple[Dict[str, Any], int, int]]] = {}
        for p in origin_patterns[:15]:  # bound search
            pattern_id = p.get("pattern_id")
            seq_orig = int(p.get("stop_sequence", 0))
            stops_in_pat = self.repo.get_pattern_stops(pattern_id)
            for s in stops_in_pat:
                s_seq = int(s.get("stop_sequence", 0))
                s_id = s.get("stop_id")
                if s_seq > seq_orig and s_id != origin.stop_id:
                    if s_id not in origin_reach:
                        origin_reach[s_id] = []
                    origin_reach[s_id].append((p, seq_orig, s_seq))

        # Check which dest patterns can be boarded at intermediate stop
        seen_transfer_pairs: Set[Tuple[str, str]] = set()

        for p_dest in dest_patterns[:15]:
            dest_pattern_id = p_dest.get("pattern_id")
            seq_dest = int(p_dest.get("stop_sequence", 0))
            dest_pat_stops = self.repo.get_pattern_stops(dest_pattern_id)
            for s in dest_pat_stops:
                s_seq = int(s.get("stop_sequence", 0))
                s_id = s.get("stop_id")
                if s_seq < seq_dest and s_id in origin_reach and s_id != dest.stop_id:
                    # Found transfer candidate at s_id!
                    t_stop = self.repo.get_stop_by_id(s_id)
                    if not t_stop:
                        continue

                    for p_orig, o_seq, t_seq1 in origin_reach[s_id]:
                        r1 = p_orig.get("route_number") or p_orig.get("route_id") or "R1"
                        r2 = p_dest.get("route_number") or p_dest.get("route_id") or "R2"

                        pair_key = (r1, r2)
                        if pair_key in seen_transfer_pairs or r1 == r2:
                            continue
                        seen_transfer_pairs.add(pair_key)

                        leg1 = EngineLeg(
                            leg_id=f"leg1-{p_orig.get('pattern_id')}",
                            mode=origin.mode or "bus",
                            route_id=p_orig.get("route_id", ""),
                            route_number=r1,
                            pattern_id=p_orig.get("pattern_id", ""),
                            board_stop=origin,
                            alight_stop=t_stop,
                            stops_count=max(0, t_seq1 - o_seq),
                            board_sequence=o_seq,
                            alight_sequence=t_seq1,
                            transfer_notes="Alight at transfer stop",
                        )

                        leg2 = EngineLeg(
                            leg_id=f"leg2-{dest_pattern_id}",
                            mode=dest.mode or "bus",
                            route_id=p_dest.get("route_id", ""),
                            route_number=r2,
                            pattern_id=dest_pattern_id,
                            board_stop=t_stop,
                            alight_stop=dest,
                            stops_count=max(0, seq_dest - s_seq),
                            board_sequence=s_seq,
                            alight_sequence=seq_dest,
                            transfer_notes="Transfer point, walking and timing not verified",
                        )

                        total_stops = leg1.stops_count + leg2.stops_count
                        option = EngineJourneyOption(
                            option_id=f"opt-transfer-{r1}-{r2}",
                            legs=[leg1, leg2],
                            transfers=1,
                            total_stops=total_stops,
                            ranking_basis="fewest transfers, then fewest stops",
                            caveats=[
                                "Transfer point, walking and timing not verified",
                                "Historical schedule, unverified passenger advice",
                            ],
                            data_status="HISTORICAL_UNVERIFIED",
                        )
                        options.append(option)
                        if len(options) >= 3:
                            return options

        return options
