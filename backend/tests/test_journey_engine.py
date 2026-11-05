from pathlib import Path
import sqlite3
import pytest

from backend.app.mobility.engine import JourneyEngine
from backend.app.mobility.repository import SQLiteTransitRepository


@pytest.fixture
def journey_fixture_repo(tmp_path: Path):
    """Fixture creating stops, routes, and route_stops matching chennai_db structure."""
    db_file = tmp_path / "journey_test.sqlite"
    conn = sqlite3.connect(str(db_file))
    cur = conn.cursor()

    cur.execute("CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT)")
    cur.execute("INSERT INTO _meta VALUES ('schema_version', '1.0')")

    cur.execute("""
        CREATE TABLE bus_stops (
            stop_id TEXT, stop_name TEXT, stop_name_ta TEXT, latitude TEXT, longitude TEXT,
            parent_station_id TEXT, platform_code TEXT, zone_id TEXT, source_id TEXT, status TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE metro_stations (
            stop_id TEXT, stop_name TEXT, stop_name_ta TEXT, latitude TEXT, longitude TEXT,
            parent_station_id TEXT, platform_code TEXT, zone_id TEXT, source_id TEXT, status TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE suburban_stations (
            stop_id TEXT, stop_name TEXT, stop_name_ta TEXT, latitude TEXT, longitude TEXT,
            parent_station_id TEXT, platform_code TEXT, zone_id TEXT, source_id TEXT, status TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE bus_routes (
            route_id TEXT, agency_id TEXT, route_number TEXT, route_name TEXT,
            source_id TEXT, status TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE route_stops (
            route_id TEXT, pattern_id TEXT, stop_sequence TEXT, stop_id TEXT,
            source_id TEXT, status TEXT
        )
    """)

    # Stops: A (Porur), B (Guindy), C (Saidapet), D (T. Nagar), X (Isolated)
    stops = [
        ("MTC:A", "Porur", "போரூர்", "13.033", "80.158", "", "", "", "S_MTC_GTFS", "HISTORICAL_UNVERIFIED"),
        ("MTC:B", "Guindy", "கிண்டி", "13.008", "80.213", "", "", "", "S_MTC_GTFS", "HISTORICAL_UNVERIFIED"),
        ("MTC:C", "Saidapet", "சைதாப்பேட்டை", "13.020", "80.220", "", "", "", "S_MTC_GTFS", "HISTORICAL_UNVERIFIED"),
        ("MTC:D", "T. Nagar", "தி.நகர்", "13.040", "80.233", "", "", "", "S_MTC_GTFS", "HISTORICAL_UNVERIFIED"),
        ("MTC:X", "Isolated Stop", "தனித்த நிறுத்தம்", "13.500", "80.500", "", "", "", "S_MTC_GTFS", "HISTORICAL_UNVERIFIED"),
    ]
    cur.executemany("INSERT INTO bus_stops VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", stops)

    # Direct Route: 54 (A -> B)
    cur.execute("INSERT INTO bus_routes VALUES ('R54', 'MTC', '54', 'Porur - Guindy', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")
    cur.execute("INSERT INTO route_stops VALUES ('R54', 'PAT_54_UP', '1', 'MTC:A', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")
    cur.execute("INSERT INTO route_stops VALUES ('R54', 'PAT_54_UP', '2', 'MTC:B', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")

    # Route 54 Reverse: (B -> A)
    cur.execute("INSERT INTO route_stops VALUES ('R54', 'PAT_54_DOWN', '1', 'MTC:B', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")
    cur.execute("INSERT INTO route_stops VALUES ('R54', 'PAT_54_DOWN', '2', 'MTC:A', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")

    # Transfer Route: A -> C (Route 25) then C -> D (Route 47)
    cur.execute("INSERT INTO bus_routes VALUES ('R25', 'MTC', '25', 'Porur - Saidapet', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")
    cur.execute("INSERT INTO route_stops VALUES ('R25', 'PAT_25', '1', 'MTC:A', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")
    cur.execute("INSERT INTO route_stops VALUES ('R25', 'PAT_25', '2', 'MTC:C', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")

    cur.execute("INSERT INTO bus_routes VALUES ('R47', 'MTC', '47', 'Saidapet - T. Nagar', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")
    cur.execute("INSERT INTO route_stops VALUES ('R47', 'PAT_47', '1', 'MTC:C', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")
    cur.execute("INSERT INTO route_stops VALUES ('R47', 'PAT_47', '2', 'MTC:D', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")

    conn.commit()
    conn.close()

    return SQLiteTransitRepository(db_path=str(db_file))


def test_direct_bus_journey(journey_fixture_repo):
    engine = JourneyEngine(repository=journey_fixture_repo)
    res = engine.plan_journey("MTC:A", "MTC:B")
    assert res.status == "OK"
    assert len(res.options) >= 1
    best = res.options[0]
    assert best.transfers == 0
    assert best.legs[0].route_number == "54"
    assert best.legs[0].board_stop.stop_id == "MTC:A"
    assert best.legs[0].alight_stop.stop_id == "MTC:B"
    assert best.ranking_basis == "fewest transfers, then fewest stops"


def test_direction_matters(journey_fixture_repo):
    engine = JourneyEngine(repository=journey_fixture_repo)
    # Searching B to A should use PAT_54_DOWN, not PAT_54_UP
    res = engine.plan_journey("MTC:B", "MTC:A")
    assert res.status == "OK"
    assert len(res.options) >= 1
    assert res.options[0].legs[0].pattern_id == "PAT_54_DOWN"


def test_one_transfer_journey(journey_fixture_repo):
    engine = JourneyEngine(repository=journey_fixture_repo)
    # From A (Porur) to D (T. Nagar) via C (Saidapet)
    res = engine.plan_journey("MTC:A", "MTC:D")
    assert res.status == "OK"
    assert len(res.options) >= 1
    transfer_opt = res.options[0]
    assert transfer_opt.transfers == 1
    assert len(transfer_opt.legs) == 2
    assert transfer_opt.legs[0].route_number == "25"
    assert transfer_opt.legs[1].route_number == "47"
    assert transfer_opt.legs[1].transfer_notes == "Transfer point, walking and timing not verified"


def test_disconnected_stops_no_route(journey_fixture_repo):
    engine = JourneyEngine(repository=journey_fixture_repo)
    # From A to X (Isolated)
    res = engine.plan_journey("MTC:A", "MTC:X")
    assert res.status == "NO_ROUTE"
    assert "data may be incomplete" in res.caveats[0]
    assert "does not confirm no real-world public service exists" in res.caveats[1]


def test_transfer_cap_and_same_stop(journey_fixture_repo):
    engine = JourneyEngine(repository=journey_fixture_repo, default_max_transfers=5)
    assert engine.default_max_transfers == 3  # hard capped at 3

    res_same = engine.plan_journey("MTC:A", "MTC:A")
    assert res_same.status == "OK"
    assert res_same.reason == "Origin and destination are the exact same stop."
