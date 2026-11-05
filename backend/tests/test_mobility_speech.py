import pytest
from backend.app.mobility.engine import EngineJourneyOption, EngineJourneyResult, EngineLeg
from backend.app.mobility.models import Stop
from backend.app.mobility.speech import SpeechFormatter, spell_out_route


def test_spell_out_route():
    assert spell_out_route("S27") == "S 27"
    assert spell_out_route("29C") == "29C"
    assert spell_out_route("M70") == "M 70"


def test_speech_formatter_direct_en():
    formatter = SpeechFormatter()
    stop_a = Stop(stop_id="MTC:1", stop_name="Porur", stop_name_ta="போரூர்")
    stop_b = Stop(stop_id="MTC:2", stop_name="Guindy", stop_name_ta="கிண்டி")

    leg = EngineLeg(
        leg_id="l1",
        mode="bus",
        route_id="R54",
        route_number="54",
        pattern_id="P1",
        board_stop=stop_a,
        alight_stop=stop_b,
        stops_count=8,
        board_sequence=1,
        alight_sequence=9,
    )
    opt1 = EngineJourneyOption(
        option_id="opt1",
        legs=[leg],
        transfers=0,
        total_stops=8,
        ranking_basis="fewest transfers",
    )
    opt2 = EngineJourneyOption(
        option_id="opt2",
        legs=[leg],
        transfers=0,
        total_stops=10,
        ranking_basis="fewest transfers",
    )

    result = EngineJourneyResult(
        status="OK",
        origin_stop=stop_a,
        destination_stop=stop_b,
        options=[opt1, opt2],
    )

    formatted = formatter.format_speech(result, language="en")
    speech = formatted["speech_text"]

    # Verify TTS rules: short, concise, includes caveat, fare, and advisory
    assert "Take bus 54 directly from Porur to Guindy" in speech
    assert "older timetable and may have changed" in speech
    assert "Fare is not confirmed" in speech
    assert "no reported traffic advisories" in speech.lower()
    assert formatted["follow_up_question"] == "Would you like to hear the next route option?"


def test_speech_formatter_direct_ta():
    formatter = SpeechFormatter()
    stop_a = Stop(stop_id="MTC:1", stop_name="Porur", stop_name_ta="போரூர்")
    stop_b = Stop(stop_id="MTC:2", stop_name="Guindy", stop_name_ta="கிண்டி")

    leg = EngineLeg(
        leg_id="l1",
        mode="bus",
        route_id="R54",
        route_number="54",
        pattern_id="P1",
        board_stop=stop_a,
        alight_stop=stop_b,
        stops_count=8,
        board_sequence=1,
        alight_sequence=9,
    )
    opt1 = EngineJourneyOption(
        option_id="opt1",
        legs=[leg],
        transfers=0,
        total_stops=8,
        ranking_basis="fewest transfers",
    )

    result = EngineJourneyResult(
        status="OK",
        origin_stop=stop_a,
        destination_stop=stop_b,
        options=[opt1],
    )

    formatted = formatter.format_speech(result, language="ta")
    speech = formatted["speech_text"]
    assert "நேரடி பேருந்து 54" in speech
    assert "போரூர் முதல் கிண்டி வரை" in speech
    assert "நேரங்கள் மாறியிருக்கலாம்" in speech
