import os
from pathlib import Path
import sqlite3
import pytest

from backend.app.mobility.models import (
    Advisory,
    DistanceResult,
    FareResult,
    JourneyOption,
    JourneyResponse,
    Leg,
    Stop,
)
from backend.app.mobility.repository import (
    SQLiteTransitRepository,
    TransitRepository,
)


@pytest.fixture
def tiny_fixture_db(tmp_path: Path) -> str:
    """Create a tiny isolated SQLite transit database fixture."""
    db_file = tmp_path / "tiny_transit.sqlite"
    conn = sqlite3.connect(str(db_file))
    cur = conn.cursor()

    # Create _meta table
    cur.execute("CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT)")
    cur.execute("INSERT INTO _meta VALUES ('csv_set_sha256', 'fixture_test_hash_12345')")
    cur.execute("INSERT INTO _meta VALUES ('version', '0.1.0-test')")

    # Create bus_stops table
    cur.execute("""
        CREATE TABLE bus_stops (
            stop_id TEXT, stop_name TEXT, stop_name_ta TEXT, latitude TEXT, longitude TEXT,
            parent_station_id TEXT, platform_code TEXT, zone_id TEXT, source_id TEXT, status TEXT
        )
    """)
    cur.execute("""
        INSERT INTO bus_stops VALUES
        ('MTC:5738', 'Porur', 'போரூர்', '13.033', '80.158', '', '', '', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED'),
        ('MTC:1465', 'Guindy Railway Station', 'கிண்டி', '13.008', '80.213', '', '', '', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED'),
        ('MTC:9999', 'Tambaram', 'தாம்பரம்', '12.924', '80.100', '', '', '', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')
    """)

    # Create metro_stations table
    cur.execute("""
        CREATE TABLE metro_stations (
            stop_id TEXT, stop_name TEXT, stop_name_ta TEXT, latitude TEXT, longitude TEXT,
            parent_station_id TEXT, platform_code TEXT, zone_id TEXT, source_id TEXT, status TEXT
        )
    """)
    cur.execute("""
        INSERT INTO metro_stations VALUES
        ('CMRL:M01', 'Vadapalani', 'வடபழனி', '13.050', '80.210', '', '', '', 'S_CMRL_GTFS', 'HISTORICAL_UNVERIFIED')
    """)

    # Create suburban_stations table
    cur.execute("""
        CREATE TABLE suburban_stations (
            stop_id TEXT, stop_name TEXT, stop_name_ta TEXT, latitude TEXT, longitude TEXT,
            parent_station_id TEXT, platform_code TEXT, zone_id TEXT, source_id TEXT, status TEXT
        )
    """)
    cur.execute("""
        INSERT INTO suburban_stations VALUES
        ('SRR:S01', 'Chennai Beach', 'சென்னை கடற்கரை', '13.090', '80.290', '', '', '', 'S_SRR_GTFS', 'HISTORICAL_UNVERIFIED')
    """)

    # Create bus_routes table
    cur.execute("""
        CREATE TABLE bus_routes (
            route_id TEXT, original_route_id TEXT, route_number TEXT, route_name TEXT,
            route_type_gtfs TEXT, agency_id TEXT, source_id TEXT, status TEXT
        )
    """)
    cur.execute("""
        INSERT INTO bus_routes VALUES
        ('MTC:10865', '10865', 'S27', 'Porur - Guindy', '3', 'MTC', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED'),
        ('MTC:13325', '13325', 'S27', 'Porur - Guindy Express', '3', 'MTC', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')
    """)

    # Create route_stops table
    cur.execute("""
        CREATE TABLE route_stops (
            pattern_id TEXT, route_id TEXT, representative_trip_id TEXT, direction_id_gtfs TEXT,
            stop_sequence TEXT, stop_id TEXT, source_id TEXT, status TEXT
        )
    """)
    cur.execute("""
        INSERT INTO route_stops VALUES
        ('MTC:71111', 'MTC:10865', 'TRIP_1', '0', '1', 'MTC:5738', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED'),
        ('MTC:71111', 'MTC:10865', 'TRIP_1', '0', '10', 'MTC:1465', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED'),
        ('MTC:71113', 'MTC:13325', 'TRIP_2', '0', '1', 'MTC:5738', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED'),
        ('MTC:71113', 'MTC:13325', 'TRIP_2', '0', '8', 'MTC:1465', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')
    """)

    # Create bus_trips and bus_service_calendar tables
    cur.execute("""
        CREATE TABLE bus_trips (
            trip_id TEXT, original_trip_id TEXT, route_id TEXT, service_id TEXT,
            direction_id_gtfs TEXT, headsign TEXT, shape_id TEXT, source_id TEXT, status TEXT
        )
    """)
    cur.execute("INSERT INTO bus_trips VALUES ('TRIP_1', 'T1', 'MTC:10865', 'MTC:CAL1', '0', 'Guindy', '', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")

    cur.execute("""
        CREATE TABLE bus_service_calendar (
            mode TEXT, service_id TEXT, original_service_id TEXT,
            monday TEXT, tuesday TEXT, wednesday TEXT, thursday TEXT, friday TEXT, saturday TEXT, sunday TEXT,
            start_date TEXT, end_date TEXT, source_id TEXT
        )
    """)
    cur.execute("INSERT INTO bus_service_calendar VALUES ('mtc', 'MTC:CAL1', 'CAL1', '1', '1', '1', '1', '1', '1', '0', '2026-01-01', '2026-12-31', 'S_MTC_GTFS')")

    conn.commit()
    conn.close()
    return str(db_file)


def test_models_provenance_enforcement():
    """Verify all models carry source_id, data_status, and retrieved_on."""
    stop = Stop(
        stop_id="MTC:5738",
        stop_name="Porur",
        source_id="S_MTC_GTFS",
        data_status="HISTORICAL_UNVERIFIED",
        retrieved_on="2026-11-05",
    )
    assert stop.source_id == "S_MTC_GTFS"
    assert stop.data_status == "HISTORICAL_UNVERIFIED"
    assert stop.retrieved_on == "2026-11-05"

    fare = FareResult()
    assert fare.source_id == "S_MTC_GTFS"
    assert fare.data_status == "HISTORICAL_UNVERIFIED"
    assert fare.status == "UNKNOWN"

    dist = DistanceResult()
    assert dist.source_id == "S_MTC_GTFS"
    assert dist.data_status == "HISTORICAL_UNVERIFIED"


def test_repository_interface_and_meta_read(tiny_fixture_db: str):
    """Verify TransitRepository interface and _meta reading from tiny fixture."""
    repo: TransitRepository = SQLiteTransitRepository(db_path=tiny_fixture_db)
    assert repo.is_available() is True

    meta = repo.get_metadata()
    assert meta.get("csv_set_sha256") == "fixture_test_hash_12345"
    assert meta.get("version") == "0.1.0-test"


def test_stop_search_and_get_by_id(tiny_fixture_db: str):
    """Verify parameterized stop search across modes."""
    repo = SQLiteTransitRepository(db_path=tiny_fixture_db)

    # Search by name
    stops = repo.search_stops("Porur")
    assert len(stops) == 1
    assert stops[0].stop_id == "MTC:5738"
    assert stops[0].mode == "bus"

    # Search metro
    metro_stops = repo.search_stops("Vadapalani")
    assert len(metro_stops) == 1
    assert metro_stops[0].mode == "metro"

    # Search suburban
    sub_stops = repo.search_stops("Chennai Beach")
    assert len(sub_stops) == 1
    assert sub_stops[0].mode == "suburban"

    # Fetch by ID
    single = repo.get_stop_by_id("MTC:1465")
    assert single is not None
    assert single.stop_name == "Guindy Railway Station"


def test_patterns_for_stop_pair(tiny_fixture_db: str):
    """Verify matching patterns for Porur to Guindy (MTC:71111 and MTC:71113)."""
    repo = SQLiteTransitRepository(db_path=tiny_fixture_db)
    patterns = repo.find_patterns_for_stop_pair("MTC:5738", "MTC:1465")

    assert len(patterns) == 2
    pattern_ids = [p["pattern_id"] for p in patterns]
    assert "MTC:71111" in pattern_ids
    assert "MTC:71113" in pattern_ids
    assert all(p["status"] == "HISTORICAL_UNVERIFIED" for p in patterns)


def test_direct_journey_planning(tiny_fixture_db: str):
    """Verify plan_direct_journey returns structured JourneyResponse with provenance."""
    repo = SQLiteTransitRepository(db_path=tiny_fixture_db)
    resp: JourneyResponse = repo.plan_direct_journey("MTC:5738", "MTC:1465")

    assert resp.status == "FOUND"
    assert len(resp.options) == 2
    assert resp.options[0].legs[0].route_number == "S27"
    assert resp.options[0].fare.status == "UNKNOWN"
    assert resp.options[0].advisories[0].code == "HISTORICAL_SCHEDULE_UNVERIFIED"


def test_missing_database_graceful_handling():
    """Verify missing database starts safely, returns UNKNOWN (reason: data not loaded)."""
    repo = SQLiteTransitRepository(db_path="non_existent/path/chennai.sqlite")
    assert repo.is_available() is False

    diag = repo.get_diagnostics()
    assert diag["database_available"] is False
    assert "does not exist" in diag["load_error"]

    # Journey lookup should gracefully return UNKNOWN
    resp = repo.plan_direct_journey("MTC:5738", "MTC:1465")
    assert resp.status == "UNKNOWN"
    assert resp.reason == "data not loaded"
    assert resp.diagnostics["database_available"] is False
