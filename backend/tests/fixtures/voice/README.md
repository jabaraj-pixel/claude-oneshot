# Voice test fixtures — provenance & usage rules

## intent_examples.csv

- **Source:** `chennai_transport` research package shared by the team via Google
  Drive (`csv/intent_examples.csv`, identical to `csv/voice_training_phrases.csv`),
  retrieved **2026-11-05**. Newline-normalised copy; content unchanged.
- **Status:** every row is labelled `AUTHORED_EVALUATION_NOT_TRANSPORT_FACT`
  (source id `S_EXAMPLES`). These are 33 authored evaluation seed utterances
  (11 scenarios × Tamil / English / Tanglish) — **not recorded speech, not a
  training corpus, and not transport facts**.
- **Usage in this module:** NLU intent/slot evaluation seeds for
  `backend/tests/test_conversation_nlu.py` and scripted dialogue tests.
  They must never be presented as live data or used to quote routes, fares,
  timetables or arrivals.

## Safety policy adopted from the research package README

The upstream package is explicit: the GTFS snapshots are historical/unverified
(MTC app-derived compilation, CMRL calendar expired 2021, Southern Railway
revision reported 2026-11-01), no authorised live feed exists, and exact fares
cannot be computed without operator stop-to-stage rules. The dialogue manager
therefore answers:

| Caller asks | Assistant behaviour |
| :--- | :--- |
| Fare | UNKNOWN — no verified stop-to-fare-stage mapping; never quote a fare |
| Live next bus / arrival | UNKNOWN — no authorised real-time feed; a schedule is not a live arrival |
| First/last bus time | No verified current timetable; offer the verified route instead |
| Nearest stop to "this hospital" | NEEDS_CLARIFICATION — ask which hospital/landmark and area |
| Wheelchair / accessibility | UNKNOWN — no station-level verified accessibility data |
| Ambiguous stop name | Clarify; never auto-merge duplicate stop names (they may be different sides/platforms/entrances) |

Tamil fallback (verbatim from the package):
> மன்னிக்கவும், இந்த பயணத்திற்கான சரிபார்க்கப்பட்ட தற்போதைய தகவல் என்னிடம் இல்லை.

## What was intentionally NOT copied

The full GTFS-derived CSVs (bus/metro/suburban schedules, routes, stops, fares)
belong to Worker 2's `data/` workstream and are **not** duplicated here. Route
computation is Worker 2's responsibility; this module only consumes the shared
mobility API contract. Real stop-name examples used in disambiguation tests
(e.g. duplicated "Alandur Depot" / "Elephant Gate" nodes) are cited from the
package's `bus_stops.csv` and `DATA_QUALITY_REPORT.md` and are labelled
`HISTORICAL_UNVERIFIED` in the tests themselves.
