from datetime import datetime, timezone
import pytest
from pydantic import ValidationError

from backend.app.schemas.shared import (
    CallSession,
    ConversationTurn,
    DataFreshness,
    JourneyRequest,
    JourneyResult,
    MessageRequest,
    MessageStatus,
    ComplaintRecord,
    RouteOption,
)


def test_journey_request_validation():
    req = JourneyRequest(origin="Tambaram", destination="T. Nagar")
    assert req.origin == "Tambaram"
    assert req.destination == "T. Nagar"
    assert req.language == "ta"

    with pytest.raises(ValidationError):
        JourneyRequest(origin="A", destination="T. Nagar")  # too short (<2 chars)


def test_message_consent_enforcement():
    """Ensure message dispatch requires explicit user consent."""
    with pytest.raises(ValidationError):
        MessageRequest(
            recipient_phone="+919876543210",
            channel="whatsapp",
            body="Your journey from Tambaram to Guindy: Take bus 29C.",
            user_consent_granted=False,
        )

    msg = MessageRequest(
        recipient_phone="+919876543210",
        channel="whatsapp",
        body="Your journey from Tambaram to Guindy: Take bus 29C.",
        user_consent_granted=True,
    )
    assert msg.user_consent_granted is True


def test_call_session_model():
    session = CallSession(
        call_id="call-12345",
        caller_phone="+919876543210",
        start_time=datetime.now(timezone.utc),
        status="active",
        language="ta",
    )
    assert session.call_id == "call-12345"
    assert session.status == "active"


def test_complaint_record_default_official_flag():
    """Verify complaint defaults official_submission_confirmed to False."""
    rec = ComplaintRecord(
        complaint_id="cmp-999",
        caller_phone="+919876543210",
        category="bus_delay",
        description="Bus route 29C delayed by 40 minutes at Guindy.",
        logged_at=datetime.now(timezone.utc),
    )
    assert rec.official_submission_confirmed is False
    assert rec.status == "recorded"


def test_route_option_and_journey_result():
    freshness = DataFreshness(
        source="MTC GTFS Static",
        last_updated=datetime.now(timezone.utc),
        is_live=False,
    )
    option = RouteOption(
        option_id="opt-1",
        mode="bus",
        route_numbers=["29C"],
        origin_stop="Tambaram Sanatorium",
        destination_stop="T. Nagar Bus Terminus",
        transfers=0,
        estimated_duration_minutes=45,
        fare_estimate_inr=15.0,
        instructions_tamil="தாம்பரம் சானடோரியத்தில் 29C பேருந்தில் ஏறி தி.நகரில் இறங்கவும்.",
        instructions_english="Board bus 29C at Tambaram Sanatorium and alight at T. Nagar.",
        freshness=freshness,
    )
    result = JourneyResult(
        query=JourneyRequest(origin="Tambaram", destination="T. Nagar"),
        found=True,
        options=[option],
        spoken_summary_ta="தாம்பரத்தில் இருந்து தி.நகர் செல்ல 29C பேருந்து உள்ளது.",
        spoken_summary_en="Take bus 29C from Tambaram to T. Nagar.",
    )
    assert result.found is True
    assert len(result.options) == 1
    assert result.options[0].route_numbers == ["29C"]

