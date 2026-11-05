# Development Rules & Multi-Worker Collaboration Guide

This document establishes the mandatory engineering standards, Git branch etiquette, Pull Request processes, and testing gates for the Chennai Mobility AI team.

---

## 1. Branch Naming & Topography

The team operates on a strict isolated branch topology. The Git repository is `saran799/conversational-ai`.

| Branch Name | Role / Purpose | Worker |
| :--- | :--- | :--- |
| `main` | Production & integrated staging branch. Direct pushes are restricted to the Integration Lead. | Integration Lead |
| `backup/baseline-v1` | Immutable reference snapshot created immediately after foundation validation. | Integration Lead |
| `worker/voice-telephony` | Voice AI, Exotel telephony, Sarvam STT/TTS, conversation flow. | Worker 1 |
| `worker/mobility-backend` | Transit route planning, GTFS data ingestion, Chennai stop lookup. | Worker 2 |
| `worker/frontend-messaging` | Admin dashboard, voice testbench, SMS/WhatsApp delivery, complaints. | Worker 3 |

---

## 2. Module Ownership & Isolation Rules

1. **Strict Directory Boundaries**:
   - Each developer may only create and edit code inside their assigned directories (detailed in [MODULE_OWNERSHIP.md](MODULE_OWNERSHIP.md)).
   - Cross-module imports must strictly rely on public interfaces and abstract bases.
   - Do **NOT** introduce circular imports across modules.
2. **Mock Adapters for Independent Development**:
   - When developing features before a dependent module lands, implement clean mock adapters conforming to the contract.
   - All mock data or fixtures must be explicitly labeled (e.g. `SAMPLE FIXTURE ONLY - NOT FOR OFFICIAL DISPATCH`).
3. **No Unsanctioned External Claims**:
   - **Never invent** bus routes, timetables, fares, or real-time arrivals. All routing information must originate from verified GTFS static feeds or live APIs.
   - **Never claim** official government/MTC complaint filing without an authorized, legally binding backend integration.
   - **Consent Enforcement**: Outbound WhatsApp or SMS messages require verified passenger consent (`user_consent_granted=True`).
4. **Credential Security**:
   - Never hardcode API keys, secrets, or provider tokens. All credentials must be read from environment variables via `backend/app/config.py`.

---

## 3. Shared File Protection

The following files are maintained exclusively by the Integration Lead:
- `backend/app/main.py`
- `backend/app/config.py`
- `backend/app/database/`
- `backend/app/models/base.py`
- `backend/app/schemas/`
- Root config files (`.env.example`, `.gitignore`, `docker-compose.yml`, `requirements.txt`, `package.json`)

### Procedure for Shared File Updates:
If your feature requires a new environment variable or router registration:
1. Do not push uncoordinated edits directly to shared files.
2. Clearly document the required diff in your Pull Request description under a dedicated section: `### Required Shared File Changes`.
3. The Integration Lead will merge the change and reconcile dependencies during PR review.

---

## 4. Pull Request Requirements

Every PR submitted by a worker must satisfy the following checklist before merge:

1. **Target Branch**: PR must target `main`.
2. **Branch Hygiene**: PR must contain commits only from the author's designated `worker/*` branch.
3. **Automated Verification**:
   - Backend tests must pass: `pytest` exits 0 with 100% test success.
   - Frontend TypeScript check must pass: `npm run typecheck` exits 0.
   - Frontend build must pass: `npm run build` exits 0.
4. **Scope Verification**: PR must only touch files within the worker's assigned directory ownership.
5. **No Broken Contracts**: All API responses must adhere to [API_CONTRACTS.md](API_CONTRACTS.md).

---

## 5. Conflict Resolution Protocol

In the event of a Git merge conflict during integration:
1. Rebase your worker branch against latest `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
2. Resolve conflicts strictly within your owned directories.
3. If a conflict occurs in a shared file, pause and coordinate with the Integration Lead. Never force-push (`git push --force`) to `main`.

---

## 6. Testing Requirements

### Backend:
- Unit tests must be placed in `backend/tests/`.
- Every new endpoint must have a corresponding test verifying both HTTP 200/201 success paths and error responses (400, 404, 422).
- Health check `GET /health` must continue to pass without hard database dependencies.

### Frontend:
- Every new page must handle **Loading**, **Empty**, and **Error** states gracefully.
- No dummy buttons that claim to execute actions without real backend wiring.
- TypeScript strict mode must be preserved without `@ts-ignore` or `any` escapes.

