"""NLU tests (Worker 1).

The 33 parametrised seed cases come from the team's chennai_transport research
package (backend/tests/fixtures/voice/intent_examples.csv) — authored
evaluation utterances, NOT transport facts.
"""
import csv
from pathlib import Path

import pytest

from backend.app.conversation import nlu

FIXTURE = Path(__file__).parent / "fixtures" / "voice" / "intent_examples.csv"

INTENT_MAP = {
    "JOURNEY_SEARCH": {"route_query"},
    "FARE_QUERY": {"fare_query"},
    "BUS_TIMING": {"schedule_query"},
    "BUS_ARRIVAL": {"live_arrival_query"},
    "ALTERNATE_ROUTE": {"alternate_route"},
    "NEAREST_STOP": {"nearest_stop"},
    "METRO_QUERY": {"route_query"},
    "TRAIN_QUERY": {"route_query", "schedule_query"},
    "ACCESSIBILITY_QUERY": {"accessibility_query"},
    "COMPLAINT": {"complaint"},
    "LOST_PROPERTY": {"lost_property"},
}
LANG_MAP = {"ta": "ta", "en": "en", "tanglish": "ta-en"}
# Tamil slot expectations (romanised seed labels → Tamil surface forms).
TA_NAMES = {
    "Porur": "போரூர்",
    "Tambaram": "தாம்பரம்",
    "Guindy": "கிண்டி",
    "T Nagar": "தி நகர்",
    "Vadapalani": "வடபழனி",
    "Chennai Beach": "சென்னை கடற்கரை",
}
SLOTTED_INTENTS = {
    "JOURNEY_SEARCH", "FARE_QUERY", "BUS_TIMING", "ALTERNATE_ROUTE",
    "METRO_QUERY", "TRAIN_QUERY",
}


def _load_seeds():
    with FIXTURE.open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


SEEDS = _load_seeds()


def test_seed_fixture_is_complete_and_labelled():
    assert len(SEEDS) == 33
    assert all(row["status"] == "AUTHORED_EVALUATION_NOT_TRANSPORT_FACT" for row in SEEDS)


@pytest.mark.parametrize("row", SEEDS, ids=[r["example_id"] for r in SEEDS])
def test_dataset_seed_intent_and_language(row):
    ex = nlu.extract(row["utterance"])
    assert ex.intent in INTENT_MAP[row["intent"]], (
        f"{row['example_id']}: got {ex.intent}, want {INTENT_MAP[row['intent']]}"
    )
    assert ex.language == LANG_MAP[row["language"]]


@pytest.mark.parametrize(
    "row",
    [r for r in SEEDS if r["intent"] in SLOTTED_INTENTS],
    ids=[r["example_id"] for r in SEEDS if r["intent"] in SLOTTED_INTENTS],
)
def test_dataset_seed_slots(row):
    ex = nlu.extract(row["utterance"])
    assert ex.origin, f"{row['example_id']}: origin not extracted"
    assert ex.destination, f"{row['example_id']}: destination not extracted"
    if row["language"] == "ta":
        assert ex.origin == TA_NAMES[row["origin_text"]]
        assert ex.destination == TA_NAMES[row["destination_text"]]
    else:
        assert ex.origin.lower() == row["origin_text"].lower()
        # Tanglish E08 says just "Beach" for "Chennai Beach" — a shortened
        # surface form, which the stop resolver must handle downstream.
        assert row["destination_text"].lower() in ex.destination.lower() or (
            ex.destination.lower() in row["destination_text"].lower()
        )


# ---------------------------------------------------------------------------
# Unit behaviour
# ---------------------------------------------------------------------------


def test_language_detection():
    assert nlu.detect_language("தாம்பரம்") == "ta"
    assert nlu.detect_language("Tambaram to Guindy") == "en"
    assert nlu.detect_language("Guindy-la irundhu Central poganum") == "ta-en"
    # Hint never overrides an explicit script/marker signal.
    assert nlu.detect_language("தாம்பரம்", language_hint="en") == "ta"
    assert nlu.detect_language("", language_hint="ta") == "ta"


def test_english_from_to_extraction():
    ex = nlu.extract("How do I get from Porur to Guindy by bus?")
    assert ex.intent == "route_query"
    assert ex.origin == "Porur"
    assert ex.destination == "Guindy"
    assert ex.preferred_mode == "bus"
    assert ex.confidence == "high"


def test_english_bare_to_extraction():
    ex = nlu.extract("Tambaram to T. Nagar")
    assert (ex.origin, ex.destination) == ("Tambaram", "T. Nagar")


def test_tanglish_extraction():
    ex = nlu.extract("Guindy-la irundhu Central poganum, enna bus irukku?")
    assert ex.intent == "route_query"
    assert ex.language == "ta-en"
    assert ex.origin == "Guindy"
    assert ex.destination == "Central"


def test_tamil_extraction_with_fillers():
    ex = nlu.extract("எனக்கு போரூரிலிருந்து கிண்டிக்கு போகணும். எந்த பஸ்?")
    assert (ex.origin, ex.destination) == ("போரூர்", "கிண்டி")


def test_partial_slots():
    ex = nlu.extract("I want to go to T. Nagar")
    assert ex.intent == "provide_destination"
    assert ex.destination == "T. Nagar"
    ex = nlu.extract("from Tambaram")
    assert ex.intent == "provide_origin"
    assert ex.origin == "Tambaram"


def test_corrections():
    ex = nlu.extract("no, from Guindy")
    assert ex.intent == "correct_origin"
    assert ex.origin == "Guindy"
    ex = nlu.extract("destination is Chennai Central")
    assert ex.intent == "correct_destination"
    assert ex.destination == "Chennai Central"
    ex = nlu.extract("change origin to Adyar")
    assert ex.intent == "correct_origin"
    assert ex.origin == "Adyar"


def test_yes_no_and_channels():
    assert nlu.extract("yes").intent == "confirm_yes"
    assert nlu.extract("aama").intent == "confirm_yes"
    assert nlu.extract("seri").intent == "confirm_yes"
    assert nlu.extract("no").intent == "confirm_no"
    assert nlu.extract("vendam").intent == "confirm_no"
    ex = nlu.extract("yes whatsapp")
    assert ex.intent == "confirm_yes"
    assert ex.channel == "whatsapp"
    assert nlu.extract("send sms").channel == "sms"


def test_call_control():
    assert nlu.extract("bye").intent == "end_call"
    assert nlu.extract("that's all").intent == "end_call"
    assert nlu.extract("hello").intent == "greeting"
    assert nlu.extract("வணக்கம்").intent == "greeting"
    assert nlu.extract("repeat please").intent == "repeat_request"
    assert nlu.extract("retry").intent == "retry_request"
    assert nlu.extract("help").intent == "help"


def test_empty_and_unknown():
    assert nlu.extract("").intent == "unknown"
    assert nlu.extract("   ").intent == "unknown"
    assert nlu.extract("mmm hmmm").intent == "unknown"


def test_mode_preferences():
    assert nlu.extract("metro from Porur to Vadapalani").preferred_mode == "metro"
    assert nlu.extract("train from Tambaram to Beach").preferred_mode == "suburban_train"
    # Several modes mentioned → no single preference.
    assert nlu.extract("bus or metro from Porur to Guindy").preferred_mode is None


def test_route_hint_without_slots_never_guesses():
    ex = nlu.extract("I want to go somewhere by bus")
    assert ex.intent == "route_query"
    assert ex.origin is None
    assert ex.destination is None
