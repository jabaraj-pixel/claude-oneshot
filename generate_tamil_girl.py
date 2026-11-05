import asyncio
import edge_tts

async def generate_teen_tamil_voice():
    output_file = "data/teen_tamil_girl_voice.mp3"
    
    # Lively, conversational, energetic Tamil transit assistant script
    text = (
        "ஹாய்! வணக்கம்! நான் உங்களோட சென்னை மொபிலிட்டி அசிஸ்டன்ட். "
        "இன்னைக்கு நீங்க எங்க போகணும்? பீக் ஹவர் டிராஃபிக் பத்தி கவலையே படாதீங்க, "
        "பஸ், மெட்ரோ, லோக்கல் ட்ரெயின் - எதுல போனா சீக்கிரம் போகலாம்னு நான் டக்குனு சொல்றேன்! சொல்லுங்க, எங்க கிளம்புறீங்க?"
    )
    
    # ta-IN-PallaviNeural tuned with slightly higher pitch (+12Hz) and faster energetic rate (+10%)
    # for a youthful, lively, interactive cadence
    voice = "ta-IN-PallaviNeural"
    rate = "+10%"
    pitch = "+15Hz"
    
    print(f"Generating energetic teen Tamil girl voice using {voice} (rate={rate}, pitch={pitch})...")
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(output_file)
    print(f"SUCCESS: Generated voice saved to: {output_file}")

if __name__ == "__main__":
    asyncio.run(generate_teen_tamil_voice())
