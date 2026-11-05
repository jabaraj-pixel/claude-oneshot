# Chennai Mobility AI (சென்னை மொபிலிட்டி AI)

> **Telephone-First, Multilingual Public Transit AI Assistant for Chennai Metropolitan Region**

Chennai Mobility AI empowers Chennai commuters to call a standard telephone number from any mobile or feature phone, speak naturally in **Tamil, English, or Tanglish**, and receive verified public transit routing directions (MTC buses, CMRL metro, and suburban trains). After the call, commuters can receive an optional trip summary via SMS or WhatsApp with their consent.

---

## 1. System Architecture

The application is structured as a modular monolith:

```
conversational-ai/
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── main.py           # FastAPI entrypoint, middlewares, routers
│   │   ├── config.py         # Centralized configuration (pydantic-settings)
│   │   ├── api/              # API router & health check
│   │   ├── core/             # Logging, custom errors, exception handlers
│   │   ├── database/         # PostgreSQL connection & SQLAlchemy sessions
│   │   ├── models/           # SQLAlchemy declarative models
│   │   ├── schemas/          # Pydantic schemas (contracts & shared models)
│   │   ├── telephony/        # Inbound webhooks & WebSocket audio streams (Worker 1)
│   │   ├── voice/            # Sarvam AI STT & TTS speech adapters (Worker 1)
│   │   ├── conversation/     # Multi-turn dialogue orchestration (Worker 1)
│   │   ├── mobility/         # GTFS ingestion & Chennai routing engine (Worker 2)
│   │   ├── messaging/        # WhatsApp & SMS dispatch services (Worker 3)
│   │   └── complaints/       # Passenger grievance logs (Worker 3)
│   ├── tests/                # Pytest test suite
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React + TypeScript + Vite Dashboard
│   ├── src/
│   │   ├── components/       # UI widgets, health indicators, feedback states
│   │   ├── pages/            # Overview, Calls, Journeys, Complaints, Messaging, Settings
│   │   ├── layouts/          # Responsive dashboard shell & sidebar navigation
│   │   ├── services/         # Typed API clients
│   │   ├── hooks/            # Custom React hooks (health poller)
│   │   └── types/            # TypeScript data contracts
│   └── package.json          # Node dependencies
├── data/
│   └── fixtures/             # Chennai transit stops & routes test fixtures
├── docs/
│   ├── ARCHITECTURE.md       # End-to-end call lifecycle & workflows
│   ├── API_CONTRACTS.md      # Exact endpoint schemas, validation, & errors
│   ├── DEVELOPMENT_RULES.md  # Git workflow, PR checklist, & safety rules
│   └── MODULE_OWNERSHIP.md   # Workstream breakdown for 3 parallel developers
├── .env.example              # Sample environment variables
├── .gitignore                # Git exclusions
├── docker-compose.yml        # PostgreSQL container configuration
└── README.md                 # Primary project documentation
```

For complete workflow details, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 2. Multi-Worker Collaboration & Git Workflow

Three developers work in parallel on dedicated feature branches branched from a common baseline:

* **Worker 1**: Voice AI + Telephony (`worker/voice-telephony`)
* **Worker 2**: Mobility Backend + Transport Data (`worker/mobility-backend`)
* **Worker 3**: Frontend + Messaging (`worker/frontend-messaging`)

Shared files (`backend/app/main.py`, `backend/app/config.py`, database, and root configs) are governed exclusively by the Integration Lead. Review [docs/MODULE_OWNERSHIP.md](docs/MODULE_OWNERSHIP.md) and [docs/DEVELOPMENT_RULES.md](docs/DEVELOPMENT_RULES.md) before pushing code.

---

## 3. Installation & Local Setup

### Prerequisites
- Python 3.11+ (Python 3.13 supported)
- Node.js 18+ (Node.js 20+ recommended) & npm
- Docker (optional, for local PostgreSQL)

### Step 1: Clone Repository
```bash
git clone https://github.com/saran799/conversational-ai.git
cd conversational-ai
```

### Step 2: Environment Configuration
Copy the template environment file:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

---

## 4. Local Backend Startup

### 1. Set Up Python Virtual Environment
```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 2. (Optional) Start PostgreSQL Container
```bash
docker compose up -d postgres
```
*Note: PostgreSQL is optional for the foundation health check. If offline, the application safely operates in standalone mode without failing.*

### 3. Run FastAPI Application
```bash
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```
- Interactive Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

---

## 5. Local Frontend Startup

### 1. Install Node Dependencies
```bash
cd frontend
npm install
```

### 2. Start Vite Development Server
```bash
npm run dev
```
- Web Application: [http://localhost:5173](http://localhost:5173)

---

## 6. Running Tests

### Backend Tests (Pytest)
```bash
pytest backend/tests -v
```

### Frontend Verification
```bash
cd frontend
# TypeScript type check
npm run typecheck

# Production build
npm run build
```

---

## 7. Governance & Public Transit Compliance

1. **Anti-Hallucination**: The transit assistant never invents bus numbers, fares, timetables, or live vehicle tracking. All advice must originate from verified GTFS static schedules or official feeds.
2. **Passenger Consent Required**: Outbound SMS or WhatsApp summaries are never dispatched without verified spoken consent during the telephone call.
3. **No False Official Claims**: Complaint recording provides internal grievance tracking; official dispatch will not be claimed without authorized government/MTC APIs.
