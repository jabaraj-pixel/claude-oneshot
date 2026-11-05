import os
from pathlib import Path
import sqlite3
import pytest
from backend.app.mobility.models import Stop
from backend.app.mobility.repository import SQLiteTransitRepository
from backend.app.mobility.resolver import StopResolver, normalize_query


@pytest.fixture
def test_repo(tmp_path: Path):
    """Fixture with properly structured bus_stops, metro_stations, and suburban_stations."""
    db_file = tmp_path / "resolver_test.sqlite"
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

    stops_data = [
        ("MTC:5738", "Porur Bus Stand", "போரூர் பஸ் ஸ்டாண்ட்", "13.033", "80.158", "", "", "", "S_MTC_GTFS", "HISTORICAL_UNVERIFIED"),
        ("MTC:5739", "Porur Junction", "போரூர் சந்திப்பு", "13.036", "80.159", "", "", "", "S_MTC_GTFS", "HISTORICAL_UNVERIFIED"),
        ("MTC:5740", "Porur Lake", "போரூர் ஏரி", "13.040", "80.152", "", "", "", "S_MTC_GTFS", "HISTORICAL_UNVERIFIED"),
        ("MTC:3746", "T. Nagar Bus Terminus", "தி.நகர் பேருந்து நிலையம்", "13.040", "80.233", "", "", "", "S_MTC_GTFS", "HISTORICAL_UNVERIFIED"),
        ("MTC:4287", "Guindy Railway Station", "கிண்டி ரயில் நிலையம்", "13.008", "80.213", "", "", "", "S_MTC_GTFS", "HISTORICAL_UNVERIFIED"),
        ("MTC:9999", "Exact Unique Stop", "தனித்துவமான நிறுத்தம்", "13.100", "80.200", "", "", "", "S_MTC_GTFS", "HISTORICAL_UNVERIFIED"),
    ]
    cur.executemany("INSERT INTO bus_stops VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", stops_data)
    conn.commit()
    conn.close()

    return SQLiteTransitRepository(db_path=str(db_file))


@pytest.fixture
def alias_file(tmp_path: Path):
    f = tmp_path / "stop_aliases.csv"
    f.write_text(
        "alias_id,stop_id,alias,language,source_id,status,reviewed_by\n"
        "A1,MTC:5738,porur,en,S_CURATED,approved,prakash\n"
        "A2,MTC:5739,porur,en,S_CURATED,approved,prakash\n"
        "A3,MTC:4287,guindy,en,S_CURATED,approved,prakash\n"
        "A4,MTC:4287,கிண்டி,ta,S_CURATED,approved,prakash\n"
        "A5,MTC:3746,t nagar,en,S_CURATED,approved,prakash\n",
        encoding="utf-8",
    )
    return str(f)


def test_normalize_query():
    assert normalize_query("  T. Nagar  ") == "t nagar"
    assert normalize_query("கிண்டி   ரயில்  நிலையம்") == "கிண்டி ரயில் நிலையம்"
    assert normalize_query("Porur-Junction/Bus") == "porur junction bus"


def test_alias_unambiguous_match(test_repo, alias_file):
    resolver = StopResolver(repository=test_repo, alias_file_path=alias_file)
    res = resolver.resolve("Guindy")
    assert res.status == "EXACT"
    assert res.selected_stop is not None
    assert res.selected_stop.stop_id == "MTC:4287"
    assert res.selected_stop.match_source == "alias"


def test_alias_tamil_match(test_repo, alias_file):
    resolver = StopResolver(repository=test_repo, alias_file_path=alias_file)
    res = resolver.resolve("கிண்டி")
    assert res.status == "EXACT"
    assert res.selected_stop is not None
    assert res.selected_stop.stop_id == "MTC:4287"


def test_alias_ambiguity_needs_clarification(test_repo, alias_file):
    resolver = StopResolver(repository=test_repo, alias_file_path=alias_file)
    # "porur" maps to both MTC:5738 and MTC:5739 in test alias file
    res = resolver.resolve("Porur")
    assert res.status == "NEEDS_CLARIFICATION"
    assert res.selected_stop is None
    assert len(res.candidates) == 2
    assert "Did you mean" in res.clarification_question_en
    assert "Porur Bus Stand" in res.clarification_question_en
    assert "Porur Junction" in res.clarification_question_en


def test_exact_name_match(test_repo, alias_file):
    resolver = StopResolver(repository=test_repo, alias_file_path=alias_file)
    res = resolver.resolve("Exact Unique Stop")
    assert res.status == "EXACT"
    assert res.selected_stop.stop_id == "MTC:9999"
    assert res.selected_stop.match_source == "exact"


def test_partial_name_match(test_repo, alias_file):
    resolver = StopResolver(repository=test_repo, alias_file_path=alias_file)
    # "Lake" matches Porur Lake
    res = resolver.resolve("Porur Lake")
    assert res.status in ("EXACT", "RESOLVED")
    assert res.selected_stop.stop_id == "MTC:5740"


def test_no_match(test_repo, alias_file):
    resolver = StopResolver(repository=test_repo, alias_file_path=alias_file)
    res = resolver.resolve("Coimbatore Central")
    assert res.status == "NO_MATCH"
    assert res.selected_stop is None
    assert "could not find any stop" in res.speech_prompt_en
    assert "கிடைக்கவில்லை" in res.speech_prompt_ta
