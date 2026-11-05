# Module 1 — Voice AI + Telephony (Worker 1: Nadhish)

Provider-independent telephone assistant dialogue: inbound call handling,
intent/slot NLU (Tamil / English / Tanglish), multi-turn state, verified route
playback, safe UNKNOWN policies, consent capture and call records.

**Ownership:** `backend/app/telephony/`, `backend/app/voice/`,
`backend/app/conversation/`, voice/telephony tests in `backend/tests/`.
The only touched file outside these paths is `backend/app/api/routes.py`,
using the Worker 1 mount point explicitly reserved in that file's comments
(see *Required Shared File Changes* below).

---

## 1. File map

| Path | Purpose |
| :--- | :--- |
| `conversation/nlu.py` | Deterministic intent + slot extraction (no LLM, never guesses). Covers the 11 scenarios from the team's evaluation seeds. |
| `conversation/manager.py` | Multi-turn state machine: collection, confirmation, disambiguation, corrections, unclear-speech retry limits, consent, termination. |
| `conversation/responses.py` | Tamil/English spoken templates (Tanglish sessions get Tamil speech). Route content is never composed here. |
| `conversation/mobility_client.py` | Mobility boundary: HTTP client for the exact shared contract, in-process engine adapter, unconfigured mode. |
| `conversation/call_records.py` | `CallSession` records (shared schema), idempotent completion, provider event dedup, consent + message handoff metadata. |
| `conversation/session.py` | Existing `BaseConversationStore` + in-memory implementation. |
| `conversation/schemas.py` | Internal dialogue contracts (`DialogueResponse`, state snapshot, clarification). |
| `conversation/runtime.py` | Process-wide manager shared by voice API + telephony. |
| `conversation/demo.py` | Local interactive/scripted text demo — no credentials needed. |
| `voice/api.py` | `POST /api/voice/turn` (contract §3). |
| `voice/sarvam.py` | Sarvam STT/TTS adapters (**not live-tested**, see limitations). |
| `voice/mock.py` | Explicitly labelled mock adapters (`VOICE_USE_MOCK=1`). |
| `voice/factory.py` | Provider selection / provider-not-configured mode. |
| `telephony/api.py` | `POST /telephony/inbound`, `POST /telephony/call-completed`, `WS /telephony/audio/{call_id}` (contract §§4–6). |
| `telephony/exotel.py` | Payload validation, AccountSid + optional token checks, stream XML (**provider verb unverified**). |
| `telephony/devapp.py` | Development harness mounting telephony at contract root paths without editing shared files. |

## 2. Run it locally (no credentials required)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt

# Scripted end-to-end walkthrough (labelled mock mobility)
python -m backend.app.conversation.demo --scripted --mock-mobility

# Interactive chat — type Tamil / English / Tanglish
python -m backend.app.conversation.demo --mock-mobility

# Full API server incl. telephony (dev harness; see shared-file note)
uvicorn backend.app.telephony.devapp:app --host 0.0.0.0 --port 8000
```

Text turn against the API (works on the normal app too):

```bash
curl -s http://localhost:8000/api/voice/turn -H 'Content-Type: application/json' \
  -d '{"call_id":"call-1","text_input":"Tambaram to T. Nagar by bus","language_hint":"en"}'
```

Without a mobility engine the dialogue still collects slots and honestly
reports the route service as temporarily unavailable (with retry).

## 3. Environment variables

Already in shared `config.py` / `.env.example` (no changes needed):

| Variable | Effect |
| :--- | :--- |
| `SARVAM_API_KEY` | Enables real Sarvam STT/TTS adapters. Unset → audio input returns 501 `INTEGRATION_NOT_CONFIGURED`; text dialogue unaffected. |
| `EXOTEL_ACCOUNT_SID` | When set, inbound webhooks must carry a matching `AccountSid` (403 otherwise). |

Module-local switches read directly from the environment **until the
Integration Lead adopts them into `config.py`** (proposed diff below). None are
credentials except the webhook token, which is a shared secret you generate:

| Variable | Effect |
| :--- | :--- |
| `MOBILITY_API_BASE_URL` | Base URL of Worker 2's mobility API. Set → dialogue uses `HttpMobilityClient` (exact contract). Unset → unconfigured mode. |
| `VOICE_USE_MOCK` | `1` → labelled mock STT/TTS for development. Never for production. |
| `EXOTEL_WEBHOOK_TOKEN` | When set, `/telephony/inbound` requires `?token=<value>`. |
| `VOICE_PUBLIC_BASE_URL` | Public `wss://` base used in the inbound stream XML behind a proxy. |

## 4. Required Shared File Changes (for the PR description)

**`backend/app/main.py`** — telephony lives at root `/telephony/*` per
`docs/API_CONTRACTS.md`; only the Integration Lead can mount it:

```diff
 from backend.app.api.routes import api_router
+from backend.app.telephony.api import router as telephony_router
 ...
     # API V1 Router at `/api`
     app.include_router(api_router, prefix=settings.API_V1_PREFIX)
+
+    # Telephony at root per docs/API_CONTRACTS.md (Worker 1)
+    app.include_router(telephony_router, prefix="/telephony", tags=["Telephony"])
```

Until then, `backend/app/telephony/devapp.py` provides the identical wiring for
development and tests.

**`backend/app/config.py`** (optional, recommended):

```diff
     EXOTEL_SUB_DOMAIN: Optional[str] = None
+    # Worker 1 module switches (currently read from os.environ)
+    MOBILITY_API_BASE_URL: Optional[str] = None
+    VOICE_USE_MOCK: bool = False
+    EXOTEL_WEBHOOK_TOKEN: Optional[str] = None
+    VOICE_PUBLIC_BASE_URL: Optional[str] = None
```

`backend/app/api/routes.py` was edited to add **only** the reserved Worker 1
mount (`api_router.include_router(voice_router, prefix="/voice", ...)`), exactly
as pre-commented in that file. Flag this to Saran in the PR.

## 5. Mobility & messaging boundaries

* Routes come **only** from Worker 2 via `POST /api/mobility/routes/search` /
  `GET /api/mobility/stops/search` (or an injected `BaseMobilityEngine`).
  Spoken route text is the engine's `spoken_summary_ta/en` verbatim plus its
  disclaimer. No route, fare, timetable or arrival is ever invented here.
* Ambiguous stops are clarified with the caller; duplicate stop names are
  never auto-merged (per the data quality report they can be different
  sides/platforms). Unknown places clear the slot and ask again.
* Timeouts / malformed / unconfigured mobility → honest "temporarily
  unavailable" + retry. 400 → places re-collected.
* After explicit spoken consent (channel + number confirmed), a
  `MessageRequest(user_consent_granted=True)` is attached to the call record
  (`metadata.message_handoff`) and returned as
  `next_action=handoff_message_to_messaging`. **This module never dispatches
  messages** — Worker 3's messaging boundary consumes the handoff.

## 6. Safe-answer policies (chennai_transport research package, 2026-11-05)

The team's Drive dataset is research-only (historical GTFS, expired CMRL
calendar, no authorised live feed, no verified fare-stage mapping). Adopted:

* Fare → UNKNOWN, never quoted. Live arrival → UNKNOWN ("a schedule is not a
  live arrival"). First/last service → no verified timetable; offer the route.
* Accessibility → UNKNOWN (no station-level verification).
* "Nearest stop to this hospital" → NEEDS_CLARIFICATION (which place/area?).
* Complaints / lost property → honest out-of-scope redirect (no fake filing).
* Tamil fallback sentence adopted verbatim in `responses.no_verified_info`.
* 33 authored evaluation seeds stored at
  `backend/tests/fixtures/voice/intent_examples.csv` (labelled
  `AUTHORED_EVALUATION_NOT_TRANSPORT_FACT`) and enforced by parametrised tests.

## 7. Tests

```bash
pytest backend/tests -v          # full suite
pytest backend/tests/test_conversation_nlu.py -v        # incl. 33 dataset seeds
pytest backend/tests/test_conversation_manager.py -v    # state machine
pytest backend/tests/test_conversation_mobility.py -v   # success/no-route/timeout/malformed
pytest backend/tests/test_voice_adapters.py -v          # STT/TTS modes & failures
pytest backend/tests/test_voice_api.py -v               # /api/voice/turn contract
pytest backend/tests/test_telephony_api.py -v           # webhooks + WS protocol
pytest backend/tests/test_conversation_e2e.py -v        # scripted full calls
```

Latest result: **163 passed** (10 baseline + 153 new), 0 failures.

## 8. Limitations & blockers (honest status)

1. **No live provider testing was possible** — no `SARVAM_API_KEY`, Exotel
   account/number or streaming access exists in this environment. Sarvam
   adapters follow the public API shape; the Exotel stream XML verb must be
   verified against the provider console before a real number is pointed here.
   **Real phone calls are NOT claimed to work.**
2. **Mobility engine not connected yet** (Worker 2 in progress). The HTTP
   client is contract-exact and tested with mock transports; set
   `MOBILITY_API_BASE_URL` when Prakash's API is up.
3. **In-memory stores** — dialogue state, call records and dedup keys reset on
   restart. Durable persistence needs the Integration Lead's shared DB design.
4. `response_audio_url` is always null (no audio storage service); TTS audio is
   streamed over the telephony WebSocket instead.
5. STT confidence scores are not exposed by the shared `BaseSpeechToText`
   interface; uncertainty handling uses extraction-confidence heuristics.
6. Telephony root mount awaits the Integration Lead diff above; until then use
   the dev harness.
7. Tamil NLU is rule-based with sandhi restoration; native-speaker evaluation
   beyond the 33 authored seeds is still required (per the research package).
