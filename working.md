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
