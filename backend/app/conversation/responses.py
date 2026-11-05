"""Spoken response templates in Tamil and English (Worker 1).

Code-mixed Tanglish (``ta-en``) sessions receive Tamil responses — Tamil speech
with the caller's English place names preserved, which is the natural register
for Tanglish callers. Route content itself is NEVER composed here: it is spoken
verbatim from the mobility engine's verified ``spoken_summary_*`` fields.
"""
from typing import Dict

_TEMPLATES: Dict[str, Dict[str, str]] = {
    "welcome": {
        "ta": "வணக்கம்! சென்னை மொபிலிட்டி AI உங்களை வரவேற்கிறது. நீங்கள் எங்கிருந்து எங்கு செல்ல வேண்டும்?",
        "en": "Hello! Welcome to Chennai Mobility AI. Where would you like to travel from, and where to?",
    },
    "ask_origin": {
        "ta": "நீங்கள் எங்கிருந்து கிளம்புகிறீர்கள்? புறப்படும் இடத்தை சொல்லுங்கள்.",
        "en": "Where are you starting from? Please tell me your origin.",
    },
    "ask_destination": {
        "ta": "நீங்கள் எங்கு செல்ல வேண்டும்? சேரும் இடத்தை சொல்லுங்கள்.",
        "en": "Where would you like to go? Please tell me your destination.",
    },
    "confirm_route": {
        "ta": "{origin} இலிருந்து {destination} க்கு செல்ல வேண்டும், சரியாகவா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.",
        "en": "You want to travel from {origin} to {destination}, is that correct? Please say yes or no.",
    },
    "which_part_wrong": {
        "ta": "மன்னிக்கவும். சரியான புறப்படும் இடத்தை மீண்டும் சொல்லுங்கள்.",
        "en": "Sorry about that. Please say the correct origin again.",
    },
    "clarify_stop": {
        "ta": "'{query}' என்ற பெயரில் ஒன்றுக்கு மேற்பட்ட இடங்கள் கிடைத்தன: {candidates}. எந்த இடத்தை குறிப்பிடுகிறீர்கள்? முதலாவது, இரண்டாவது என்றோ பெயரைச் சொல்லியோ தேர்வு செய்யலாம்.",
        "en": "I found more than one place matching '{query}': {candidates}. Which one do you mean? You can say first, second, or the name.",
    },
    "unknown_place": {
        "ta": "மன்னிக்கவும், '{query}' என்ற இடம் எங்கள் போக்குவரத்து தரவில் கிடைக்கவில்லை. அருகிலுள்ள பெரிய நிறுத்தம் அல்லது ஊரின் பெயரை சொல்லுங்கள்.",
        "en": "Sorry, I couldn't find '{query}' in the transit data. Please say a nearby major stop or locality again.",
    },
    "places_unresolved": {
        "ta": "மன்னிக்கவும், அந்த இடங்களை போக்குவரத்து தரவில் உறுதி செய்ய முடியவில்லை. புறப்படும் இடத்தையும் சேரும் இடத்தையும் மீண்டும் சொல்லுங்கள்.",
        "en": "Sorry, I couldn't verify those places in the transit data. Please say your origin and destination again.",
    },
    "no_route": {
        "ta": "மன்னிக்கவும், {origin} இலிருந்து {destination} க்கு சரிபார்க்கப்பட்ட பயண பாதை எதுவும் கிடைக்கவில்லை. வேறு அருகிலுள்ள நிறுத்தங்களை சொல்லி முயற்சிக்கலாம்.",
        "en": "Sorry, no verified route was found from {origin} to {destination} in the transit data. You can try naming nearby stops instead.",
    },
    "mobility_unavailable": {
        "ta": "மன்னிக்கவும், பாதை தேடும் சேவை தற்காலிகமாக கிடைக்கவில்லை. சிறிது நேரம் கழித்து 'மீண்டும் முயற்சி' என்று சொன்னால் மீண்டும் தேடுகிறேன்.",
        "en": "Sorry, the route search service is temporarily unavailable. Say 'retry' in a moment and I will search again.",
    },
    "unclear": {
        "ta": "மன்னிக்கவும், எனக்கு தெளிவாக கேட்கவில்லை. தயவுசெய்து மீண்டும் சொல்லவும்.",
        "en": "Sorry, I didn't catch that. Could you please repeat?",
    },
    "unclear_final": {
        "ta": "மன்னிக்கவும், தொடர்ந்து தெளிவாக கேட்கவில்லை. இந்த அழைப்பை இப்போது முடிக்கிறேன். தயவுசெய்து மீண்டும் அழைக்கவும். நன்றி!",
        "en": "Sorry, I'm still unable to hear you clearly, so I'll end this call now. Please call again. Thank you!",
    },
    "live_static_only": {
        "ta": "என்னிடம் நிலையான கால அட்டவணை தகவல் மட்டுமே உள்ளது{source_part}. நேரடி வாகன வருகை தகவல் இந்த எண்ணில் இன்னும் இணைக்கப்படவில்லை.",
        "en": "I only have scheduled static timetable information{source_part}. Live vehicle arrival tracking is not connected to this line yet.",
    },
    "summary_ask": {
        "ta": "இந்த பயண விவரங்களை உங்கள் தொலைபேசி எண்ணுக்கு WhatsApp அல்லது SMS மூலம் அனுப்பவா?",
        "en": "Would you like this journey summary sent to your phone number via WhatsApp or SMS?",
    },
    "summary_channel_ask": {
        "ta": "WhatsApp மூலமா அல்லது SMS மூலமா அனுப்ப வேண்டும்?",
        "en": "Should I send it via WhatsApp or SMS?",
    },
    "consent_confirm": {
        "ta": "{number} என்ற எண்ணுக்கு {channel} மூலம் பயண விவரங்களை அனுப்பட்டுமா? அனுப்ப ஒப்புக்கொண்டால் 'ஆம்' என்று சொல்லுங்கள்.",
        "en": "Shall I send the journey summary via {channel} to {number}? Say 'yes' to give your consent.",
    },
    "consent_granted": {
        "ta": "சரி, அழைப்பு முடிந்ததும் {channel} மூலம் பயண விவரங்கள் அனுப்பப்படும். வேறு ஏதாவது உதவி வேண்டுமா?",
        "en": "Alright, the journey summary will be sent via {channel} after this call. Anything else I can help with?",
    },
    "consent_declined": {
        "ta": "சரி, எந்த செய்தியும் அனுப்பப்படாது. வேறு ஏதாவது உதவி வேண்டுமா?",
        "en": "Alright, no message will be sent. Anything else I can help with?",
    },
    "no_contact_available": {
        "ta": "மன்னிக்கவும், இந்த அழைப்பில் உங்கள் தொலைபேசி எண் கிடைக்கவில்லை. அழைத்த எண்ணுக்கு மட்டுமே விவரங்களை அனுப்ப முடியும், அதனால் இப்போது அனுப்ப இயலாது.",
        "en": "Sorry, the calling phone number isn't available in this session. Summaries can only be sent to the number you called from, so I can't send one right now.",
    },
    "no_route_to_send": {
        "ta": "அனுப்புவதற்கு இன்னும் பயண பாதை இல்லை. முதலில் எங்கிருந்து எங்கு செல்ல வேண்டும் என்று சொல்லுங்கள்.",
        "en": "There is no journey to send yet. First, tell me where you'd like to travel from and to.",
    },
    "complaint_redirect": {
        "ta": "மன்னிக்கவும், இந்த எண்ணில் புகார் பதிவு செய்யும் வசதி இன்னும் இல்லை. பயண வழி தகவல்களுக்கு மட்டும் என்னால் உதவ முடியும்.",
        "en": "Sorry, complaint registration is not available on this line yet. I can only help with journey directions.",
    },
    "help": {
        "ta": "எங்கிருந்து எங்கு செல்ல வேண்டும் என்று சொல்லுங்கள், சரிபார்க்கப்பட்ட பேருந்து, மெட்ரோ அல்லது ரயில் வழிகளை சொல்கிறேன். உதாரணம்: 'தாம்பரத்திலிருந்து தி நகர் போக என்ன பஸ்?'",
        "en": "Tell me where you want to travel from and to, and I'll share verified bus, metro or train routes. For example: 'What bus goes from Tambaram to T. Nagar?'",
    },
    "goodbye": {
        "ta": "நன்றி! சென்னை மொபிலிட்டி AI உடன் அழைத்ததற்கு நன்றி. உங்கள் பயணம் இனிதாக அமையட்டும்!",
        "en": "Thank you for calling Chennai Mobility AI. Have a safe and pleasant journey!",
    },
    "nothing_to_retry": {
        "ta": "இப்போது மீண்டும் தேட எதுவும் இல்லை. எங்கிருந்து எங்கு செல்ல வேண்டும் என்று சொல்லுங்கள்.",
        "en": "There's nothing to retry right now. Tell me where you'd like to travel from and to.",
    },
    "slot_updated": {
        "ta": "சரி, {slot} இடத்தை {value} என மாற்றிவிட்டேன்.",
        "en": "Okay, I've updated the {slot} to {value}.",
    },
    "origin_word": {"ta": "புறப்படும்", "en": "origin"},
    "destination_word": {"ta": "சேரும்", "en": "destination"},
    "repeat_unavailable": {
        "ta": "சொல்வதற்கு இன்னும் எதுவும் இல்லை. எங்கிருந்து எங்கு செல்ல வேண்டும் என்று சொல்லுங்கள்.",
        "en": "There's nothing to repeat yet. Tell me where you'd like to travel from and to.",
    },
    # -- Safe-answer policies from the chennai_transport research package ----
    # (fares/live/accessibility are UNKNOWN until verified sources exist)
    "no_verified_info": {
        "ta": "மன்னிக்கவும், இந்த பயணத்திற்கான சரிபார்க்கப்பட்ட தற்போதைய தகவல் என்னிடம் இல்லை.",
        "en": "Sorry, I don't have verified current information for this journey.",
    },
    "fare_unknown": {
        "ta": "மன்னிக்கவும், இந்த பயணத்திற்கான சரிபார்க்கப்பட்ட கட்டண தகவல் என்னிடம் இல்லை. கட்டண நிலைகளும் விதிகளும் உறுதி செய்யப்படவில்லை, அதனால் கட்டணத்தை சொல்ல முடியாது. பயண வழியை வேண்டுமானால் தேடித் தர முடியும்.",
        "en": "Sorry, I don't have verified fare information for this journey. Fare stages and boundary rules are not verified, so I can't quote a fare. I can look up the route for you instead.",
    },
    "schedule_static_only": {
        "ta": "சரிபார்க்கப்பட்ட தற்போதைய நேர அட்டவணை என்னிடம் இல்லை, அதனால் முதல் அல்லது கடைசி வண்டியின் நேரத்தை உறுதியாக சொல்ல முடியாது. பயண வழியை தேடித் தர முடியும்.",
        "en": "I don't have a verified current timetable, so I can't confirm first or last service times. I can look up the route for you instead.",
    },
    "accessibility_unknown": {
        "ta": "மன்னிக்கவும், நிலையங்கள் மற்றும் வண்டிகளின் அணுகல் வசதிகள் பற்றிய சரிபார்க்கப்பட்ட தகவல் என்னிடம் இல்லை. சக்கர நாற்காலி வசதி அல்லது லிப்ட் நிலையை உறுதியாக சொல்ல முடியாது.",
        "en": "Sorry, I don't have verified station-level accessibility information, so I can't confirm wheelchair access or lift status.",
    },
    "nearest_stop_ask": {
        "ta": "நீங்கள் எந்த இடத்திற்கு அருகில் இருக்கிறீர்கள்? மருத்துவமனை, கட்டிடம் அல்லது தெருவின் பெயரையும் பகுதியையும் சொல்லுங்கள். ஒரே பெயரில் பல இடங்கள் இருக்கலாம்.",
        "en": "Which place are you near? Please tell me the hospital, building or street name, and the area — the same name can match several sites or entrances.",
    },
    "lost_property_redirect": {
        "ta": "மன்னிக்கவும், தொலைந்த பொருட்களுக்கான உதவி இந்த எண்ணில் இன்னும் இல்லை. பயண வழி தகவல்களுக்கு மட்டும் என்னால் உதவ முடியும்.",
        "en": "Sorry, lost property assistance is not available on this line yet. I can only help with journey directions.",
    },
    "role_ask": {
        "ta": "{value} என்பது நீங்கள் புறப்படும் இடமா அல்லது செல்ல வேண்டிய இடமா?",
        "en": "Is {value} where you're starting from, or where you're going?",
    },
    "clarify_giveup": {
        "ta": "மன்னிக்கவும், அந்த இடத்தை என்னால் உறுதி செய்ய முடியவில்லை. வேறு அருகிலுள்ள பெரிய நிறுத்தத்தின் பெயரை சொல்லுங்கள்.",
        "en": "Sorry, I couldn't confirm that place. Please name a different nearby major stop.",
    },
}


def render(key: str, language: str, **kwargs) -> str:
    """Render a template. Tanglish (ta-en) is served with Tamil speech."""
    lang = "ta" if language in ("ta", "ta-en") else "en"
    template = _TEMPLATES[key][lang]
    return template.format(**kwargs) if kwargs else template


def static_source_part(language: str, source: str) -> str:
    if not source:
        return ""
    if language in ("ta", "ta-en"):
        return f" ({source})"
    return f" (source: {source})"
