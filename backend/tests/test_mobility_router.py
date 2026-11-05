from pathlib import Path
import sqlite3
import pytest

from backend.app.mobility.router import (
    SearchRoutesRequest,
    get_adv_enricher,
    get_dist_enricher,
    get_engine,
    get_fare_enricher,
    get_repo,
    get_resolver,
    get_speech_formatter,
    search_routes,
    search_stops,
    get_diagnostics,
)
from backend.app.mobility.repository import SQLiteTransitRepository
from backend.app.mobility.resolver import StopResolver
from backend.app.mobility.engine import JourneyEngine
from backend.app.mobility.enrich.distance import DistanceEnricher
from backend.app.mobility.enrich.fare import FareEnricher
from backend.app.mobility.enrich.advisory import AdvisoryEnricher
from backend.app.mobility.speech import SpeechFormatter


@pytest.fixture
def test_setup(tmp_path: Path):
    db_file = tmp_path / "api_test.sqlite"
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

    cur.execute("INSERT INTO bus_stops VALUES ('MTC:5738', 'Porur', 'போரூர்', '13.033', '80.158', '', '', '', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")
    cur.execute("INSERT INTO bus_stops VALUES ('MTC:1465', 'Guindy', 'கிண்டி', '13.008', '80.213', '', '', '', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")

    cur.execute("INSERT INTO bus_routes VALUES ('R54', 'MTC', '54', 'Porur - Guindy', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")
    cur.execute("INSERT INTO route_stops VALUES ('R54', 'PAT_54', '1', 'MTC:5738', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")
    cur.execute("INSERT INTO route_stops VALUES ('R54', 'PAT_54', '2', 'MTC:1465', 'S_MTC_GTFS', 'HISTORICAL_UNVERIFIED')")

    conn.commit()
    conn.close()

    alias_file = tmp_path / "stop_aliases.csv"
    alias_file.write_text(
        "alias_id,stop_id,alias,language,source_id,status,reviewed_by\n"
        "A1,MTC:5738,porur,en,S_CURATED,approved,prakash\n"
        "A2,MTC:1465,guindy,en,S_CURATED,approved,prakash\n",
        encoding="utf-8",
    )

    repo = SQLiteTransitRepository(db_path=str(db_file))
    resolver = StopResolver(repository=repo, alias_file_path=str(alias_file))
    engine = JourneyEngine(repository=repo)
    dist = DistanceEnricher(cache_db_path=str(tmp_path / "dist.sqlite"))
    fare = FareEnricher(metro_fares_file="none.csv")
    adv = AdvisoryEnricher(db_path=str(tmp_path / "adv.sqlite"))
    speech = SpeechFormatter()

    return {
        "repo": repo,
        "resolver": resolver,
        "engine": engine,
        "dist": dist,
        "fare": fare,
        "adv": adv,
        "speech": speech,
    }


def test_search_stops_endpoint(test_setup):
    stops = search_stops(query="Porur", limit=10, repo=test_setup["repo"])
    assert len(stops) >= 1
    assert stops[0]["stop_id"] == "MTC:5738"
    assert stops[0]["stop_name"] == "Porur"


def test_search_routes_endpoint_success(test_setup):
    req = SearchRoutesRequest(origin="porur", destination="guindy", language="en")
    res = search_routes(
        req=req,
        repo=test_setup["repo"],
        resolver=test_setup["resolver"],
        engine=test_setup["engine"],
        dist_enricher=test_setup["dist"],
        fare_enricher=test_setup["fare"],
        adv_enricher=test_setup["adv"],
        speech_formatter=test_setup["speech"],
    )

    assert res["status"] == "OK"
    assert len(res["options"]) >= 1
    assert res["options"][0]["legs"][0]["route"] == "54"
    assert "older timetable and may have changed" in res["speech_text"]
    assert res["session_id"] is not None


def test_search_routes_endpoint_no_match(test_setup):
    req = SearchRoutesRequest(origin="nonexistent_place", destination="guindy", language="en")
    res = search_routes(
        req=req,
        repo=test_setup["repo"],
        resolver=test_setup["resolver"],
        engine=test_setup["engine"],
        dist_enricher=test_setup["dist"],
        fare_enricher=test_setup["fare"],
        adv_enricher=test_setup["adv"],
        speech_formatter=test_setup["speech"],
    )

    assert res["status"] == "NO_MATCH"
    assert len(res["options"]) == 0
