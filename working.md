# WORKING LOG & RULES

## Core Execution Rules
1. **Branch Strictness**: Commit and push strictly to `worker/mobility-backend` branch on `saran799/conversational-ai`. Never push or commit to `main` or any other branch.
2. **Security & Data Safety**:
   - Never commit raw data zips, unpacked CSVs, or compiled SQLite databases (`data/raw/`, `data/build/` are ignored in `.gitignore`).
   - SQLite access in the application must always be read-only (`file:...?mode=ro`, `uri=True`).
   - Never concatenate user strings into SQL queries; always use parameterized queries.
3. **Data Freshness & Provenance**:
   - Every model must carry `source_id`, `data_status`, and (where relevant) `retrieved_on`.
   - Never mark historical feeds as real-time or verified passenger advice. Status must default to `HISTORICAL_UNVERIFIED`.
   - If database is missing, the service must start safely, return `UNKNOWN` (reason: data not loaded) for journeys, and report status in diagnostics.
4. **Text Output Contract**:
   - Our mobility engine produces text responses for downstream teammates:
     - Spoken voice scripts for TTS (Colleague 1).
     - Post-call messaging summary (Colleague 2) for WhatsApp/SMS: must include key structured journey details (recommended routes, estimated fare/cost, walking distance/time, estimated arrival time/duration).
5. **Feature Overlap & Conflict Escalation**:
   - Hereafter, if any new requirement, schema, or information arrives that overlaps, conflicts with, or replaces an existing feature or implementation, DO NOT assume or overwrite silently. Always halt, explain the overlap, and ask the user explicitly which version/behavior to use.

---

## Phase Checklist & Progress

- [x] **Phase 1: Foundation & Safety Setup**
  - [x] Link origin remote to `saran799/conversational-ai.git`
  - [x] Checkout and track `worker/mobility-backend`
  - [x] Configure `push.default = upstream`

- [x] **Phase 2: Data setup (run once)**
  - [x] Place and unpack `chennai_transport_research` at `data/raw/chennai_transport`
  - [x] Prevent commit of raw/build data in `.gitignore`
  - [x] Verify integrity: `sha256sum -c SHA256SUMS.txt` (7 files verified, 0 mismatches)
  - [x] Copy `chennai_db.py` to `backend/app/mobility/tools/chennai_db.py`
  - [x] Build database in one pass: `python backend/app/mobility/tools/chennai_db.py build data/raw/chennai_transport/csv data/build/chennai.sqlite`
  - [x] Run demo to verify: Porur to Guindy returns `MTC:71111` and `MTC:71113` marked `HISTORICAL_UNVERIFIED`
  - [x] Create `docs/DATA_SOURCES.md` with publishers, URLs, dates, licenses, and CSV set SHA256 (`887e466315d22dcf01f4e2fd0bd51f59140ef530a08d439ed949d49837d45a55`)
  - [x] Create `docs/DATA_COVERAGE.md` with all known data gaps recorded verbatim

- [x] **Phase 3: Data access layer and models**
  - [x] Define Pydantic models in `backend/app/mobility/models.py`: `Stop`, `Leg`, `JourneyOption`, `Advisory`, `FareResult`, `DistanceResult`, `JourneyResponse` (each enforcing `source_id`, `data_status`, `retrieved_on`)
  - [x] Implement `TransitRepository` interface (abstract base class)
  - [x] Implement `SQLiteTransitRepository` in `backend/app/mobility/repository.py` using `file:...?mode=ro` and parameterized queries only
  - [x] Implement startup `_meta` table reading and diagnostics reporting
  - [x] Handle missing DB gracefully: service starts, returns `UNKNOWN` (reason: data not loaded), reports in diagnostics
  - [x] Create tiny fixture database for tests
  - [x] Write and pass unit tests in `backend/tests/test_mobility_repository.py` (6 passed, full suite 16 passed)

- [x] **Phase 4: Stop Resolver**
  - [x] Created `backend/app/mobility/resolver.py` and `data/curated/stop_aliases.csv`
  - [x] Normalization: trim, lowercase, Unicode NFKC, collapse spaces, preserve Tamil intact
  - [x] Order of matching: curated aliases -> exact stop name -> partial stop name
  - [x] Ambiguity handling: returns `NEEDS_CLARIFICATION` with spoken questions in English and Tamil
  - [x] No geocoding fabrication or stop merging
  - [x] Tested and passed in `backend/tests/test_stop_resolver.py` (7 tests passed)

- [x] **Phase 5: Journey Engine**
  - [x] Created `backend/app/mobility/engine.py`
  - [x] Direct bus journeys: pattern matching where origin stop_sequence < destination stop_sequence
  - [x] Stop counting and pattern joining to route numbers
  - [x] Directed graph for transfer journeys (default 2 transfers, hard cap 3)
  - [x] Ranking by fewest transfers, then fewest stops
  - [x] Returns best option + up to 2 alternatives; `NO_ROUTE` when unserved
  - [x] Tested and passed in `backend/tests/test_journey_engine.py` (5 tests passed)

- [x] **Phase 6: Enrichment Modules**
  - [x] Created `backend/app/mobility/enrich/distance.py`: Haversine straight-line lower bound + OpenRouteService road routing with SQLite coordinate cache and graceful fallback
  - [x] Created `backend/app/mobility/enrich/fare.py`: Bus unknown (no stop-to-stage mapping), curated CMRL metro fare lookup, provenance tracking
  - [x] Created `backend/app/mobility/enrich/advisory.py`: Traffic Police diversion notices, review status gate (draft/approved), expiry filter, keyword matching
  - [x] Created CLI tool `backend/app/mobility/tools/ingest_advisory.py` for human review & approval
  - [x] Tested and passed in `backend/tests/test_mobility_enrichment.py` (5 tests passed)

- [x] **Phase 7: Speech Formatter**
  - [x] Created `backend/app/mobility/speech.py`
  - [x] Centralized message catalogues in `messages_en.json` and `messages_ta.json`
  - [x] TTS-friendly rules: short sentences, spelled out route numbers, plain caveats, fare/advisory status, follow-up questions
  - [x] Tested and passed in `backend/tests/test_mobility_speech.py` (3 tests passed)

- [x] **Phase 8: API & Sessions**
  - [x] Created `backend/app/mobility/session.py`: 10-minute in-memory dialogue session manager
  - [x] Created `backend/app/mobility/router.py`:
    - `POST /api/mobility/routes/search`
    - `GET /api/mobility/stops/search`
    - `GET /api/mobility/diagnostics`
  - [x] Documented proposal for router inclusion in `docs/proposals/mobility-changes.md`
  - [x] Tested and passed in `backend/tests/test_mobility_router.py` (3 tests passed)
