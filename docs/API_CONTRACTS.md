# Chennai Mobility AI — API Contracts Specification

This document defines the strict API contracts, request/response JSON schemas, validation rules, error payloads, and module ownership for all endpoints in the Chennai Mobility AI ecosystem.

---

## Standard Error Format

All error responses across all endpoints adhere to the following schema:

```json
{
  "error": {
    "code": "STRING (e.g. VALIDATION_ERROR, NOT_FOUND, INTEGRATION_NOT_CONFIGURED, CONSENT_REQUIRED)",
    "message": "STRING (human readable explanation)",
    "details": "ARRAY | OBJECT | null"
  },
  "timestamp": "ISO-8601 UTC string",
  "request_id": "UUID string"
}
```

---

## Shared Data Types

### 1. `DataFreshness`
Metadata tracking transit data origin and currency.
```json
{
  "source": "MTC Chennai GTFS Static",
  "last_updated": "2026-11-05T08:00:00Z",
  "is_live": false,
  "notes": "Static timetable schedules. Live GPS feeds not enabled."
}
```

### 2. `CallSession`
Represents an inbound telephone call session.
```json
{
  "call_id": "call-f92e8a10-2b1a-4c2f-b48e-73c683b54432",
  "caller_phone": "+919840123456",
  "start_time": "2026-11-05T09:15:30Z",
  "end_time": "2026-11-05T09:17:45Z",
  "duration_seconds": 135,
  "language": "ta",
  "status": "completed",
  "summary": "Inquiry regarding bus routes from Tambaram to T. Nagar",
  "metadata": {
    "telephony_provider": "exotel",
    "caller_circle": "Tamil Nadu"
  }
}
```

### 3. `ConversationTurn`
Individual conversational exchange between caller and the voice assistant.
```json
{
  "turn_id": "turn-001",
  "call_id": "call-f92e8a10-2b1a-4c2f-b48e-73c683b54432",
  "turn_index": 1,
  "speaker": "caller",
  "language": "ta",
  "transcript_raw": "தாம்பரத்தில இருந்து தி நகர் போக என்ன பஸ் இருக்கு?",
  "transcript_translated": "What bus is available to go from Tambaram to T. Nagar?",
  "intent": "route_query",
  "audio_url": null,
  "latency_ms": 340.5,
  "timestamp": "2026-11-05T09:15:35Z"
}
```

### 4. `JourneyRequest`
Search query for route options.
```json
{
  "origin": "Tambaram",
  "destination": "T. Nagar",
  "departure_time": "2026-11-05T09:30:00Z",
  "language": "ta",
  "max_transfers": 2,
  "preferred_mode": "all"
}
```
*Validation Rules*:
- `origin`: string, minimum 2 characters.
- `destination`: string, minimum 2 characters.
- `max_transfers`: integer between 0 and 4.
- `preferred_mode`: one of `["all", "bus", "metro", "suburban_train"]`.

### 5. `RouteOption`
A concrete route recommendation between origin and destination.
```json
{
  "option_id": "opt-mtc-29c-direct",
  "mode": "bus",
  "route_numbers": ["29C"],
  "origin_stop": "Tambaram Sanatorium",
  "destination_stop": "T. Nagar Bus Terminus",
  "transfers": 0,
  "estimated_duration_minutes": 45,
  "fare_estimate_inr": 15.0,
  "instructions_tamil": "தாம்பரம் சானடோரியத்தில் 29C பேருந்தில் ஏறி தி.நகர் பேருந்து நிலையத்தில் இறங்கவும்.",
  "instructions_english": "Board bus 29C at Tambaram Sanatorium and alight at T. Nagar Bus Terminus.",
  "freshness": {
    "source": "MTC GTFS Static",
    "last_updated": "2026-11-05T00:00:00Z",
    "is_live": false,
    "notes": "Static timetable schedules."
  }
}
```

### 6. `JourneyResult`
Full response produced by the mobility engine.
```json
{
  "query": {
    "origin": "Tambaram",
    "destination": "T. Nagar",
    "departure_time": "2026-11-05T09:30:00Z",
    "language": "ta",
    "max_transfers": 2,
    "preferred_mode": "all"
  },
  "found": true,
  "options": [ ... ],
  "spoken_summary_ta": "தாம்பரத்தில் இருந்து தி நகருக்கு நேரடி பேருந்து 29C உள்ளது. பயண நேரம் சுமார் 45 நிமிடங்கள்.",
  "spoken_summary_en": "Direct bus 29C is available from Tambaram to T. Nagar. Travel time is approximately 45 minutes.",
  "disclaimer": "Schedules based on static transit feeds. Real-time conditions may vary."
}
```

### 7. `MessageRequest`
Request to dispatch a post-call summary message.
```json
{
  "recipient_phone": "+919840123456",
  "channel": "whatsapp",
  "template_name": "journey_summary_ta",
  "body": "சென்னை மொபிலிட்டி AI: தாம்பரம் முதல் தி.நகர் வரை பேருந்து 29C. கட்டணம் ₹15. நல்ல பயணம் அமையட்டும்!",
  "call_id": "call-f92e8a10-2b1a-4c2f-b48e-73c683b54432",
  "user_consent_granted": true
}
```
*Validation Rules*:
- `recipient_phone`: Valid E.164 phone string.
- `channel`: `"whatsapp"` or `"sms"`.
- `user_consent_granted`: **Must be true**. If false or omitted, the system rejects with HTTP 422 `CONSENT_REQUIRED`.

### 8. `MessageStatus`
Status of a dispatched message.
```json
{
  "message_id": "msg-90214a",
  "recipient_phone": "+919840123456",
  "channel": "whatsapp",
  "status": "sent",
  "error_reason": null,
  "sent_at": "2026-11-05T09:18:00Z"
}
```

### 9. `ComplaintRecord`
Passenger complaint grievance log.
```json
{
  "complaint_id": "cmp-20261105-01",
  "caller_phone": "+919840123456",
  "category": "bus_delay",
  "description": "Route 29C bus was delayed by 40 minutes at Guindy junction.",
  "route_number": "29C",
  "stop_name": "Guindy",
  "logged_at": "2026-11-05T09:17:00Z",
  "status": "recorded",
  "official_submission_confirmed": false
}
```
*Validation Rules*:
- `official_submission_confirmed`: **Must remain false** until an authorized integration is established.

---

## Detailed Endpoint Contracts

### 1. Route Discovery
* **Endpoint**: `POST /api/mobility/routes/search`
* **Owner**: Worker 2 (`worker/mobility-backend`)
* **Request**: `JourneyRequest` (JSON)
* **Response**: `JourneyResult` (JSON, HTTP 200)
* **Error States**:
  - `400 BAD_REQUEST`: Origin or destination unresolved.
  - `422 UNPROCESSABLE_ENTITY`: Query validation failed.
  - `501 NOT_IMPLEMENTED`: Engine uninitialised.

---

### 2. Stops Lookup
* **Endpoint**: `GET /api/mobility/stops/search`
* **Owner**: Worker 2 (`worker/mobility-backend`)
* **Query Parameters**:
  - `query`: string (min 2 chars, e.g. "Tambaram" or "தாம்பரம்")
  - `limit`: integer (default 10, max 50)
* **Response**:
```json
[
  {
    "stop_id": "ST_TAMBARAM",
    "stop_name": "Tambaram",
    "stop_name_tamil": "தாம்பரம்",
    "latitude": 12.9249,
    "longitude": 80.1000,
    "modes": ["bus", "suburban_train"]
  }
]
```

---

### 3. Voice Turn Processing
* **Endpoint**: `POST /api/voice/turn`
* **Owner**: Worker 1 (`worker/voice-telephony`)
* **Request**:
```json
{
  "call_id": "call-12345",
  "audio_base64": "optional chunk",
  "text_input": "Tambaram to Guindy",
  "language_hint": "ta"
}
```
* **Response**:
```json
{
  "turn": { ...ConversationTurn... },
  "suggested_actions": ["execute_mobility_search"],
  "response_audio_url": null,
  "response_text": "தாம்பரத்தில் இருந்து கிண்டிக்கு மின்சார ரயில் அல்லது 29C பேருந்து உள்ளது."
}
```

---

### 4. Telephony Inbound Webhook
* **Endpoint**: `POST /telephony/inbound`
* **Owner**: Worker 1 (`worker/voice-telephony`)
* **Request**: Provider webhook payload (e.g., Exotel CallInit XML/JSON form data)
* **Response**: Telephony carrier response instructions (e.g. Exotel response XML with WebSocket stream URL or IVR connect string)

---

### 5. Telephony Audio WebSocket
* **Endpoint**: `WS /telephony/audio/{call_id}`
* **Owner**: Worker 1 (`worker/voice-telephony`)
* **Protocol**:
  - Binary frames: 8kHz / 16kHz raw PCM or µ-law audio chunks from telephony carrier.
  - JSON text control frames: `{"event": "start", "call_id": "..."}`, `{"event": "stop"}`.
  - Outbound binary frames: Synthesized Tamil/English audio bytes for caller playback.

---

### 6. Telephony Call Completed
* **Endpoint**: `POST /telephony/call-completed`
* **Owner**: Worker 1 (`worker/voice-telephony`)
* **Request**:
```json
{
  "call_id": "call-12345",
  "duration_seconds": 120,
  "termination_reason": "caller_hangup",
  "recording_url": "https://storage.provider.com/call-12345.wav"
}
```
* **Response**: `{"status": "recorded", "session": { ...CallSession... }}`

---

### 7. Dashboard Calls Log
* **Endpoint**: `GET /api/dashboard/calls`
* **Owner**: Worker 3 (`worker/frontend-messaging`)
* **Query Parameters**: `limit` (int, default 50), `offset` (int, default 0)
* **Response**: `List[CallSession]` (JSON, HTTP 200)

---

### 8. Dashboard Journeys Log
* **Endpoint**: `GET /api/dashboard/journeys`
* **Owner**: Worker 3 (`worker/frontend-messaging`)
* **Query Parameters**: `limit` (int, default 50), `offset` (int, default 0)
* **Response**: `List[JourneyResult]` (JSON, HTTP 200)

---

### 9. Dashboard Complaints Log
* **Endpoint**: `GET /api/dashboard/complaints`
* **Owner**: Worker 3 (`worker/frontend-messaging`)
* **Query Parameters**: `limit` (int, default 50), `offset` (int, default 0)
* **Response**: `List[ComplaintRecord]` (JSON, HTTP 200)

---

### 10. Message Dispatch
* **Endpoint**: `POST /api/messages/send`
* **Owner**: Worker 3 (`worker/frontend-messaging`)
* **Request**: `MessageRequest` (JSON)
* **Response**: `MessageStatus` (JSON, HTTP 202 Accepted or HTTP 200 OK)
* **Error**: `HTTP 422 Unprocessable Entity` if `user_consent_granted` is false.

