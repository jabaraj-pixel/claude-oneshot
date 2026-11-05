# Module Ownership & Workstream Boundaries

Chennai Mobility AI uses a strict modular ownership model to allow three engineers to develop their features in parallel without file collisions or merge conflicts.

---

## 1. Workstream Matrix

| Worker | Workstream | Git Branch | Owned Directories & Scopes |
| :--- | :--- | :--- | :--- |
| **Worker 1** | Voice AI + Telephony | `worker/voice-telephony` | `backend/app/telephony/`<br>`backend/app/voice/`<br>`backend/app/conversation/`<br>Voice-specific schemas & tests |
| **Worker 2** | Mobility Backend + Transport Data | `worker/mobility-backend` | `backend/app/mobility/`<br>`data/`<br>Mobility-specific schemas & tests |
| **Worker 3** | Frontend + Messaging | `worker/frontend-messaging` | `frontend/`<br>`backend/app/messaging/`<br>`backend/app/complaints/`<br>Messaging/complaint schemas & tests |

---

## 2. Detailed Workstream Responsibilities

### WORKER 1 — VOICE AI + TELEPHONY
* **Branch**: `worker/voice-telephony`
* **Owned Paths**:
  - `backend/app/telephony/`
  - `backend/app/voice/`
  - `backend/app/conversation/`
  - Associated voice and telephony unit/integration tests in `backend/tests/`
* **Future Responsibilities**:
  - Exotel inbound SIP/PSTN webhook handling and call state management.
  - Real-time bidirectional audio streaming via WebSockets (`WS /telephony/audio/{call_id}`).
  - Sarvam AI Speech-to-Text (STT) and Text-to-Speech (TTS) integration.
  - Multilingual handling: Native Tamil (`ta`), Indian English (`en`), and Tanglish (`ta-en`) code-mixing.
  - Conversation memory, multi-turn dialogue management, and slot extraction.
  - Tool execution orchestration (calling Worker 2's mobility engine when origin and destination are identified).

---

### WORKER 2 — MOBILITY BACKEND + TRANSPORT DATA
* **Branch**: `worker/mobility-backend`
* **Owned Paths**:
  - `backend/app/mobility/`
  - `data/` (including `data/fixtures/` and raw GTFS feeds)
  - Associated mobility unit/integration tests in `backend/tests/`
* **Future Responsibilities**:
  - Ingestion and parsing of Chennai transit GTFS feeds (MTC buses, CMRL metro, Southern Railway suburban).
  - Stop resolution and fuzzy matching (Tamil and English landmark names, e.g., தாம்பரம் / Tambaram, தி.நகர் / T. Nagar).
  - Origin-Destination routing algorithms with transfer point calculation.
  - Generation of verified route recommendations with fare estimates and step-by-step instructions.
  - Providing data provenance and freshness metadata (`DataFreshness`).
  - Preventing hallucination of routes, fares, or arrival times.

---

### WORKER 3 — FRONTEND + MESSAGING
* **Branch**: `worker/frontend-messaging`
* **Owned Paths**:
  - `frontend/` (all React, Vite, Tailwind, components, pages, layouts)
  - `backend/app/messaging/`
  - `backend/app/complaints/`
  - Associated messaging and complaint unit/integration tests
* **Future Responsibilities**:
  - Operational dashboard UI for monitoring calls, journeys, messages, and complaints.
  - Browser-based voice-testing workbench for simulating telephony calls during development.
  - Call session and journey record presentation.
  - Outbound journey summary dispatch via WhatsApp Cloud API and SMS provider.
  - Mandatory caller consent verification prior to SMS/WhatsApp dispatch.
  - Passenger complaint intake, categorization, and review workflow.
  - Ensuring no official government submission is claimed without authorized external integrations.

---

## 3. Shared File Ownership & Protection Rules

To prevent merge contention and architectural drift, the following paths are **strictly controlled by the Integration Lead**:

- `backend/app/main.py` (FastAPI app instantiation and router registration)
- `backend/app/config.py` (Centralized settings schema)
- `backend/app/database/` (Database engine and session management)
- `backend/app/models/base.py` (Shared SQLAlchemy declarative base)
- `backend/app/schemas/common.py` and `backend/app/schemas/shared.py` (Shared API contracts)
- Root configuration files:
  - `.env.example`
  - `.gitignore`
  - `docker-compose.yml`
  - `backend/requirements.txt`
  - `frontend/package.json`
- CI/CD workflow configurations

### Shared File Modification Protocol
1. **No Direct Edits in Worker Branches**: Workers should avoid editing shared infrastructure files without coordination.
2. **Pull Request Documentation**: If a worker requires a shared file change (such as mounting a new router in `main.py` or adding an environment variable to `config.py`), they must explicitly describe the required diff in their Pull Request description.
3. **Integration Review**: The Integration Lead will review the PR, reconcile the shared file updates during merge, and verify overall stability.

