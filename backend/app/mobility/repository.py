"""Data Access Layer and Repository for Chennai Transit SQLite database.

Enforces:
1. Read-only SQLite connection (file:...?mode=ro, uri=True).
2. Parameterized queries only.
3. Decoupled TransitRepository interface.
4. Graceful handling of missing database file (starts, reports in diagnostics, returns UNKNOWN).
"""
from abc import ABC, abstractmethod
import logging
from pathlib import Path
import sqlite3
from typing import Any, Dict, List, Optional

from backend.app.mobility.models import (
    Advisory,
    DistanceResult,
    FareResult,
    JourneyOption,
    JourneyResponse,
    Leg,
    Stop,
)

logger = logging.getLogger(__name__)


class TransitRepository(ABC):
    """Abstract interface for transit data access."""

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if database/storage is reachable."""
        pass

    @abstractmethod
    def get_metadata(self) -> Dict[str, str]:
        """Return key-value metadata from storage."""
        pass

    @abstractmethod
    def search_stops(self, query: str, limit: int = 10) -> List[Stop]:
        """Search stops by name or prefix across bus, metro, and suburban modes."""
        pass

    @abstractmethod
    def get_stop_by_id(self, stop_id: str) -> Optional[Stop]:
        """Fetch a specific stop by its namespaced stop_id."""
        pass

    @abstractmethod
    def find_patterns_for_stop_pair(self, origin_stop_id: str, dest_stop_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Find matching patterns between origin and destination stops where origin precedes destination."""
        pass

    @abstractmethod
    def get_trips_for_route(self, route_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch trips for a route."""
        pass

    @abstractmethod
    def get_calendar_for_service(self, service_id: str) -> Optional[Dict[str, Any]]:
        """Fetch calendar entry for a service."""
        pass

    @abstractmethod
    def plan_direct_journey(self, origin_stop_id: str, dest_stop_id: str) -> JourneyResponse:
        """Perform direct journey lookup for a stop pair."""
        pass


class SQLiteTransitRepository(TransitRepository):
    """SQLite implementation of TransitRepository opening in read-only mode."""

    def __init__(self, db_path: str = "data/build/chennai.sqlite"):
        self.db_path = Path(db_path)
        self._meta: Dict[str, str] = {}
        self._available: bool = False
        self._load_error: Optional[str] = None
        self._initialize()

    def _initialize(self):
        """Read _meta table at startup and verify availability."""
        if not self.db_path.exists():
            self._available = False
            self._load_error = f"Database file does not exist at {self.db_path.resolve()}"
            logger.warning("Transit database missing: %s", self._load_error)
            return

        try:
            with self._get_connection() as conn:
                cur = conn.cursor()
                cur.execute("SELECT key, value FROM _meta")
                for row in cur.fetchall():
                    self._meta[row[0]] = row[1]
                self._available = True
                self._load_error = None
                logger.info(
                    "Transit SQLite DB loaded successfully. CSV set SHA256: %s",
                    self._meta.get("csv_set_sha256", "UNKNOWN"),
                )
        except Exception as e:
            self._available = False
            self._load_error = f"Failed to read database: {str(e)}"
            logger.error("Transit DB initialization error: %s", self._load_error)

    def _get_connection(self) -> sqlite3.Connection:
        """Create read-only SQLite connection using URI mode."""
        uri = f"file:{self.db_path.resolve()}?mode=ro"
        conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def is_available(self) -> bool:
        return self._available

    def get_metadata(self) -> Dict[str, str]:
        return dict(self._meta)

    def get_diagnostics(self) -> Dict[str, Any]:
        """Expose operational diagnostics for health check and journey responses."""
        return {
            "database_available": self._available,
            "database_path": str(self.db_path),
            "load_error": self._load_error,
            "meta": self._meta,
        }

    def search_stops(self, query: str, limit: int = 10) -> List[Stop]:
        if not self._available:
            return []

        clean_query = query.strip()
        if not clean_query:
            return []

        # Parameterized query with prefix wildcard
        param = f"%{clean_query}%"
        results: List[Stop] = []

        query_sql = """
            SELECT stop_id, stop_name, stop_name_ta, latitude, longitude,
                   parent_station_id, platform_code, zone_id, source_id, status, 'bus' as mode
            FROM bus_stops
            WHERE stop_name LIKE ? OR stop_id LIKE ?
            UNION ALL
            SELECT stop_id, stop_name, stop_name_ta, latitude, longitude,
                   parent_station_id, platform_code, zone_id, source_id, status, 'metro' as mode
            FROM metro_stations
            WHERE stop_name LIKE ? OR stop_id LIKE ?
            UNION ALL
            SELECT stop_id, stop_name, stop_name_ta, latitude, longitude,
                   parent_station_id, platform_code, zone_id, source_id, status, 'suburban' as mode
            FROM suburban_stations
            WHERE stop_name LIKE ? OR stop_id LIKE ?
            LIMIT ?
        """

        try:
            with self._get_connection() as conn:
                cur = conn.cursor()
                cur.execute(query_sql, (param, param, param, param, param, param, limit))
                for row in cur.fetchall():
                    lat = float(row["latitude"]) if row["latitude"] and row["latitude"] != "" else None
                    lon = float(row["longitude"]) if row["longitude"] and row["longitude"] != "" else None
                    results.append(
                        Stop(
                            stop_id=row["stop_id"],
                            stop_name=row["stop_name"] or row["stop_id"],
                            stop_name_ta=row["stop_name_ta"] or None,
                            latitude=lat,
                            longitude=lon,
                            mode=row["mode"],
                            parent_station_id=row["parent_station_id"] or None,
                            platform_code=row["platform_code"] or None,
                            zone_id=row["zone_id"] or None,
                            source_id=row["source_id"] or "S_MTC_GTFS",
                            data_status=row["status"] or "HISTORICAL_UNVERIFIED",
                        )
                    )
        except Exception as e:
            logger.error("Error searching stops for '%s': %s", query, e)

        return results

    def get_stop_by_id(self, stop_id: str) -> Optional[Stop]:
        if not self._available:
            return None

        clean_id = stop_id.strip()
        query_sql = """
            SELECT stop_id, stop_name, stop_name_ta, latitude, longitude,
                   parent_station_id, platform_code, zone_id, source_id, status, 'bus' as mode
            FROM bus_stops WHERE stop_id = ?
            UNION ALL
            SELECT stop_id, stop_name, stop_name_ta, latitude, longitude,
                   parent_station_id, platform_code, zone_id, source_id, status, 'metro' as mode
            FROM metro_stations WHERE stop_id = ?
            UNION ALL
            SELECT stop_id, stop_name, stop_name_ta, latitude, longitude,
                   parent_station_id, platform_code, zone_id, source_id, status, 'suburban' as mode
            FROM suburban_stations WHERE stop_id = ?
            LIMIT 1
        """
        try:
            with self._get_connection() as conn:
                cur = conn.cursor()
                cur.execute(query_sql, (clean_id, clean_id, clean_id))
                row = cur.fetchone()
                if not row:
                    return None
                lat = float(row["latitude"]) if row["latitude"] and row["latitude"] != "" else None
                lon = float(row["longitude"]) if row["longitude"] and row["longitude"] != "" else None
                return Stop(
                    stop_id=row["stop_id"],
                    stop_name=row["stop_name"] or row["stop_id"],
                    stop_name_ta=row["stop_name_ta"] or None,
                    latitude=lat,
                    longitude=lon,
                    mode=row["mode"],
                    parent_station_id=row["parent_station_id"] or None,
                    platform_code=row["platform_code"] or None,
                    zone_id=row["zone_id"] or None,
                    source_id=row["source_id"] or "S_MTC_GTFS",
                    data_status=row["status"] or "HISTORICAL_UNVERIFIED",
                )
        except Exception as e:
            logger.error("Error fetching stop %s: %s", stop_id, e)
            return None

    def find_patterns_for_stop_pair(self, origin_stop_id: str, dest_stop_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Find matching patterns where origin precedes destination sequence."""
        if not self._available:
            return []

        query_sql = """
            SELECT
                rs1.pattern_id,
                rs1.route_id,
                br.route_number,
                rs1.stop_id AS board_stop,
                rs2.stop_id AS alight_stop,
                (CAST(rs2.stop_sequence AS INTEGER) - CAST(rs1.stop_sequence AS INTEGER)) AS stops_diff,
                rs1.source_id,
                rs1.status
            FROM route_stops rs1
            JOIN route_stops rs2
                ON rs1.pattern_id = rs2.pattern_id
                AND CAST(rs1.stop_sequence AS INTEGER) < CAST(rs2.stop_sequence AS INTEGER)
            JOIN bus_routes br
                ON rs1.route_id = br.route_id
            WHERE rs1.stop_id = ?
              AND rs2.stop_id = ?
            ORDER BY rs1.pattern_id
            LIMIT ?
        """
        results = []
        try:
            with self._get_connection() as conn:
                cur = conn.cursor()
                cur.execute(query_sql, (origin_stop_id, dest_stop_id, limit))
                for row in cur.fetchall():
                    results.append(dict(row))
        except Exception as e:
            logger.error("Error finding patterns for %s -> %s: %s", origin_stop_id, dest_stop_id, e)
        return results

    def get_trips_for_route(self, route_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        if not self._available:
            return []
        query_sql = """
            SELECT trip_id, route_id, service_id, headsign, source_id, status
            FROM bus_trips
            WHERE route_id = ?
            LIMIT ?
        """
        results = []
        try:
            with self._get_connection() as conn:
                cur = conn.cursor()
                cur.execute(query_sql, (route_id, limit))
                for row in cur.fetchall():
                    results.append(dict(row))
        except Exception as e:
            logger.error("Error getting trips for route %s: %s", route_id, e)
        return results

    def get_calendar_for_service(self, service_id: str) -> Optional[Dict[str, Any]]:
        if not self._available:
            return None
        query_sql = """
            SELECT mode, service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
                   start_date, end_date, source_id
            FROM bus_service_calendar
            WHERE service_id = ?
            LIMIT 1
        """
        try:
            with self._get_connection() as conn:
                cur = conn.cursor()
                cur.execute(query_sql, (service_id,))
                row = cur.fetchone()
                return dict(row) if row else None
        except Exception as e:
            logger.error("Error getting calendar for service %s: %s", service_id, e)
            return None

    def plan_direct_journey(self, origin_stop_id: str, dest_stop_id: str) -> JourneyResponse:
        """Perform direct journey resolution with provenance and fallback handling."""
        diagnostics = self.get_diagnostics()

        if not self._available:
            return JourneyResponse(
                status="UNKNOWN",
                reason="data not loaded",
                query_origin=origin_stop_id,
                query_destination=dest_stop_id,
                options=[],
                source_id="S_MTC_GTFS",
                data_status="UNKNOWN",
                diagnostics=diagnostics,
            )

        origin_stop = self.get_stop_by_id(origin_stop_id)
        dest_stop = self.get_stop_by_id(dest_stop_id)

        if not origin_stop or not dest_stop:
            return JourneyResponse(
                status="UNKNOWN",
                reason=f"Stops not found: origin={bool(origin_stop)}, dest={bool(dest_stop)}",
                query_origin=origin_stop_id,
                query_destination=dest_stop_id,
                options=[],
                source_id="S_MTC_GTFS",
                data_status="HISTORICAL_UNVERIFIED",
                diagnostics=diagnostics,
            )

        patterns = self.find_patterns_for_stop_pair(origin_stop_id, dest_stop_id)
        if not patterns:
            return JourneyResponse(
                status="UNKNOWN",
                reason="No direct patterns found in historical GTFS feed",
                query_origin=origin_stop_id,
                query_destination=dest_stop_id,
                options=[],
                source_id="S_MTC_GTFS",
                data_status="HISTORICAL_UNVERIFIED",
                diagnostics=diagnostics,
            )

        options: List[JourneyOption] = []
        for idx, p in enumerate(patterns, 1):
            leg = Leg(
                leg_id=f"leg_{p['pattern_id']}_{idx}",
                mode="bus",
                route_id=p["route_id"],
                route_number=p["route_number"],
                pattern_id=p["pattern_id"],
                board_stop=origin_stop,
                alight_stop=dest_stop,
                stops_count=int(p.get("stops_diff", 0)),
                source_id=p.get("source_id", "S_MTC_GTFS"),
                data_status=p.get("status", "HISTORICAL_UNVERIFIED"),
            )
            option = JourneyOption(
                option_id=f"opt_{p['pattern_id']}",
                legs=[leg],
                transfers=0,
                fare=FareResult(
                    status="UNKNOWN",
                    reason="No verified route-specific stop-to-fare-stage mapping and boundary rules",
                    source_id="S_MTC_FARES",
                    data_status="HISTORICAL_UNVERIFIED",
                ),
                distance=DistanceResult(
                    straight_line_m=None,
                    walking_distance_m=None,
                    method="haversine_candidate",
                    source_id="S_MTC_GTFS",
                    data_status="HISTORICAL_UNVERIFIED",
                ),
                advisories=[
                    Advisory(
                        advisory_id="adv_historical",
                        code="HISTORICAL_SCHEDULE_UNVERIFIED",
                        message_ta="இது வரலாற்றுத் தகவல். தற்போதைய பேருந்து நேரம் சரிபார்க்கப்படவில்லை.",
                        message_en="Historical schedule data. Real-time bus timing not verified.",
                        severity="warning",
                        source_id="S_MTC_GTFS",
                        data_status="HISTORICAL_UNVERIFIED",
                    )
                ],
                source_id=p.get("source_id", "S_MTC_GTFS"),
                data_status=p.get("status", "HISTORICAL_UNVERIFIED"),
            )
            options.append(option)

        return JourneyResponse(
            status="FOUND",
            query_origin=origin_stop_id,
            query_destination=dest_stop_id,
            options=options,
            source_id="S_MTC_GTFS",
            data_status="HISTORICAL_UNVERIFIED",
            diagnostics=diagnostics,
        )
