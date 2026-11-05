# Data Coverage & Quality Report

This document records the data quality audit, coverage analysis, and known gaps in the Chennai transit dataset, derived from `DATA_QUALITY_REPORT.md` and `MISSING_DATA_REPORT.md`.

> [!WARNING]
> **Release decision: NOT READY for operational passenger advice.**
> The GTFS route, stop and schedule feeds are third-party compilations or mirrors; current coverage and permission for commercial use are not established. Do not speak a bus number, journey, fare, or timetable to passengers from this historical unverified data without current official verification.

---

## Known Gaps (Verbatim)

The following known data gaps and anomalies are recorded verbatim from the research package:

1. **677 bus routes have no trips** (out of 4,611 route records in the MTC feed, 677 routes have no trip and thus no sequence).
2. **The Metro GTFS calendar expired on 2021-12-31** (historic timetable calendar expired on 2021-12-31; fares 2021; excludes 2026 Yellow Line).
3. **Suburban data has 19 time anomalies (4 negative same-stop dwell, 15 negative inter-stop transitions)**: 4 same-stop negative dwell (departure before arrival at same stop) and 15 negative inter-stop transitions (next-stop arrival before previous departure).
4. **No walking links, aliases, landmarks, live data or fare-stage mapping exist**:
   - `walking_connections.csv` is empty (no cross-mode verified links, walking distances, or last-mile pathways).
   - `stop_aliases.csv` is empty (Tamil colloquial names and stop aliases are unmapped).
   - `landmarks.csv` is empty (hospital/landmark coordinates and entrances are unmapped).
   - `interchange_points.csv` is empty.
   - `suburban_fares.csv` is empty.
   - No live GPS, ETA, occupancy, or service disruptions data exists (all fields marked `UNKNOWN`).
   - MTC bus fare calculation is blocked because no verified route-specific stop-to-fare-stage mapping and boundary counting rules exist.

---

## Detailed Data Audit & Structural Quality

| Check | MTC (Bus) | Metro | Suburban (Rail) |
| :--- | :---: | :---: | :---: |
| **Route records** | 4,611 | 28 | 763 |
| **Stop nodes** | 5,580 | 254 | 708 |
| **Trips** | 47,047 | 625 | 763 |
| **Stop times** | 1,360,443 | 12,503 | 16,135 |
| **Distinct route/direction/stop patterns** | 3,934 | 29 | 763 |
| **Duplicate route / stop / trip IDs** | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| **Duplicate `(trip_id, stop_sequence)`** | 0 | 0 | 0 |
| **Missing trip→route / trip→service** | 0 / 0 | 0 / 0 | 0 / 0 |
| **Missing stop-time→trip / stop** | 0 / 0 | 0 / 0 | 0 / 0 |
| **Invalid/missing coordinates** | 0 | 0 | 0 |
| **Coordinates outside broad 12–14° N, 79–81° E** | 0 | 0 | 0 |
| **Missing or invalid parent-station reference** | 0 | 0 | 0 |
| **Stop times with missing arrival or departure** | 0 | 0 | 0 |
| **Events at or after GTFS 24:00** | 1,904 | 0 | 0 |
| **Departure before arrival at same stop** | 0 | 0 | **4** |
| **Next-stop arrival before previous departure** | 0 | 0 | **15** |
| **Route records with no trip** | **677** | 0 | 0 |
| **Stop nodes with no stop-time** | 103 | 173 | 564 |
| **Distinct duplicated case-folded stop-name groups** | 2,312 | 41 | 114 |
| **Nodes belonging to those name groups** | 5,038 | 254 | 705 |

---

## Quality Rules & Ingestion Safeguards

* **No Auto-Merging of Duplicate Stop Names**: Same names frequently identify different platform sides, entrances, or interchange stations. Merging them destroys stop precision.
* **Preservation of Anomalies for Audit**: Suburban temporal anomalies are retained verbatim for audit rather than silently mutated or masked.
* **Read-Only Ingestion**: The database build runs only during deployment or when source files update. Runtime backend API modules must open `chennai.sqlite` in read-only mode (`?mode=ro`).
* **Status Enforcement**: Every queried candidate from historical tables must carry the status `HISTORICAL_UNVERIFIED`.
