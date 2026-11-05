/**
 * Master timeline (seconds) for the Nam Payanam 3D Chennai Film.
 * Locked to exact decoded MP3 frame durations of the casual Chennai Tamil conversation.
 */
export const T = {
  intro: 0, // Aerial over MGR Chennai Central & Poonamallee High Road
  problem: 8.5, // Murugan confused by Google Maps — closes it
  remember: 18.0, // Spots Nam Payanam 149 shelter poster & dials phone number 1-4-9
  ringing: 26.5, // Raises phone to ear -> 2 rings -> Kural AI answers!
  call: 31.4, // Casual Chennai Tamil call: Central -> Bus 53 -> Poonamallee -> Bus 578
  metro: 64.0, // Follow-up: Central Metro Green Line -> Koyambedu -> Bus 578 + consent
  whatsapp: 99.5, // Call ends -> WhatsApp Journey Card arrives on his number
  sms: 108.0, // SMS summary arrives + MTC Bus 53 pulls into bay & Murugan boards cleanly
  admin: 116.5, // Admin Dashboard: stored query, call audio record & AI summary
  arch: 131.5, // 3D System Architecture Blueprint Diorama
  impact: 143.5, // Chennai-wide Metropolitan Transit Network
  end: 149.5, // Finale Crest over MGR Chennai Central
  total: 154.0,
} as const

export const CHAPTERS: { name: string; t: number }[] = [
  { name: 'MGR Central', t: T.intro },
  { name: 'Maps Confusion', t: T.problem },
  { name: 'Dial 149', t: T.remember },
  { name: '2 Rings · Kural', t: T.ringing },
  { name: 'Tamil Call', t: T.call },
  { name: 'Metro Option', t: T.metro },
  { name: 'WhatsApp Card', t: T.whatsapp },
  { name: 'SMS & Bus 53', t: T.sms },
  { name: 'Admin Summary', t: T.admin },
  { name: 'Architecture', t: T.arch },
  { name: 'Chennai Network', t: T.impact },
]

export type ClipKey =
  | '01_kural_welcome'
  | '02_user_query'
  | '03_kural_route'
  | '04_user_metro_ask'
  | '05_kural_metro_msg'
  | '06_user_consent'
  | '07_kural_goodbye'
  | '08_kural_live_policy'
  | '09_kural_repeat'

export interface CallTurn {
  id: number
  speaker: 'kural' | 'user'
  key: ClipKey
  start: number
  dur: number
  end: number
  tamil: string
  english: string
}

const rawTurns: Omit<CallTurn, 'end'>[] = [
  {
    id: 1,
    speaker: 'kural',
    key: '01_kural_welcome',
    start: 31.7,
    dur: 7.13,
    tamil: 'வணக்கம், நம் பயணம் ஹெல்ப்லைன்ல இருந்து குரல் பேசுறேன். நீங்க இப்போ எங்க இருக்கீங்க, எங்க போகணும்னு சொல்லுங்க?',
    english: 'Hello, Kural here from Nam Payanam helpline. Tell me where you are right now and where you need to go?',
  },
  {
    id: 2,
    speaker: 'user',
    key: '02_user_query',
    start: 39.4,
    dur: 10.37,
    tamil: 'ம்மா, நான் சென்ட்ரல் ஸ்டேஷன் வாசல்ல நிக்கிறேன். எனக்கு ஸ்ரீபெரும்புதூர் போகணும், ஆனா போன்ல கூகுள் மேப்ஸ்லாம் பாக்கத் தெரியாது. எந்த பஸ்ல போறதுன்னு கொஞ்சம் சொல்றியா?',
    english: 'Ma, I’m standing outside Central Station. I need to go to Sriperumbudur, and I don’t know how to use Google Maps. Can you tell me which bus to take?',
  },
  {
    id: 3,
    speaker: 'kural',
    key: '03_kural_route',
    start: 50.3,
    dur: 13.08,
    tamil: 'ரொம்ப சிம்பிள் தான் சார். நீங்க நிக்கிற சென்ட்ரல் பஸ் ஸ்டாப்லயே அம்பத்தி மூணு நம்பர் பஸ் ஏறுங்க, பூந்தமல்லி போயிடும். அங்க இறங்கி அஞ்சு ஏழு எட்டு பஸ் மாறுனீங்கன்னா, நேரா ஸ்ரீபெரும்புதூர் பஸ் ஸ்டாண்ட் போயிடலாம்.',
    english: 'Super simple sir. From the Central stop right where you are, board Bus 53 to Poonamallee. Get down there and switch to Bus 578 straight to Sriperumbudur.',
  },
  {
    id: 4,
    speaker: 'user',
    key: '04_user_metro_ask',
    start: 64.0,
    dur: 5.88,
    tamil: 'சரிம்மா, ஒருவேளை ரோட்ல டிராஃபிக் அதிகமா இருந்தா, மெட்ரோல போனா சீக்கிரம் போயிடலாமா?',
    english: 'Okay ma, if road traffic is heavy, can I take the Metro and reach faster?',
  },
  {
    id: 5,
    speaker: 'kural',
    key: '05_kural_metro_msg',
    start: 70.4,
    dur: 15.67,
    tamil: 'போலாம் சார். பக்கத்துலயே இருக்கிற சென்ட்ரல் மெட்ரோல கிரீன் லைன் ஏறி கோயம்பேடுல இறங்கிடுங்க. அங்க இருந்தே உங்களுக்கு அஞ்சு ஏழு எட்டு பஸ் கிடைக்கும். இந்த பஸ் நம்பர்லாம் மறக்காம இருக்க வாட்ஸ்அப்லயும் எஸ்எம்எஸ்லயும் அனுப்பி விடட்டா?',
    english: 'Yes sir. Take the Green Line from Central Metro nearby and get off at Koyambedu — Bus 578 starts right there. Shall I text these bus numbers to your WhatsApp and SMS?',
  },
  {
    id: 6,
    speaker: 'user',
    key: '06_user_consent',
    start: 86.6,
    dur: 4.61,
    tamil: 'ஆமா மா, அனுப்பி விடு, பாத்துக்க ஈஸியா இருக்கும். ரொம்ப நன்றிம்மா.',
    english: 'Yes ma, please send it — it’ll be easy to check. Thank you so much!',
  },
  {
    id: 7,
    speaker: 'kural',
    key: '07_kural_goodbye',
    start: 91.7,
    dur: 7.15,
    tamil: 'அனுப்பிட்டேன் சார், கால் கட் ஆன உடனே உங்க போனுக்கு மெசேஜ் வந்திடும். பாத்து பத்திரமா போயிட்டு வாங்க, வணக்கம்.',
    english: 'Sent sir — the message will hit your phone right as the call ends. Have a safe trip, vanakkam!',
  },
]

export const CALL_TURNS: CallTurn[] = rawTurns.map(r => ({
  ...r,
  end: +(r.start + r.dur).toFixed(2),
}))

/** Exact keypad taps when Murugan dials 1 - 4 - 9 and presses Call */
export const DIAL_TAPS: { digit: string; t: number; col: number; row: number }[] = [
  { digit: '1', t: 22.0, col: 0, row: 0 },
  { digit: '4', t: 23.0, col: 0, row: 1 },
  { digit: '9', t: 24.0, col: 2, row: 2 },
  { digit: 'call', t: 25.2, col: 1, row: 4 },
]

/** Exact 2-ring cadence before Kural AI picks up */
export const RING_EVENTS = {
  ring1Start: 26.9,
  ring1End: 28.3,
  ring2Start: 29.1,
  ring2End: 30.5,
  pickup: 31.3,
  hangup: 99.2,
  whatsappPing: 100.0,
  smsPing: 108.3,
} as const

export function activeTurnAt(t: number): CallTurn | null {
  for (const c of CALL_TURNS) {
    if (t >= c.start && t <= c.end + 0.15) return c
  }
  return null
}
