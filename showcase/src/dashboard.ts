import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import markUrl from '../assets/nam-payanam-mark.png?inline'
import { T } from './timeline'
import { FONT, clamp, easeInOut, easeOut, lerp, roundRect, seg, smooth } from './util'

const mark = new Image()
mark.src = markUrl

const W = 1440
const H = 900
const SIDE = 248

const C = {
  bg: '#F1F5F9',
  sidebar: '#0F172A',
  brand: '#1D63B8',
  navy: '#0B3C5D',
  card: '#FFFFFF',
  ink: '#0F172A',
  slate: '#334155',
  sub: '#64748B',
  line: '#E2E8F0',
  green: '#16A34A',
  greenSoft: '#DCFCE7',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  blue: '#2563EB',
  blueSoft: '#DBEAFE',
  purple: '#7C3AED',
  purpleSoft: '#EDE9FE',
}

export const DASH = {
  in: 0.4,
  toCallDetail: 4.8,
  toMessaging: 10.2,
  out: 14.3,
} as const

type Ctx = CanvasRenderingContext2D

function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.4
    ctx.stroke()
  }
}

function card(ctx: Ctx, x: number, y: number, w: number, h: number) {
  box(ctx, x + 1, y + 3, w, h, 16, 'rgba(15,23,42,0.06)')
  box(ctx, x, y, w, h, 16, C.card, C.line)
}

function text(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  weight = 600,
  color = C.ink,
  align: CanvasTextAlign = 'left',
  maxW?: number
) {
  ctx.font = `${weight} ${size}px ${FONT}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  if (maxW !== undefined) ctx.fillText(s, x, y, maxW)
  else ctx.fillText(s, x, y)
}

function wrapText(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  maxW: number,
  size: number,
  weight: number,
  color: string,
  lh = 1.44,
  maxLines = 6
) {
  ctx.font = `${weight} ${size}px ${FONT}`
  const words = s.split(' ')
  let line = ''
  let yy = y
  let count = 0
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) {
      count++
      if (count >= maxLines) {
        text(ctx, line + '…', x, yy, size, weight, color, 'left', maxW)
        return
      }
      text(ctx, line, x, yy, size, weight, color, 'left', maxW)
      line = w
      yy += size * lh
    } else {
      line = test
    }
  }
  if (line) text(ctx, line, x, yy, size, weight, color, 'left', maxW)
}

function badge(ctx: Ctx, s: string, x: number, y: number, bg: string, fg: string, maxW?: number) {
  ctx.font = `700 12px ${FONT}`
  const rawW = ctx.measureText(s).width + 22
  const w = maxW ? Math.min(rawW, maxW) : rawW
  box(ctx, x, y - 13, w, 26, 13, bg)
  text(ctx, s, x + w / 2, y + 0.5, 12, 700, fg, 'center', w - 16)
  return w
}

function sidebar(ctx: Ctx, page: number) {
  ctx.fillStyle = C.sidebar
  ctx.fillRect(0, 0, SIDE, H)

  if (mark.complete && mark.naturalWidth > 0) {
    box(ctx, 18, 20, 42, 36, 10, '#FFFFFF')
    ctx.drawImage(mark, 21, 23, 36, 30)
  }
  text(ctx, 'நம் பயணம்', 70, 30, 15.5, 800, '#FFFFFF', 'left', 164)
  text(ctx, 'Nam Payanam Admin', 70, 48, 11.5, 600, '#94A3B8', 'left', 164)
  ctx.fillStyle = '#1E293B'
  ctx.fillRect(0, 74, SIDE, 1)

  const nav = [
    ['Live Queries', '149'],
    ['Call Records & Summary', 'Audio'],
    ['WhatsApp & SMS Audit', 'Sent'],
    ['Complaints Intake', '0'],
    ['GTFS Schedule Store', 'MTC'],
  ]
  nav.forEach(([label, tag], i) => {
    const y = 104 + i * 50
    const active = i === page
    if (active) box(ctx, 12, y - 20, SIDE - 24, 40, 10, C.brand)
    text(ctx, label, 24, y, 13, active ? 700 : 500, active ? '#FFFFFF' : '#94A3B8', 'left', 152)
    box(ctx, SIDE - 64, y - 11, 48, 22, 6, active ? 'rgba(255,255,255,0.22)' : '#1E293B')
    text(ctx, tag, SIDE - 40, y, 10.5, 700, active ? '#FFFFFF' : '#64748B', 'center', 42)
  })

  box(ctx, 14, H - 106, SIDE - 28, 86, 12, '#1E293B')
  text(ctx, 'TELEPHONE LINE 149', 28, H - 82, 10.5, 800, '#FBBF24', 'left', 190)
  text(ctx, '● Kural Voice Bot Online', 28, H - 60, 12, 600, '#86EFAC', 'left', 190)
  text(ctx, 'Caller Numbers Masked', 28, H - 40, 11, 500, '#94A3B8', 'left', 190)
}

function topbar(ctx: Ctx, page: number) {
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(SIDE, 0, W - SIDE, 74)
  ctx.fillStyle = C.line
  ctx.fillRect(SIDE, 74, W - SIDE, 1)

  const titles = [
    ['Operations Overview · Helpline 149', 'Real-time stored passenger queries, call durations & messaging metrics'],
    ['Call Record #NP-CHN-14908 · AI Summary', 'Stored call audio recording, casual Tamil transcript & auto-summary'],
    ['Post-Call WhatsApp & SMS Delivery Audit', 'Verified CUMTA / MTC / CMRL GTFS route provenance & delivery receipts'],
  ]
  text(ctx, titles[page][0], SIDE + 28, 27, 18.5, 800, C.ink, 'left', 620)
  text(ctx, titles[page][1], SIDE + 28, 50, 12, 500, C.sub, 'left', 620)

  box(ctx, W - 258, 18, 230, 38, 19, C.greenSoft, '#86EFAC')
  text(ctx, '● API Healthy · Kural ta-IN Ready', W - 143, 37, 12, 700, '#166534', 'center', 210)
}

function drawOverview(ctx: Ctx, r: number) {
  const countUp = r > 1.0 ? 1 : 0
  const x0 = SIDE + 28
  const tw = W - SIDE - 56 // 1136px
  const kpis: [string, string, string, string, string][] = [
    ['Calls Answered (149)', countUp ? '1,429' : '1,428', '+1 Central → Sriperumbudur', C.blue, C.blueSoft],
    ['Avg Pickup Speed', '1.8 sec', 'Answered within 2 rings', C.green, C.greenSoft],
    ['Stored Route Queries', countUp ? '1,381' : '1,380', '100% verified static GTFS', C.purple, C.purpleSoft],
    ['WhatsApp + SMS Sent', countUp ? '1,342' : '1,340', 'Card + SMS delivered', C.amber, C.amberSoft],
  ]

  const kw = (tw - 48) / 4
  kpis.forEach(([lbl, val, sub, fg, bg], i) => {
    const x = x0 + i * (kw + 16)
    card(ctx, x, 96, kw, 130)
    box(ctx, x + kw - 46, 112, 32, 32, 10, bg)
    ctx.beginPath()
    ctx.arc(x + kw - 30, 128, 6.5, 0, Math.PI * 2)
    ctx.fillStyle = fg
    ctx.fill()
    text(ctx, lbl, x + 18, 124, 12.5, 600, C.sub, 'left', kw - 72)
    text(ctx, val, x + 18, 166, 30, 800, C.ink, 'left', kw - 36)
    text(ctx, sub, x + 18, 204, 11.5, 600, i === 0 && countUp ? C.green : C.sub, 'left', kw - 36)
  })

  // Stored Queries & Call Records Table — strictly spaced columns!
  const ty = 248
  card(ctx, x0, ty, tw, 620)
  text(ctx, 'Stored Passenger Queries & Call Summaries', x0 + 24, ty + 34, 17.5, 800, C.ink, 'left', 600)
  badge(ctx, '● Synced Automatically on Call Hangup', x0 + tw - 270, ty + 34, C.greenSoft, '#166534', 246)

  const cols = [x0 + 22, x0 + 162, x0 + 322, x0 + 594, x0 + 818, x0 + 994]
  const widths = [130, 150, 260, 210, 164, 116]
  const headers = ['CALL ID', 'CALLER NUMBER', 'STORED ROUTE QUERY', 'SUGGESTED ROUTE', 'POST-CALL MSG', 'TIME']
  box(ctx, x0 + 14, ty + 62, tw - 28, 36, 10, '#F8FAFC')
  headers.forEach((h, i) => text(ctx, h, cols[i], ty + 80, 11, 800, C.sub, 'left', widths[i]))

  const rows = [
    ['NP-CHN-14908', '+91 98401 ••••56', 'MGR Central → Sriperumbudur', 'Bus 53→578 / Metro', 'WhatsApp + SMS ✓', 'JUST NOW'],
    ['NP-CHN-14907', '+91 94442 ••••19', 'Tambaram → T. Nagar Bus Stand', 'MTC 29C / Suburban', 'SMS Sent ✓', '4m ago'],
    ['NP-CHN-14906', '+91 97908 ••••82', 'Poonamallee → Porur Junction', 'MTC 578 / 54 Direct', 'WhatsApp Card ✓', '9m ago'],
    ['NP-CHN-14905', '+91 98840 ••••41', 'Guindy → Anna Nagar Tower', 'CMRL Green Direct', 'SMS Sent ✓', '14m ago'],
    ['NP-CHN-14904', '+91 90031 ••••67', 'Wimco Nagar → Chennai Airport', 'CMRL Blue Line', 'WhatsApp + SMS ✓', '21m ago'],
    ['NP-CHN-14903', '+91 99405 ••••12', 'Adyar Depot → Koyambedu CMBT', 'MTC 23M → Metro', 'Voice Only', '28m ago'],
  ]

  rows.forEach((row, idx) => {
    const ry = ty + 134 + idx * 76
    const isNew = idx === 0
    if (isNew) {
      const hi = smooth(seg(r, 0.5, 1.2))
      box(ctx, x0 + 14, ry - 28, tw - 28, 60, 12, `rgba(219,234,254,${0.7 * hi})`, '#93C5FD')
    }
    text(ctx, row[0], cols[0], ry, 13, 800, isNew ? C.blue : C.ink, 'left', widths[0])
    text(ctx, row[1], cols[1], ry, 12.5, 600, C.slate, 'left', widths[1])
    text(ctx, row[2], cols[2], ry, 13, isNew ? 700 : 600, C.ink, 'left', widths[2])
    badge(ctx, row[3], cols[3], ry, isNew ? C.amberSoft : '#F1F5F9', isNew ? '#92400E' : C.slate, widths[3] - 8)
    text(ctx, row[4], cols[4], ry, 12.5, 700, row[4].includes('✓') ? C.green : C.sub, 'left', widths[4])
    badge(ctx, row[5], cols[5], ry, isNew ? C.greenSoft : '#F1F5F9', isNew ? '#166534' : C.sub, widths[5])
  })
}

function drawCallDetail(ctx: Ctx, r: number) {
  const x0 = SIDE + 28
  const tw = W - SIDE - 56 // 1136px

  // Top Call Audio Record Card
  card(ctx, x0, 94, tw, 168)
  badge(ctx, 'CALL RECORD STORED', x0 + 22, 124, C.blueSoft, C.blue)
  badge(ctx, 'PICKUP: 2 RINGS (1.8s)', x0 + 198, 124, C.greenSoft, '#166534')
  badge(ctx, 'CASUAL CHENNAI TAMIL (ta-IN)', x0 + 388, 124, C.amberSoft, '#92400E')
  text(ctx, 'Duration: 01m 08s · Caller: +91 98401 ••••56 · Line: 149', x0 + tw - 22, 124, 12.5, 600, C.sub, 'right', 420)

  // Stored Audio Waveform Bar
  box(ctx, x0 + 22, 152, tw - 44, 90, 14, '#0F172A')
  ctx.beginPath()
  ctx.arc(x0 + 60, 197, 21, 0, Math.PI * 2)
  ctx.fillStyle = '#F59E0B'
  ctx.fill()
  text(ctx, '▶', x0 + 62, 198, 15, 800, '#0F172A', 'center')
  text(ctx, 'rec_NP_CHN_14908.opus', x0 + 96, 182, 13.5, 700, '#FFFFFF', 'left', 290)
  text(ctx, '00:34 / 01:08 · Stored Call Audio', x0 + 96, 206, 11.5, 500, '#94A3B8', 'left', 290)

  const playP = clamp((r - DASH.toCallDetail) / 4.8)
  const barCount = 62
  for (let i = 0; i < barCount; i++) {
    const bx = x0 + 420 + i * 10.6
    const bh = 12 + Math.abs(Math.sin(i * 0.65 + 1.2) * Math.cos(i * 0.23)) * 44
    box(ctx, bx, 197 - bh / 2, 5.5, bh, 2.5, i / barCount <= playP ? '#FBBF24' : '#334155')
  }

  // Left Column: AI Call Summary + Extracted Query Slots
  const colW = (tw - 24) / 2 // 556px
  card(ctx, x0, 280, colW, 590)
  text(ctx, '✨ AI Call Summary (Auto-Generated)', x0 + 22, 316, 17, 800, C.ink, 'left', 330)
  badge(ctx, 'GROUNDED IN GTFS', x0 + colW - 182, 316, C.purpleSoft, C.purple, 162)

  box(ctx, x0 + 22, 344, colW - 44, 182, 14, '#F8FAFC', C.line)
  text(ctx, 'ENGLISH OPERATIONAL SUMMARY', x0 + 36, 368, 10.5, 800, C.blue)
  wrapText(
    ctx,
    'Caller standing outside MGR Chennai Central could not use Google Maps and dialed 149 for public transit to Sriperumbudur. Kural AI answered within 2 rings in casual Chennai Tamil and gave two verified routes: (1) MTC Bus 53 to Poonamallee → Bus 578, and (2) Central Metro Green Line to Koyambedu → Bus 578. Caller consented to WhatsApp Journey Card and SMS.',
    x0 + 36,
    396,
    colW - 72,
    12.5,
    500,
    C.slate,
    1.45,
    6
  )

  box(ctx, x0 + 22, 540, colW - 44, 152, 14, '#FFFBEB', '#FDE68A')
  text(ctx, 'தமிழ் அழைப்புச் சுருக்கம் (TAMIL SUMMARY)', x0 + 36, 564, 10.5, 800, '#B45309')
  wrapText(
    ctx,
    'சென்ட்ரல் வாசலில் இருந்து ஸ்ரீபெரும்புதூர் செல்ல வழி கேட்ட பயணிக்கு, குரல் AI பஸ் 53 → பூந்தமல்லி → பஸ் 578 மற்றும் சென்ட்ரல் மெட்ரோ → கோயம்பேடு → பஸ் 578 வழிகளை இயல்பான சென்னைத் தமிழில் விளக்கி, ஒப்புதலுடன் வாட்ஸ்அப் அட்டை மற்றும் SMS அனுப்பியது.',
    x0 + 36,
    592,
    colW - 72,
    12.5,
    600,
    '#78350F',
    1.48,
    4
  )

  const slots: [string, string][] = [
    ['Stored Origin', 'MGR Chennai Central'],
    ['Stored Destination', 'Sriperumbudur Stand'],
    ['Dial Channel', '149 Voice (No App)'],
    ['Message Consent', 'Granted (WA + SMS)'],
  ]
  const sw = (colW - 56) / 2
  slots.forEach(([k, v], i) => {
    const sx = x0 + 22 + (i % 2) * (sw + 12)
    const sy = 710 + Math.floor(i / 2) * 70
    box(ctx, sx, sy, sw, 58, 10, '#F1F5F9')
    text(ctx, k, sx + 14, sy + 18, 10.5, 700, C.sub, 'left', sw - 24)
    text(ctx, v, sx + 14, sy + 40, 12.5, 800, C.ink, 'left', sw - 24)
  })

  // Right Column: Clipped Casual Tamil Transcript (zero overflow!)
  const rx = x0 + colW + 24
  card(ctx, rx, 280, colW, 590)
  text(ctx, 'Stored Call Transcript (Casual Tamil)', rx + 22, 316, 17, 800, C.ink, 'left', colW - 44)

  const turns: [string, string, string, boolean][] = [
    ['Kural AI · 00:01', 'வணக்கம், நம் பயணம் ஹெல்ப்லைன்ல இருந்து குரல் பேசுறேன். எங்க போகணும்னு சொல்லுங்க?', 'Greeting', true],
    ['Caller · 00:08', 'ம்மா, சென்ட்ரல் வாசல்ல நிக்கிறேன். ஸ்ரீபெரும்புதூர் போகணும், கூகுள் மேப்ஸ் பாக்கத் தெரியாது…', 'Route Query', false],
    ['Kural AI · 00:19', 'ரொம்ப சிம்பிள் சார். சென்ட்ரல் ஸ்டாப்லயே 53 பஸ் ஏறி பூந்தமல்லி போய், அங்க 578 பஸ் மாறுங்க.', 'MTC 53 → 578', true],
    ['Caller · 00:33', 'சரிம்மா, ரோட்ல டிராஃபிக் அதிகமா இருந்தா மெட்ரோல போனா சீக்கிரம் போயிடலாமா?', 'Metro Ask', false],
    ['Kural AI · 00:40', 'சென்ட்ரல் மெட்ரோ கிரீன் லைன் → கோயம்பேடு → 578 பஸ். வாட்ஸ்அப் & SMS அனுப்பி விடட்டா?', 'CMRL + Consent', true],
    ['Caller · 00:56', 'ஆமா மா, அனுப்பி விடு, பாத்துக்க ஈஸியா இருக்கும். ரொம்ப நன்றிம்மா.', 'Consent = Yes', false],
  ]

  turns.forEach(([who, ta, meta, isBot], i) => {
    const ty = 346 + i * 84
    const bw = colW - 44
    box(ctx, rx + 22, ty, bw, 74, 12, isBot ? '#EFF6FF' : '#F0FDF4', isBot ? '#BFDBFE' : '#BBF7D0')
    ctx.save()
    roundRect(ctx, rx + 22, ty, bw, 74, 12)
    ctx.clip()
    text(ctx, who, rx + 34, ty + 17, 11, 800, isBot ? C.blue : C.green, 'left', 260)
    text(ctx, meta, rx + 22 + bw - 14, ty + 17, 10.5, 600, C.sub, 'right', 160)
    wrapText(ctx, ta, rx + 34, ty + 40, bw - 24, 11.5, 600, C.ink, 1.35, 2)
    ctx.restore()
  })
}

function drawMessagingAudit(ctx: Ctx) {
  const x0 = SIDE + 28
  const tw = W - SIDE - 56

  card(ctx, x0, 94, tw, 350)
  text(ctx, 'Post-Call Ticket & Summary Delivery (Call #NP-CHN-14908)', x0 + 24, 132, 17.5, 800, C.ink, 'left', 720)
  badge(ctx, '✓ CONSENT LOGGED: CONSENT-14908', x0 + tw - 296, 132, C.greenSoft, '#166534', 272)

  const jobs = [
    [
      'WhatsApp Business Cloud API',
      'Graphical Journey Card (பயண அட்டை · Bus 53→578 & Metro→578)',
      'Recipient: +91 98401 ••••56   ·   ID: wamid.NP_CHN_14908   ·   0.9s after hangup',
      'DELIVERED ✓✓',
      '#DCFCE7',
      '#166534',
    ],
    [
      'SMS Gateway (DLT Cellular Fallback)',
      'Tamil + English Route Text (Works on any keypad phone without internet)',
      'Recipient: +91 98401 ••••56   ·   ID: sms.VM_NAMPYN_14908   ·   1.4s after hangup',
      'DELIVERED ✓',
      '#DBEAFE',
      '#1E40AF',
    ],
  ]

  jobs.forEach(([chan, tmpl, meta, st, bg, fg], i) => {
    const jy = 168 + i * 124
    box(ctx, x0 + 24, jy, tw - 48, 108, 14, '#F8FAFC', C.line)
    text(ctx, chan, x0 + 42, jy + 28, 15, 800, C.ink, 'left', tw - 310)
    text(ctx, tmpl, x0 + 42, jy + 55, 13, 600, C.slate, 'left', tw - 310)
    text(ctx, meta, x0 + 42, jy + 82, 12, 500, C.sub, 'left', tw - 120)
    badge(ctx, st, x0 + tw - 208, jy + 32, bg, fg, 166)
  })

  card(ctx, x0, 466, tw, 402)
  text(ctx, 'Deterministic Transit Engine Provenance (Zero Hallucination)', x0 + 24, 504, 17.5, 800, C.ink, 'left', 700)
  badge(ctx, 'SOURCE: CUMTA / MTC STATIC GTFS', x0 + tw - 310, 504, C.amberSoft, '#92400E', 286)

  const checks = [
    ['Channel Simplicity', 'Caller dialed 149 on regular phone keypad — zero smartphone app or Maps required'],
    ['Verified Bus Path', 'MTC Route 53 (MGR Central → Poonamallee) + MTC Route 578 (Poonamallee → Sriperumbudur)'],
    ['Verified Metro Path', 'CMRL Green Line (Central Metro → Koyambedu CMBT) + MTC Route 578'],
    ['Freshness Policy', 'Explicitly marked SCHEDULED static GTFS timetable — never invents live bus GPS'],
    ['Admin Storage', 'Query slots, call audio recording & bilingual AI summary persisted in PostgreSQL'],
  ]
  checks.forEach(([k, v], i) => {
    const cy = 546 + i * 60
    box(ctx, x0 + 24, cy, tw - 48, 48, 10, '#F8FAFC')
    text(ctx, '✓  ' + k, x0 + 40, cy + 24, 13, 800, C.navy, 'left', 230)
    text(ctx, v, x0 + 286, cy + 24, 12.5, 500, C.slate, 'left', tw - 330)
  })
}

function cursorArrow(ctx: Ctx, x: number, y: number, click: number) {
  if (click > 0) {
    ctx.beginPath()
    ctx.arc(x, y, 10 + (1 - click) * 22, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(29,99,184,${0.35 * click})`
    ctx.fill()
  }
  ctx.save()
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 26)
  ctx.lineTo(7, 20)
  ctx.lineTo(12, 31)
  ctx.lineTo(17, 29)
  ctx.lineTo(12, 18)
  ctx.lineTo(21, 18)
  ctx.closePath()
  ctx.fillStyle = '#0F172A'
  ctx.fill()
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

export function drawDashboard(ctx: Ctx, t: number, withCursor = true) {
  const r = clamp(t - T.admin, 0, 20)
  const page = r < DASH.toCallDetail ? 0 : r < DASH.toMessaging ? 1 : 2

  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)

  sidebar(ctx, page)
  topbar(ctx, page)

  if (page === 0) drawOverview(ctx, r)
  else if (page === 1) drawCallDetail(ctx, r)
  else drawMessagingAudit(ctx)

  if (withCursor) {
    let cx = 760
    let cy = 400
    if (r < DASH.toCallDetail) {
      const k = easeInOut(seg(r, 2.8, 4.5))
      cx = lerp(900, 118, k)
      cy = lerp(382, 154, k)
    } else if (r < DASH.toMessaging) {
      const k = easeInOut(seg(r, 8.4, 9.9))
      cx = lerp(620, 118, k)
      cy = lerp(490, 204, k)
    } else {
      cx = lerp(118, 760, easeInOut(seg(r, 10.3, 12.0)))
      cy = lerp(204, 340, easeInOut(seg(r, 10.3, 12.0)))
    }
    const click = Math.max(
      clamp(1 - Math.abs(r - DASH.toCallDetail) / 0.25),
      clamp(1 - Math.abs(r - DASH.toMessaging) / 0.25)
    )
    cursorArrow(ctx, cx, cy, click)
  }
}

export function createDashboardMonitor() {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter

  const group = new THREE.Group()
  const SW = 2.56
  const SH = (SW * H) / W
  const bezel = new THREE.Mesh(
    new RoundedBoxGeometry(SW + 0.1, SH + 0.1, 0.07, 3, 0.03),
    new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.35, metalness: 0.45 })
  )
  group.add(bezel)
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(SW, SH),
    new THREE.MeshBasicMaterial({
      map: tex,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
  )
  screen.position.z = 0.042
  group.add(screen)

  let lastQ = -1
  return {
    group,
    size: { w: SW + 0.1, h: SH + 0.1 },
    render(t: number) {
      const q = Math.round(t * 16)
      if (q === lastQ) return
      lastQ = q
      drawDashboard(ctx, t, true)
      tex.needsUpdate = true
    },
  }
}

export function paintDashboardStill(target: HTMLCanvasElement, onReady?: () => void) {
  const full = document.createElement('canvas')
  full.width = W
  full.height = H
  const draw = () => {
    drawDashboard(full.getContext('2d')!, T.admin + 6.5, false)
    const c = target.getContext('2d')!
    c.drawImage(full, 0, 0, target.width, target.height)
    onReady?.()
  }
  draw()
  if (!mark.complete) mark.addEventListener('load', draw, { once: true })
}

export function monitorK(t: number) {
  const r = t - T.admin
  return Math.min(easeOut(clamp((r - DASH.in) / 0.7)), 1 - smooth(seg(r, DASH.out, DASH.out + 0.6)))
}
