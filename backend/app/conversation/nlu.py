"""Deterministic intent classification and slot extraction (Worker 1).

Rule-based NLU for Tamil, Indian English and Tanglish (code-mixed) transit
queries. Deliberately NO generative model: the assistant must never guess or
invent slots. Anything that cannot be extracted confidently is surfaced as
``unknown`` so the dialogue manager can ask the caller instead.

Intent coverage is aligned with the team's authored evaluation seeds in
backend/tests/fixtures/voice/intent_examples.csv (chennai_transport research
package, 2026-11-05): JOURNEY_SEARCH, FARE_QUERY, BUS_TIMING, BUS_ARRIVAL,
ALTERNATE_ROUTE, NEAREST_STOP, METRO_QUERY, TRAIN_QUERY, ACCESSIBILITY_QUERY,
COMPLAINT, LOST_PROPERTY.
"""
from dataclasses import dataclass, field
import re
from typing import List, Optional

SUPPORTED_LANGUAGES = ("ta", "en", "ta-en")

_TAMIL_SCRIPT = re.compile(r"[\u0B80-\u0BFF]")

# Romanised Tamil markers → code-mixed "Tanglish".
_TANGLISH_MARKERS = {
    "irundhu", "irunthu", "iruntu", "lerndhu", "lerundu", "lendhu",
    "poganum", "ponum", "poanum", "poenum", "pogalam", "poga",
    "enna", "yenna", "epdi", "eppadi", "eppdi", "enga", "enge", "engey",
    "venum", "venaam", "vendam", "vendaam", "irukku", "irukka", "iruku",
    "iruka", "illa", "illai", "ille", "aama", "aamam", "ama", "aam",
    "nandri", "vanakkam", "sollunga", "sollu", "pannunga", "anuppu",
    "anuppunga", "thirumba", "tirumba", "ippo", "ippa", "eppo", "eppa",
    "evvalavu", "evalo", "evlo", "yevlo", "busla", "bus-la",
    "kudukkanum", "edukkanum", "edhu", "kitta", "pathi", "vera", "veru",
    "tholanjiduchu", "tholanjiruchu", "tholanju", "varum", "indha",
}

# ---------------------------------------------------------------------------
# Intent keyword tables
# ---------------------------------------------------------------------------
_GREETINGS = {"hi", "hello", "hey", "vanakkam", "vanakam", "good morning", "good evening", "good afternoon"}
_END_CALL = {
    "bye", "goodbye", "bye bye", "hang up", "hangup", "that's all", "that is all",
    "thats all", "that's it", "that is it", "nothing else", "cut the call",
    "call cut pannunga", "cut pannunga", "pothum", "podhum", "mudinchuruchu",
}
_YES = {
    "yes", "yeah", "yep", "yup", "yes please", "correct", "right", "confirm",
    "confirmed", "ok", "okay", "sure", "go ahead", "please send", "send it",
    "haan", "han", "aama", "aamam", "ama", "aam", "seri", "sari", "aagattum",
}
_NO = {
    "no", "nope", "no thanks", "no thank you", "not now", "wrong", "incorrect",
    "don't send", "do not send", "cancel", "illa", "illai", "ille", "vendam",
    "vendaam", "venaam", "thappu", "thapu",
}
_HELP = {"help", "what can you do", "options", "menu"}
_REPEAT = {
    "repeat", "say again", "say that again", "come again", "pardon",
    "repeat please", "once more", "thirumba sollunga", "tirumba sollunga",
    "thirumba sollu",
}
_RETRY = {"retry", "try again", "search again", "check again", "try once more"}

_SUMMARY_WORDS = (
    "summary", "whatsapp", "sms", "text me", "send me", "send the",
    "send details", "send route", "anuppu", "anuppunga", "anupu",
)
_FARE_WORDS = (
    "fare", "price", "cost", "how much", "evlo", "evalo", "evvalavu", "yevlo",
    "kattanam", "kaasu",
)
_FARE_TA = ("கட்டணம்", "எவ்வளவு", "விலை")
_LIVE_WORDS = (
    "next bus", "next train", "next metro", "live", "real time", "real-time",
    "right now", "where is the bus", "when will", "arrive", "arriving",
    "eppo varum", "eppa varum", "ippo", "ippa", "varum", "vanthuducha",
)
_LIVE_TA = ("அடுத்த பஸ்", "அடுத்த பேருந்து", "அடுத்து வரும்", "எப்போது வரும்", "வரும்", "இப்போது")
_SCHEDULE_WORDS = (
    "first bus", "last bus", "first train", "last train", "first metro",
    "last metro", "timetable", "time table", "schedule", "timing",
    "when is", "when are", "what time", "eppo", "eppa",
)
_SCHEDULE_TA = ("முதல் பஸ்", "முதல் பேருந்து", "கடைசி பஸ்", "கடைசி பேருந்து", "எப்போது", "நேரம்", "அட்டவணை")
_ALTERNATE_WORDS = (
    "another", "alternate", "alternative", "other route", "different route",
    "another route", "other bus", "another bus", "vera route", "veru vali",
    "vera vali",
)
_ALTERNATE_TA = ("வேறு வழி", "வேறு பாதை", "வேறு பஸ்")
_NEAREST_WORDS = (
    "nearest", "nearby", "near me", "closest", "near by", "kitta", "pakkathula",
)
_NEAREST_TA = ("அருகில்", "அருகிலுள்ள", "பக்கத்தில்", "அருகில் உள்ள")
_ACCESS_WORDS = (
    "wheelchair", "accessible", "accessibility", "lift", "ramp", "handicap",
    "disabled",
)
_ACCESS_TA = ("சக்கர நாற்காலி", "மாற்றுத்திறனாளி", "லிப்ட்")
_LOST_WORDS = (
    "lost my", "lost a", "i lost", "left my", "forgot my", "missing bag",
    "lost bag", "tholanji", "tholanj", "marandhu",
)
_LOST_TA = ("தொலை", "மறந்து வைத்த", "காணவில்லை")
_COMPLAINT_WORDS = (
    "complaint", "complain", "rude", "misbehav", "accident", "unsafe",
    "overcrowd", "did not stop", "didn't stop", "driver was",
)
_COMPLAINT_TA = ("புகார்",)

_MODE_PATTERNS = (
    ("metro", re.compile(r"\bmetro\b|மெட்ரோ", re.IGNORECASE)),
    ("suburban_train", re.compile(r"\btrain\b|\brail\b|\bemu\b|ரயில்|ரயில", re.IGNORECASE)),
    ("bus", re.compile(r"\bbus\b|\bbusses\b|\bbuses\b|பஸ்|பேருந்து", re.IGNORECASE)),
)

_ROUTE_HINTS = re.compile(
    r"\b(bus|train|metro|route|go|get|reach|travel|direction|way)\b"
    r"|பஸ்|பேருந்து|ரயில்|மெட்ரோ|போக|போகணும்|போகவேண்டும்|எப்படி|செல்ல"
    r"|poganum|ponum|poanum|poga\b|epdi|eppadi",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Extraction result
# ---------------------------------------------------------------------------


@dataclass
class ExtractionResult:
    intent: str = "unknown"
    language: str = "en"
    origin: Optional[str] = None
    destination: Optional[str] = None
    preferred_mode: Optional[str] = None
    channel: Optional[str] = None  # whatsapp | sms
    # "high" when phrased explicitly (from X to Y / direct answer);
    # "low" when salvaged heuristically → manager must confirm before search.
    confidence: str = "high"
    cleaned_text: str = ""
    matched_keywords: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------


def detect_language(text: str, language_hint: Optional[str] = None) -> str:
    """Detect ta / en / ta-en. Tamil script wins, then romanised Tamil markers.

    The hint is only used when the text carries no clear signal of its own
    (e.g. a bare place name), so it can never override what was actually said.
    """
    if _TAMIL_SCRIPT.search(text):
        return "ta"
    tokens = re.findall(r"[a-zA-Z'-]+", text.lower())
    if any(tok in _TANGLISH_MARKERS for tok in tokens):
        return "ta-en"
    if tokens:
        return "en"
    if language_hint in SUPPORTED_LANGUAGES:
        return language_hint
    return "en"


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

_TRAILING_NOISE = re.compile(
    r"[\s,]+(?:by\s+)?(?:bus|metro|train|please|now|today|route|routes|"
    r"directions|details|fast|quick|quickly|irukka|iruka)\s*[?.!]*$",
    re.IGNORECASE,
)
_QUESTION_TAIL = re.compile(
    r"[\s,]+(?:how\s+(?:do\s+i|to|can\s+i)\s+(?:go|get|reach|travel)|"
    r"which\s+bus|what\s+bus|any\s+bus|is\s+there.*|what\s+is\s+the\s+way|"
    r"poganum|ponum|poanum|poga|epdi|eppadi|enna.*|yenna.*|evalo.*|evlo.*|"
    r"evvalavu.*|edukkanum.*|irukka.*|iruka.*)$",
    re.IGNORECASE,
)
_TA_QUESTION_TAIL = re.compile(
    r"\s*(?:போக|போகணும்|போகவேண்டும்|செல்ல|எப்படி|என்ன|எந்த|எது|நேரம்|எவ்வளவு|எப்போது|இருக்கா|இருக்கிறதா|உள்ளதா).*$"
)
_LEADING_FILLER = re.compile(
    r"^(?:\s*(?:i\s+want\s+to\s+go|i\s+need\s+to\s+go|i\s+am\s+going|"
    r"how\s+to\s+go|take\s+me|go|travel|reach)\s+)+",
    re.IGNORECASE,
)


def _clean_place(raw: str) -> str:
    text = raw.strip(" \t,.?!\"'")
    text = _QUESTION_TAIL.sub("", text)
    text = _TA_QUESTION_TAIL.sub("", text)
    while True:
        new = _TRAILING_NOISE.sub("", text)
        if new == text:
            break
        text = new.strip(" \t,.?!\"'")
    text = _LEADING_FILLER.sub("", text)
    return text.strip(" \t,.?!\"'-")


def _extract_channel(text: str) -> Optional[str]:
    lowered = text.lower()
    if "whatsapp" in lowered or "whats app" in lowered:
        return "whatsapp"
    if re.search(r"\bsms\b|text message", lowered):
        return "sms"
    return None


def _extract_mode(text: str) -> Optional[str]:
    hits = [mode for mode, pat in _MODE_PATTERNS if pat.search(text)]
    if len(hits) == 1:
        return hits[0]
    return None  # zero or several mentions → no single preference


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def _contains_any(norm_text: str, raw_text: str, words, tamil_words=()) -> bool:
    return any(w in norm_text for w in words) or any(w in raw_text for w in tamil_words)


# ---------------------------------------------------------------------------
# Origin / destination patterns
# ---------------------------------------------------------------------------

_EN_FROM_TO = re.compile(
    r"\bfrom\s+(?P<origin>.+?)\s+to\s+(?P<dest>.+)$", re.IGNORECASE | re.DOTALL
)
_EN_TO_FROM = re.compile(
    r"\bto\s+(?P<dest>.+?)\s+from\s+(?P<origin>.+)$", re.IGNORECASE | re.DOTALL
)
_EN_BARE_TO = re.compile(
    r"^(?P<origin>[A-Za-z][A-Za-z0-9 .&'()-]*?)\s+to\s+(?P<dest>[A-Za-z][A-Za-z0-9 .&'()-]*)$",
    re.IGNORECASE,
)
_EN_FROM_ONLY = re.compile(r"\bfrom\s+(?P<origin>.+)$", re.IGNORECASE)
_EN_TO_ONLY = re.compile(
    r"\b(?:go\s+to|going\s+to|travel\s+to|get\s+to)\s+(?P<dest>.+)$|^\s*to\s+(?P<dest2>.+)$",
    re.IGNORECASE,
)
# Reject filler/pronoun "origins" so "I want to go to X" is never parsed as
# origin="I want", destination="go to X".
_BARE_ORIGIN_BLOCKLIST = re.compile(
    r"^(?:i|we|you|he|she|they|want|need|like|how|what|when|where|is|there|are|"
    r"can|do|does|going|go|travel|get|reach|please)\b",
    re.IGNORECASE,
)
_BARE_DEST_BLOCKLIST = re.compile(r"^(?:go|reach|get|travel)\b", re.IGNORECASE)

# Split on "ிருந்து" (vowel-sign form, as in போரூரிலிருந்து) or the standalone
# word "இருந்து" (as in தாம்பரத்தில் இருந்து). The locative suffixes (ில/ல/த்தில)
# stay on the left and are stripped by _clean_tamil_origin.
_TA_FROM_SPLIT = re.compile(r"ிருந்து|இருந்து")
# Ordered longest-first. "த்த" variants restore the noun's final "ம்"
# (தாம்பரம் → தாம்பரத்தில்), "ய" variants restore the base (கிண்டி → கிண்டியில்).
_TA_SUFFIXES = (
    "த்திலிருந்து", "த்தில", "த்தில்",
    "யிலிருந்து", "யில்", "யில",
    "ிலிருந்து", "ில்", "ில",
    "லிருந்து", "ல",
)
_TA_DEST_CUT = re.compile(r"க்கு")

_TANGLISH_FROM_SPLIT = re.compile(
    r"\b(?:irundhu|irunthu|iruntu|lerndhu|lerundu|lendhu)\b", re.IGNORECASE
)
_TANGLISH_ORIGIN_SUFFIX = re.compile(r"[-\s]?(?:la|le|li)$", re.IGNORECASE)
_TANGLISH_DEST_CUT = re.compile(
    r"(?:[-\s]ku\b|\s+poganum\b|\s+ponum\b|\s+poanum\b|\s+poga\b|\s+epdi\b|"
    r"\s+eppadi\b|\s+enna\b|\s+yenna\b|\s+evalo\b|\s+evlo\b|\s+evvalavu\b|"
    r"\s+fare\b|\s+eppo\b|\s+eppa\b|\s+irukka\b|\s+iruka\b|\s+varum\b|"
    r"\s+first\b|\s+last\b|\s+next\b|\s+edukkanum\b|\s+vera\b|\s+veru\b)",
    re.IGNORECASE,
)

_CORRECT_ORIGIN = re.compile(
    r"(?:change|update|correct)\s+(?:the\s+)?origin\s+(?:to|is)\s+(?P<value>.+)$"
    r"|origin\s+(?:is|should\s+be|=)\s+(?P<value2>.+)$"
    r"|(?:no|not|actually|sorry)[,\s]+from\s+(?P<value3>.+)$",
    re.IGNORECASE,
)
_CORRECT_DEST = re.compile(
    r"(?:change|update|correct)\s+(?:the\s+)?destination\s+(?:to|is)\s+(?P<value>.+)$"
    r"|destination\s+(?:is|should\s+be|=)\s+(?P<value2>.+)$"
    r"|(?:no|not|actually|sorry)[,\s]+to\s+(?P<value3>.+)$",
    re.IGNORECASE,
)


_TA_LEADING_FILLER = re.compile(r"^(?:எனக்கு|நான்|நாங்க|எங்களுக்கு)\s+")
_TA_BARE_CONSONANTS = "கஙசஞடணதநபமயரலவளழறன"


def _clean_tamil_origin(left: str) -> str:
    left = _TA_LEADING_FILLER.sub("", left.strip()).strip()
    for suffix in _TA_SUFFIXES:
        if left.endswith(suffix):
            base = left[: -len(suffix)]
            if suffix.startswith("த்த"):
                base += "ம்"
            elif suffix.startswith("ி") and base and base[-1] in _TA_BARE_CONSONANTS:
                # போரூர் + இல் → போரூரில்: restore the lost pulli.
                base += "்"
            return base.strip()
    return left


def _clean_tamil_dest(right: str) -> str:
    # Cut question phrases first so "க்கு" inside words like இருக்கு cannot match.
    right = _TA_QUESTION_TAIL.sub("", right.strip()).strip()
    match = _TA_DEST_CUT.search(right)
    if match:
        value = right[: match.start()].strip()
        # Reverse common sandhi before க்கு:
        #   நகர் + க்கு → நகருக்கு  (ரு → ர்)
        #   பாலாறு + க்கு → பாலாற்றுக்கு (ற்று → று)
        if value.endswith("ரு"):
            value = value[:-2] + "ர்"
        elif value.endswith("ற்று"):
            value = value[:-3] + "று"
        return value
    return right


def _extract_ta_slots(text: str) -> Optional[dict]:
    parts = _TA_FROM_SPLIT.split(text, maxsplit=1)
    if len(parts) != 2:
        return None
    origin = _clean_tamil_origin(parts[0])
    destination = _clean_tamil_dest(parts[1])
    if not origin or not destination:
        return None
    return {"origin": origin, "destination": destination}


def _extract_tanglish_slots(text: str) -> Optional[dict]:
    parts = _TANGLISH_FROM_SPLIT.split(text, maxsplit=1)
    if len(parts) != 2:
        return None
    origin = _TANGLISH_ORIGIN_SUFFIX.sub("", parts[0].strip()).strip()
    right = parts[1].strip()
    cut = _TANGLISH_DEST_CUT.search(right)
    destination = right[: cut.start()] if cut else right
    destination = _clean_place(destination)
    origin = _clean_place(origin)
    if not origin or not destination:
        return None
    return {"origin": origin, "destination": destination}


def extract_slots(text: str, language: str) -> Optional[dict]:
    """Return {'origin','destination','confidence'} when a from→to pair is found."""
    if language == "ta":
        slots = _extract_ta_slots(text)
        if slots:
            return {**slots, "confidence": "high"}
    if language == "ta-en":
        slots = _extract_tanglish_slots(text)
        if slots:
            return {**slots, "confidence": "high"}

    # English from/to salvaged from code-mixed speech is lower confidence and
    # must be confirmed with the caller before searching.
    english_confidence = "low" if language == "ta-en" else "high"
    match = _EN_FROM_TO.search(text)
    if match:
        origin = _clean_place(match.group("origin"))
        destination = _clean_place(match.group("dest"))
        if origin and destination:
            return {"origin": origin, "destination": destination, "confidence": english_confidence}
    match = _EN_TO_FROM.search(text)
    if match:
        origin = _clean_place(match.group("origin"))
        destination = _clean_place(match.group("dest"))
        if origin and destination:
            return {"origin": origin, "destination": destination, "confidence": english_confidence}
    match = _EN_BARE_TO.match(text.strip())
    if match:
        origin = _clean_place(match.group("origin"))
        destination = _clean_place(match.group("dest"))
        if (
            origin
            and destination
            and not _BARE_ORIGIN_BLOCKLIST.match(origin)
            and not _BARE_DEST_BLOCKLIST.match(destination)
        ):
            return {"origin": origin, "destination": destination, "confidence": "high"}

    # English fallback on code-mixed text that used English from/to words.
    if language == "ta-en":
        match = _EN_FROM_TO.search(text)
        if match:
            origin = _clean_place(match.group("origin"))
            destination = _clean_place(match.group("dest"))
            if origin and destination:
                return {"origin": origin, "destination": destination, "confidence": "low"}
    return None


def extract_partial_slot(text: str, language: str) -> Optional[dict]:
    """Extract a single explicitly-marked slot ('from Guindy', 'to Central')."""
    if extract_slots(text, language):
        return None
    match = _EN_FROM_ONLY.search(text)
    if match:
        value = _clean_place(match.group("origin"))
        if value:
            return {"origin": value}
    match = _EN_TO_ONLY.search(text)
    if match:
        value = _clean_place(match.group("dest") or match.group("dest2") or "")
        if value:
            return {"destination": value}
    if language == "ta":
        parts = _TA_FROM_SPLIT.split(text, maxsplit=1)
        if len(parts) == 2 and not parts[1].strip():
            value = _clean_tamil_origin(parts[0])
            if value:
                return {"origin": value}
        ta_text = _TA_LEADING_FILLER.sub("", text.strip()).strip()
        dest_match = re.search(r"^(.+?)க்கு", ta_text)
        if dest_match and not _TA_FROM_SPLIT.search(ta_text):
            value = _clean_tamil_dest(ta_text)
            if value:
                return {"destination": value}
    if language == "ta-en":
        parts = _TANGLISH_FROM_SPLIT.split(text, maxsplit=1)
        if len(parts) == 2:
            right = parts[1].strip()
            if right:
                cut = _TANGLISH_DEST_CUT.search(right)
                value = _clean_place(right[: cut.start()] if cut else right)
                if value:
                    return {"destination": value}
            origin = _TANGLISH_ORIGIN_SUFFIX.sub("", parts[0].strip()).strip()
            if origin:
                return {"origin": _clean_place(origin)}
    return None


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def extract(text: str, language_hint: Optional[str] = None) -> ExtractionResult:
    """Classify intent + extract slots for one caller utterance."""
    result = ExtractionResult()
    result.language = detect_language(text, language_hint)
    cleaned = text.strip()
    result.cleaned_text = _clean_place(cleaned)
    norm = _normalize(cleaned)
    result.preferred_mode = _extract_mode(cleaned)
    result.channel = _extract_channel(cleaned)

    if not norm:
        result.intent = "unknown"
        return result

    # 1) Corrections take priority over bare yes/no ("no, from Guindy").
    match = _CORRECT_ORIGIN.search(cleaned)
    if match:
        value = next(g for g in match.groups() if g)
        result.intent = "correct_origin"
        result.origin = _clean_place(value)
        return result
    match = _CORRECT_DEST.search(cleaned)
    if match:
        value = next(g for g in match.groups() if g)
        result.intent = "correct_destination"
        result.destination = _clean_place(value)
        return result
    if result.language == "ta":
        if re.match(r"^(?:இல்லை|தவறு)[,\s]+", cleaned) and _TA_FROM_SPLIT.search(cleaned):
            parts = _TA_FROM_SPLIT.split(cleaned, maxsplit=1)
            value = _clean_tamil_origin(re.sub(r"^(?:இல்லை|தவறு)[,\s]+", "", parts[0]))
            if value:
                result.intent = "correct_origin"
                result.origin = value
                return result

    # 2) Short affirmative / negative answers (allow trailing channel words).
    stripped = re.sub(r"[.!?]+$", "", norm)
    words = stripped.split()
    head = " ".join(words[:2])
    if stripped in _YES or head in _YES or (words and words[0] in {"yes", "yeah", "aama", "aamam", "ama", "haan"}):
        result.intent = "confirm_yes"
        return result
    if stripped in _NO or head in _NO:
        result.intent = "confirm_no"
        return result

    # 3) Call control intents.
    if stripped in _END_CALL or any(stripped.endswith(p) for p in ("bye", "that's all", "thats all", "podhum", "pothum")):
        result.intent = "end_call"
        return result
    if stripped in {"thanks", "thank you", "nandri", "நன்றி", "thanks a lot", "thank you so much"}:
        result.intent = "acknowledge"
        return result
    if "நன்றி" in cleaned and ("பை" in cleaned or "போதும்" in cleaned):
        result.intent = "end_call"
        return result
    if cleaned in {"வணக்கம்", "வணக்கம்!"} or stripped in _GREETINGS:
        result.intent = "greeting"
        return result
    if stripped in _HELP:
        result.intent = "help"
        return result
    if stripped in _REPEAT or "திருப்ப" in cleaned or "மீண்டும் சொல்ல" in cleaned:
        result.intent = "repeat_request"
        return result
    if stripped in _RETRY or "மீண்டும் முயற்சி" in cleaned:
        result.intent = "retry_request"
        return result

    # 4) Out-of-scope passenger requests → honest, polite redirects.
    if _contains_any(norm, cleaned, _COMPLAINT_WORDS, _COMPLAINT_TA):
        result.intent = "complaint"
        return result
    if _contains_any(norm, cleaned, _LOST_WORDS, _LOST_TA):
        result.intent = "lost_property"
        return result

    # 5) Accessibility (no verified station-level data → UNKNOWN policy).
    if _contains_any(norm, cleaned, _ACCESS_WORDS, _ACCESS_TA):
        result.intent = "accessibility_query"
        slots = extract_slots(cleaned, result.language)
        if slots:
            result.origin, result.destination = slots["origin"], slots["destination"]
        return result

    # 6) Nearest stop / landmark (requires caller location → clarify).
    if _contains_any(norm, cleaned, _NEAREST_WORDS, _NEAREST_TA):
        result.intent = "nearest_stop"
        return result

    # 7) Written summary request.
    if any(word in norm for word in _SUMMARY_WORDS) or "அனுப்ப" in cleaned:
        if result.channel or any(
            phrase in norm
            for phrase in ("summary", "send me", "send the", "send details", "send route", "text me", "anuppu", "anuppunga")
        ) or "அனுப்ப" in cleaned:
            result.intent = "request_summary"
            return result

    # 8) Fare (no verified stop-to-stage mapping → UNKNOWN policy).
    if _contains_any(norm, cleaned, _FARE_WORDS, _FARE_TA):
        result.intent = "fare_query"
        slots = extract_slots(cleaned, result.language)
        if slots:
            result.origin, result.destination = slots["origin"], slots["destination"]
        return result

    # 9) Live arrival (no authorised real-time feed → UNKNOWN policy).
    if _contains_any(norm, cleaned, _LIVE_WORDS, _LIVE_TA):
        result.intent = "live_arrival_query"
        slots = extract_slots(cleaned, result.language)
        if slots:
            result.origin, result.destination = slots["origin"], slots["destination"]
        return result

    # 10) Scheduled first/last service (no verified current timetable).
    if _contains_any(norm, cleaned, _SCHEDULE_WORDS, _SCHEDULE_TA):
        result.intent = "schedule_query"
        slots = extract_slots(cleaned, result.language)
        if slots:
            result.origin, result.destination = slots["origin"], slots["destination"]
        return result

    # 11) Alternate route → re-search with same/updated slots.
    if _contains_any(norm, cleaned, _ALTERNATE_WORDS, _ALTERNATE_TA):
        result.intent = "alternate_route"
        slots = extract_slots(cleaned, result.language)
        if slots:
            result.origin, result.destination = slots["origin"], slots["destination"]
        return result

    # 12) Route query with slots.
    slots = extract_slots(cleaned, result.language)
    if slots:
        result.intent = "route_query"
        result.origin = slots["origin"]
        result.destination = slots["destination"]
        result.confidence = slots["confidence"]
        return result

    partial = extract_partial_slot(cleaned, result.language)
    if partial:
        if "origin" in partial:
            result.intent = "provide_origin"
            result.origin = partial["origin"]
        else:
            result.intent = "provide_destination"
            result.destination = partial["destination"]
        return result

    # 13) Route-ish phrasing without extractable slots → ask, never guess.
    if _ROUTE_HINTS.search(cleaned):
        result.intent = "route_query"
        result.confidence = "low"
        return result

    result.intent = "unknown"
    return result
