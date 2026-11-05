"""Chennai transit SQLite database builder and demo tool.

Supplied by Prakash for Chennai transit research data integration.
Builds SQLite database in one pass from CSV files with indices and metadata.
"""
import csv
import glob
import hashlib
import json
import os
import sqlite3
import sys
import time
from pathlib import Path


def calculate_csv_set_hash(csv_dir: Path) -> str:
    """Calculate deterministic SHA256 across all CSV files in alphabetical order."""
    combined = hashlib.sha256()
    for f in sorted(csv_dir.glob("*.csv")):
        combined.update(f.name.encode("utf-8"))
        with open(f, "rb") as fp:
            while chunk := fp.read(65536):
                combined.update(chunk)
    return combined.hexdigest()


def build_database(csv_dir: str, db_path: str):
    """Build SQLite database from CSV directory in one pass."""
    csv_path = Path(csv_dir)
    dest_path = Path(db_path)
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    if dest_path.exists():
        dest_path.unlink()

    print(f"Building Chennai transit database: {dest_path}")
    print(f"Source CSV directory: {csv_path}")

    start_time = time.time()
    csv_set_hash = calculate_csv_set_hash(csv_path)

    conn = sqlite3.connect(str(dest_path))
    cur = conn.cursor()

    cur.execute("PRAGMA journal_mode = OFF")
    cur.execute("PRAGMA synchronous = OFF")
    cur.execute("PRAGMA cache_size = -100000")  # ~100MB cache

    # Create _meta table
    cur.execute("""
        CREATE TABLE _meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    cur.execute("INSERT INTO _meta VALUES (?, ?)", ("csv_set_sha256", csv_set_hash))
    cur.execute("INSERT INTO _meta VALUES (?, ?)", ("built_at", time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())))

    # Ingest every CSV file
    csv_files = sorted(csv_path.glob("*.csv"))
    total_files = len(csv_files)

    for idx, f in enumerate(csv_files, 1):
        table_name = f.stem
        with open(f, "r", encoding="utf-8") as fp:
            reader = csv.reader(fp)
            headers = next(reader, None)
            if not headers:
                continue

            # Sanitize column names
            cols_def = ", ".join([f'"{col}" TEXT' for col in headers])
            placeholders = ", ".join(["?"] * len(headers))
            cur.execute(f'CREATE TABLE "{table_name}" ({cols_def})')

            batch = []
            for row in reader:
                batch.append(row)
                if len(batch) >= 10000:
                    cur.executemany(f'INSERT INTO "{table_name}" VALUES ({placeholders})', batch)
                    batch.clear()
            if batch:
                cur.executemany(f'INSERT INTO "{table_name}" VALUES ({placeholders})', batch)

            print(f"[{idx}/{total_files}] Ingested {table_name}")

    # Build key indexes
    indexes = [
        ("idx_bus_routes_id", "bus_routes", ["route_id"]),
        ("idx_bus_routes_num", "bus_routes", ["route_number"]),
        ("idx_bus_stops_id", "bus_stops", ["stop_id"]),
        ("idx_bus_stops_name", "bus_stops", ["stop_name"]),
        ("idx_route_stops_pattern", "route_stops", ["pattern_id"]),
        ("idx_route_stops_stop", "route_stops", ["stop_id"]),
        ("idx_route_stops_route", "route_stops", ["route_id"]),
        ("idx_bus_trip_patterns_p", "bus_trip_patterns", ["pattern_id"]),
        ("idx_bus_trip_patterns_t", "bus_trip_patterns", ["trip_id"]),
        ("idx_bus_trips_id", "bus_trips", ["trip_id"]),
        ("idx_bus_trips_route", "bus_trips", ["route_id"]),
        ("idx_metro_stations_id", "metro_stations", ["stop_id"]),
        ("idx_metro_stations_name", "metro_stations", ["stop_name"]),
        ("idx_metro_routes_id", "metro_routes", ["route_id"]),
        ("idx_suburban_stations_id", "suburban_stations", ["stop_id"]),
        ("idx_suburban_stations_name", "suburban_stations", ["stop_name"]),
        ("idx_suburban_routes_id", "suburban_routes", ["route_id"]),
    ]

    for idx_name, table, cols in indexes:
        col_list = ", ".join([f'"{c}"' for c in cols])
        try:
            cur.execute(f'CREATE INDEX IF NOT EXISTS {idx_name} ON "{table}" ({col_list})')
        except sqlite3.OperationalError as e:
            print(f"Warning creating index {idx_name}: {e}")

    conn.commit()
    cur.execute("PRAGMA optimize")
    conn.close()

    elapsed = time.time() - start_time
    print(f"Database build complete in {elapsed:.2f}s! CSV set SHA256: {csv_set_hash}")


def run_demo(db_path: str):
    """Run verification demo: two Porur to Guindy patterns expected (MTC:71111 and MTC:71113)."""
    db_file = Path(db_path)
    if not db_file.exists():
        print(f"Error: Database file does not exist: {db_path}", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(f"file:{db_file.resolve()}?mode=ro", uri=True)
    cur = conn.cursor()

    cur.execute("SELECT value FROM _meta WHERE key = 'csv_set_sha256'")
    meta_row = cur.fetchone()
    csv_sha = meta_row[0] if meta_row else "UNKNOWN"

    origin_stop = "MTC:5738"  # Porur
    dest_stop = "MTC:1465"    # Guindy

    # Direct pattern query
    query = """
        SELECT
            rs1.pattern_id,
            rs1.route_id,
            br.route_number,
            rs1.stop_id AS board_stop,
            rs2.stop_id AS alight_stop,
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
    """

    cur.execute(query, (origin_stop, dest_stop))
    rows = cur.fetchall()

    candidates = []
    for r in rows:
        candidates.append({
            "pattern_id": r[0],
            "route_id": r[1],
            "route_number": r[2],
            "board_stop": r[3],
            "alight_stop": r[4],
            "source_id": r[5],
            "status": r[6]
        })

    demo_output = {
        "warning": "Research demonstration only. Not verified for current passenger use.",
        "meta_csv_set_sha256": csv_sha,
        "query": "Porur stop MTC:5738 to Guindy Railway Station MTC:1465",
        "candidates": candidates,
        "fare": None,
        "live_arrival": None,
        "accessibility": "UNKNOWN"
    }

    print(json.dumps(demo_output, ensure_ascii=False, indent=2))
    conn.close()


def main():
    if len(sys.argv) < 2:
        print("Usage: python chennai_db.py [build <csv_dir> <db_path>] | [demo <db_path>]")
        sys.exit(1)

    cmd = sys.argv[1].lower()
    if cmd == "build":
        if len(sys.argv) < 4:
            print("Usage: python chennai_db.py build <csv_dir> <db_path>")
            sys.exit(1)
        build_database(sys.argv[2], sys.argv[3])
    elif cmd == "demo":
        if len(sys.argv) < 3:
            print("Usage: python chennai_db.py demo <db_path>")
            sys.exit(1)
        run_demo(sys.argv[2])
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
