"""Local text-conversation demo (Worker 1) — no credentials required.

    # Interactive chat against the real dialogue manager (mobility unconfigured)
    python -m backend.app.conversation.demo

    # Interactive chat with an explicitly LABELLED mock mobility engine
    python -m backend.app.conversation.demo --mock-mobility

    # Non-interactive scripted walkthrough (English + Tamil)
    python -m backend.app.conversation.demo --scripted --mock-mobility

The mock engine below returns fictional TEST-1 fixtures so the dialogue can be
exercised end-to-end. It is NOT route computation and NOT real transit data.
"""
import argparse
import asyncio
from datetime import datetime, timezone
from typing import List

from backend.app.conversation.call_records import CallRecordStore
from backend.app.conversation.manager import ConversationManager
from backend.app.conversation.mobility_client import (
    BaseMobilityClient,
    UnconfiguredMobilityClient,
)
from backend.app.schemas.shared import (
    DataFreshness,
    JourneyRequest,
    JourneyResult,
    RouteOption,
)


class _DemoMobilityClient(BaseMobilityClient):
    """MOCK — DEVELOPMENT DEMO ONLY. Fictional TEST-1 route, no real data."""

    async def search_stops(self, query: str, limit: int = 5) -> List[dict]:
        return [{"stop_id": f"DEMO:{query.lower()}", "stop_name": query, "modes": ["bus"]}]

    async def search_routes(self, request: JourneyRequest) -> JourneyResult:
        freshness = DataFreshness(
            source="DEMO MOCK FIXTURE - NOT LIVE DATA",
            last_updated=datetime.now(timezone.utc),
            is_live=False,
            notes="Fictional demo route. Not for passenger use.",
        )
        option = RouteOption(
            option_id="demo-opt-1",
            mode="bus",
            route_numbers=["TEST-1"],
            origin_stop=request.origin,
            destination_stop=request.destination,
            transfers=0,
            estimated_duration_minutes=40,
            fare_estimate_inr=None,
            instructions_tamil="இது ஒரு டெமோ வழி மட்டுமே (TEST-1).",
            instructions_english="This is a demo route only (TEST-1).",
            freshness=freshness,
        )
        return JourneyResult(
            query=request,
            found=True,
            options=[option],
            spoken_summary_ta=(
                f"{request.origin} இலிருந்து {request.destination} க்கு TEST-1 டெமோ பேருந்து உள்ளது. "
                "பயண நேரம் சுமார் 40 நிமிடங்கள். (இது உண்மையான தரவு அல்ல.)"
            ),
            spoken_summary_en=(
                f"Demo bus TEST-1 runs from {request.origin} to {request.destination}. "
                "Travel time is about 40 minutes. (This is not real data.)"
            ),
            disclaimer="DEMO MOCK ONLY - NOT FOR OFFICIAL DISPATCH.",
        )


def _build_manager(mock_mobility: bool) -> ConversationManager:
    mobility = _DemoMobilityClient() if mock_mobility else UnconfiguredMobilityClient()
    manager = ConversationManager(mobility_client=mobility, call_records=CallRecordStore())
    if mock_mobility:
        print("*** MOCK MOBILITY ENGINE ENABLED — responses use fictional TEST-1 fixtures ***\n")
    else:
        print("*** Mobility engine unconfigured — route lookups will honestly report unavailability ***\n")
    return manager


async def _interactive(manager: ConversationManager) -> None:
    call_id = "demo-call"
    manager.call_records.ensure_session(call_id, caller_phone="+919840123456")
    print("Type your message (Tamil / English / Tanglish). 'bye' ends the call.\n")
    while True:
        try:
            text = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not text:
            continue
        reply = await manager.process_turn(call_id, text)
        print(f"AI [{reply.response_language}]: {reply.response_text}\n")
        if reply.next_action == "end_call":
            break
    record = manager.call_records.get(call_id)
    if record:
        print(f"Call record: status={record.status}, summary={record.summary!r}")


async def _scripted(manager: ConversationManager) -> None:
    scripts = [
        ("demo-en", [
            "hello",
            "I need to go from Tambaram to T. Nagar by bus",
            "yes, send it on whatsapp",
            "yes",
            "bye",
        ]),
        ("demo-ta", [
            "வணக்கம்",
            "தாம்பரத்திலிருந்து தி நகருக்கு போக என்ன பஸ்?",
            "vendam",
            "நன்றி பை",
        ]),
    ]
    for call_id, turns in scripts:
        manager.call_records.ensure_session(call_id, caller_phone="+919840123456")
        print(f"===== Scripted call {call_id} =====")
        for text in turns:
            reply = await manager.process_turn(call_id, text)
            print(f"You: {text}")
            print(f"AI [{reply.response_language}]: {reply.response_text}\n")
        record = manager.call_records.get(call_id)
        print(f"Call record: status={record.status}, summary={record.summary!r}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Chennai Mobility AI — local text dialogue demo")
    parser.add_argument("--mock-mobility", action="store_true", help="Use the labelled demo mock mobility engine")
    parser.add_argument("--scripted", action="store_true", help="Run scripted conversations instead of interactive chat")
    args = parser.parse_args()
    manager = _build_manager(args.mock_mobility)
    asyncio.run(_scripted(manager) if args.scripted else _interactive(manager))


if __name__ == "__main__":
    main()
