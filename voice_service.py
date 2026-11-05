"""Dedicated Voice Streaming Microservice (Laptop 3).

Receives text from Laptop 2 (AI/Database Brain) and streams real-time audio chunks
directly to Laptop 1 (Cellular/Telephony Gateway) over ngrok with ZERO disk saving.
"""
from typing import AsyncGenerator, Optional
import edge_tts
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="Live Telephony Voice Synthesizer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VOICES = {
    "ta": "ta-IN-PallaviNeural",       # Tamil (youthful, energetic, natural)
    "ta-male": "ta-IN-ValluvarNeural", # Tamil (Male)
    "en": "en-IN-NeerjaNeural",        # Indian English (Female)
    "en-male": "en-IN-PrabhatNeural",  # Indian English (Male)
    "hi": "hi-IN-SwaraNeural",         # Hindi (Female)
}

def detect_language(text: str) -> str:
    for char in text:
        if "\u0b80" <= char <= "\u0bff":
            return "ta"
    return "en"

class SpeakRequest(BaseModel):
    text: str
    language: Optional[str] = None
    rate: Optional[str] = "+8%"
    pitch: Optional[str] = "+5Hz"

async def generate_audio_stream(
    text: str, voice_name: str, rate: str = "+8%", pitch: str = "+5Hz"
) -> AsyncGenerator[bytes, None]:
    """Streams audio chunks in real-time without touching the hard drive."""
    communicate = edge_tts.Communicate(text, voice_name, rate=rate, pitch=pitch)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            yield chunk["data"]

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Voice Streaming Synthesizer"}

@app.post("/stream-voice")
async def stream_voice(req: SpeakRequest):
    """Endpoint called by Laptop 2 or Laptop 1.
    
    Accepts text and returns a live HTTP audio/mpeg stream.
    Laptop 1 forwards this stream directly to the phone call.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    
    lang = req.language or detect_language(req.text)
    voice_name = VOICES.get(lang, VOICES["ta"])
    
    pitch = req.pitch if lang == "ta" else "+0Hz"
    rate = req.rate or "+8%"
    
    return StreamingResponse(
        generate_audio_stream(req.text, voice_name, rate=rate, pitch=pitch),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache",
            "Transfer-Encoding": "chunked",
            "X-Voice-Used": voice_name,
        },
    )

if __name__ == "__main__":
    import uvicorn
    # Runs locally on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
