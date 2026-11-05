import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import logoUrl from '../assets/nam-payanam-logo.png?inline'
import markUrl from '../assets/nam-payanam-mark.png?inline'
import { DIAL_TAPS, RING_EVENTS, T } from './timeline'
import { FONT, clamp, easeOut, roundRect, seg, smooth } from './util'

const W = 360
const H = 780
const S = 1.5 // 540 x 1170 crisp high-FPS texture (zero lag on laptops!)

export const logoImg = new Image()
logoImg.src = logoUrl
export const markImg = new Image()
markImg.src = markUrl

const C = {
  navy: '#0B3C5D',
  blue: '#1D63B8',
  amber: '#F59E0B',
  green: '#16A34A',
  waGreen: '#075E54',
  waBg: '#ECE5DD',
  ink: '#0F172A',
  sub: '#475569',
  muted: '#94A3B8',
  line: '#E2E8F0',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  red: '#DC2626',
}

export const SCREENS: [string, number, number][] = [
  ['maps', 0, 18.2],
  ['dialer', 18.2, T.ringing],
  ['ringing', T.ringing, T.call],
  ['call', T.call, T.whatsapp],
  ['whatsapp', T.whatsapp, T.sms],
  ['sms', T.sms, T.total + 2],
]

type Ctx = CanvasRenderingContext2D

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 1) {
  roundRect(ctx, x, y, w, h, r)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.stroke()
  }
}

function card(ctx: Ctx, x: number, y: number, w: number, h: number, r = 16, fill = C.white) {
  // Fast zero-CPU-blur drop shadow + crisp border
  rr(ctx, x + 1, y + 3, w, h, r, 'rgba(15,23,42,0.08)')
  rr(ctx, x, y, w, h, r, fill, C.line, 1)
}

function txt(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  weight = 500,
  color = C.ink,
  align: CanvasTextAlign = 'left',
  maxW?: number
) {
  ctx.font = `${weight} ${size}px ${FONT}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  if (maxW !== undefined) ctx.fillText(s, x, y, maxW)
  else ctx.fillText(s, x, y)
}

function statusBar(ctx: Ctx, dark = false) {
  const col = dark ? '#FFFFFF' : C.ink
  txt(ctx, '10:12', 26, 28, 13, 700, col)
  txt(ctx, '4G', 278, 27, 10.5, 700, col)
  for (let i = 0; i < 4; i++) {
    rr(ctx, 296 + i * 4.5, 27 - (i + 1) * 2.6, 3, (i + 1) * 2.6, 1, col)
  }
  rr(ctx, 319, 17, 21, 10.5, 2.5, undefined, col, 1.2)
  rr(ctx, 321, 19, 15, 6.5, 1.2, dark ? '#4ADE80' : C.green)
  // Camera punch-hole
  rr(ctx, W / 2 - 36, 10, 72, 20, 10, '#050810')
}

function homeIndicator(ctx: Ctx, dark = false) {
  rr(ctx, W / 2 - 54, H - 15, 108, 4.5, 2.5, dark ? 'rgba(255,255,255,0.42)' : 'rgba(15,23,42,0.25)')
}

/* ---------- Screen 1: Confusing Google Maps UI (0 .. 18.2s) ---------- */
function drawMaps(ctx: Ctx, p: number, t: number) {
  ctx.fillStyle = '#E6ECE6'
  ctx.fillRect(0, 0, W, H)

  // Tangled unfamiliar map roads
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 10
  const roads = [
    [-20, 210, 380, 290],
    [70, 60, 145, 740],
    [255, 60, 195, 740],
    [-10, 440, 380, 385],
    [-10, 565, 380, 625],
  ]
  for (const [x1, y1, x2, y2] of roads) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.strokeStyle = '#FDBA74'
  ctx.lineWidth = 13
  ctx.beginPath()
  ctx.moveTo(-10, 330)
  ctx.bezierCurveTo(120, 345, 225, 305, 380, 335)
  ctx.stroke()

  // Tiny English-only map labels
  txt(ctx, 'EVR Periyar Salai', 155, 322, 10.5, 700, '#7C2D12')
  txt(ctx, 'Park Town', 42, 260, 10.5, 600, '#64748B')
  txt(ctx, 'Wall Tax Rd', 222, 430, 10.5, 600, '#64748B')

  // Blue dot with wide uncertain circle
  ctx.beginPath()
  ctx.arc(180, 365, 42 + Math.sin(t * 3) * 6, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(37,99,235,0.16)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(180, 365, 9, 0, Math.PI * 2)
  ctx.fillStyle = '#2563EB'
  ctx.fill()

  // Unfinished English search box
  card(ctx, 16, 48, 328, 104, 16)
  rr(ctx, 30, 60, 300, 36, 18, '#F1F5F9')
  txt(ctx, 'From: Choose starting point...', 46, 83, 12, 500, C.muted, 'left', 268)
  rr(ctx, 30, 104, 300, 36, 18, '#FEF2F2', '#FCA5A5', 1.2)
  const typed = 'sri perambad'.slice(0, Math.max(3, Math.floor(clamp((p - 0.1) * 1.8) * 12)))
  txt(ctx, `To: ${typed}|`, 46, 127, 13, 700, '#991B1B', 'left', 268)

  // Bottom sheet — confusing unfamiliar interface
  card(ctx, 12, 508, 336, 240, 22)
  rr(ctx, 156, 518, 48, 4, 2, '#CBD5E1')
  txt(ctx, 'No direct route selected', 28, 550, 15.5, 800, C.ink, 'left', 300)
  txt(ctx, 'Select transit layers,filters & stops in English', 28, 572, 11.5, 500, C.sub, 'left', 300)

  for (let i = 0; i < 3; i++) {
    rr(ctx, 28 + i * 102, 590, 94, 54, 12, '#F8FAFC', C.line, 1)
    txt(ctx, ['47 min ??', 'Change 3x', 'Walk 1.9km'][i], 75 + i * 102, 616, 11.5, 700, C.sub, 'center', 86)
    txt(ctx, ['Unknown', 'Complex', 'Confusing'][i], 75 + i * 102, 634, 10, 500, '#DC2626', 'center', 86)
  }

  rr(ctx, 28, 660, 304, 64, 14, '#FEF2F2', '#FECACA', 1.2)
  txt(ctx, '😕 கூகுள் மேப்ஸ் பயன்படுத்தத் தெரியவில்லை', 180, 686, 12, 800, '#B91C1C', 'center', 288)
  txt(ctx, 'Cannot read complex map — closes Maps & opens Phone', 180, 708, 10.5, 600, '#7F1D1D', 'center', 288)

  statusBar(ctx, false)
  homeIndicator(ctx, false)
}

/* ---------- Screen 2: Standard Phone Keypad — Dialing 1 - 4 - 9 (18.2 .. 26.5s) ---------- */
function drawDialer(ctx: Ctx, _p: number, t: number) {
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)

  // Standard Phone App Header (NOT a custom app — ordinary mobile dialer!)
  txt(ctx, 'Phone', 26, 66, 22, 800, C.ink)
  txt(ctx, 'SIM 1 · Chennai', 26, 86, 11.5, 600, C.sub)

  // Dialed digits appear as Murugan taps 1 -> 4 -> 9
  let digits = ''
  for (const tap of DIAL_TAPS) {
    if (tap.digit !== 'call' && t >= tap.t - 0.04) digits += tap.digit
  }

  txt(ctx, digits || ' ', 180, 186, 56, 800, C.ink, 'center')
  if (digits === '149') {
    txt(ctx, 'Toll-Free Transit Helpline', 180, 216, 12.5, 700, C.blue, 'center', 300)
  } else {
    txt(ctx, 'Enter phone number', 180, 216, 12, 500, C.muted, 'center', 300)
  }

  ctx.fillStyle = C.line
  ctx.fillRect(36, 238, W - 72, 1)

  // Standard 3x4 Telephone Numeric Keypad
  const keys: [string, string][] = [
    ['1', '∞'], ['2', 'ABC'], ['3', 'DEF'],
    ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
    ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
    ['*', ''], ['0', '+'], ['#', ''],
  ]

  for (let i = 0; i < 12; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const cx = 78 + col * 102
    const cy = 294 + row * 82
    const [d, sub] = keys[i]

    let tapGlow = 0
    for (const tap of DIAL_TAPS) {
      if (tap.digit === d) {
        const dt = t - tap.t
        if (dt >= -0.05 && dt < 0.42) tapGlow = 1 - clamp(dt / 0.42)
      }
    }

    ctx.beginPath()
    ctx.arc(cx, cy, 33, 0, Math.PI * 2)
    ctx.fillStyle = tapGlow > 0 ? `rgba(29,99,184,${0.18 + tapGlow * 0.35})` : '#F1F5F9'
    ctx.fill()

    txt(ctx, d, cx, cy + (sub ? 3 : 9), 26, 700, tapGlow > 0.2 ? C.blue : C.ink, 'center')
    if (sub) txt(ctx, sub, cx, cy + 19, 8.5, 700, C.muted, 'center')
  }

  // Green Telephone Call Button
  const callDt = t - 25.2
  const callTap = callDt >= -0.05 && callDt < 0.5 ? 1 - clamp(callDt / 0.5) : 0
  ctx.beginPath()
  ctx.arc(180, 646, 36 + callTap * 4, 0, Math.PI * 2)
  ctx.fillStyle = C.green
  ctx.fill()
  txt(ctx, '📞', 180, 656, 24, 700, '#FFFFFF', 'center')

  // Standard bottom dialer tabs: Recents |Keypad | Contacts
  txt(ctx, 'Recents', 72, 734, 11.5, 600, C.muted, 'center')
  txt(ctx, 'Keypad', 180, 734, 11.5, 800, C.blue, 'center')
  txt(ctx, 'Contacts', 288, 734, 11.5, 600, C.muted, 'center')

  statusBar(ctx, false)
  homeIndicator(ctx, false)
}

/* ---------- Helper: Standard Mobile Cellular Call Controls Grid ---------- */
function drawCellularControls(ctx: Ctx, speakerOn: boolean) {
  const items: [string, string, boolean][] = [
    ['🎙️', 'Mute', false],
    ['⌨️', 'Keypad', false],
    ['🔊', 'Speaker', speakerOn],
    ['➕', 'Add call', false],
    ['⏸️', 'Hold', false],
    ['👤', 'Contacts', false],
  ]

  for (let i = 0; i < 6; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const cx = 78 + col * 102
    const cy = 468 + row * 94
    const [ic, lbl, on] = items[i]

    ctx.beginPath()
    ctx.arc(cx, cy, 31, 0, Math.PI * 2)
    ctx.fillStyle = on ? '#FFFFFF' : 'rgba(255,255,255,0.12)'
    ctx.fill()

    txt(ctx, ic, cx, cy + 7, 19, 600, on ? C.ink : '#FFFFFF', 'center')
    txt(ctx, lbl, cx, cy + 48, 11, on ? 800 : 500, on ? '#FFFFFF' : 'rgba(255,255,255,0.75)', 'center')
  }

  // Standard Red Hangup Button
  ctx.beginPath()
  ctx.arc(180, 678, 35, 0, Math.PI * 2)
  ctx.fillStyle = '#EF4444'
  ctx.fill()
  txt(ctx, '✕', 180, 686, 22, 800, '#FFFFFF', 'center')
  txt(ctx, 'End Call', 180, 730, 11, 600, 'rgba(255,255,255,0.75)', 'center')
}

/* ---------- Screen 3: Standard Cellular Ringing — 2 Rings (26.5 .. 31.4s) ---------- */
function drawRinging(ctx: Ctx, _p: number, t: number) {
  const grd = ctx.createLinearGradient(0, 0, 0, H)
  grd.addColorStop(0, '#0F172A')
  grd.addColorStop(1, '#1E293B')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, W, H)

  const ringNum = t >= RING_EVENTS.ring2Start ? 2 : 1
  txt(ctx, 'SIM 1 · Calling…', 180, 82, 13, 600, '#94A3B8', 'center')
  txt(ctx, '149', 180, 146, 54, 800, '#FFFFFF', 'center')
  txt(ctx, 'Toll-Free Helpline · Chennai', 180, 176, 13, 500, '#CBD5E1', 'center', 300)

  rr(ctx, 98, 196, 164, 28, 14, 'rgba(245,158,11,0.2)', '#F59E0B', 1)
  txt(ctx, `🔔 Ringing (${ringNum} of 2)…`, 180, 215, 12, 700, '#FDE047', 'center')

  // Simple cellular contact circle with subtle ring pulse
  for (let i = 0; i < 2; i++) {
    const ph = (t * 1.1 + i * 0.5) % 1
    ctx.beginPath()
    ctx.arc(180, 322, 46 + ph * 48, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(56,189,248,${(1 - ph) * 0.45})`
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(180, 322, 46, 0, Math.PI * 2)
  ctx.fillStyle = '#334155'
  ctx.fill()
  txt(ctx, '📞', 180, 332, 28, 700, '#FFFFFF', 'center')

  drawCellularControls(ctx, true)
  statusBar(ctx, true)
  homeIndicator(ctx, true)
}

/* ---------- Screen 4: Pure Ordinary Cellular Voice Call (31.4 .. 99.5s) ---------- */
function drawActiveCall(ctx: Ctx, t: number, spectrum: number[]) {
  // Authentic Android / Mobile Voice Call UI — ZERO custom app screens!
  const grd = ctx.createLinearGradient(0, 0, 0, H)
  grd.addColorStop(0, '#0B2239')
  grd.addColorStop(1, '#0F172A')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, W, H)

  const callSec = Math.max(0, Math.floor(t - T.call))
  const mm = String(Math.floor(callSec / 60)).padStart(2, '0')
  const ss = String(callSec % 60).padStart(2, '0')

  rr(ctx, 118, 62, 124, 24, 12, 'rgba(34,197,94,0.2)')
  txt(ctx, `● Voice Call · ${mm}:${ss}`, 180, 78, 11.5, 700, '#86EFAC', 'center')

  txt(ctx, '149', 180, 140, 52, 800, '#FFFFFF', 'center')
  txt(ctx, 'நம் பயணம் Helpline · Chennai', 180, 168, 13, 600, '#BAE6FD', 'center', 300)
  txt(ctx, 'No app · No internet · Regular phone call', 180, 190, 10.5, 500, '#94A3B8', 'center', 300)

  // Contact avatar + subtle cellular audio level halo
  let avgAmp = 0
  for (let i = 0; i < 12; i++) avgAmp += spectrum[i] ?? 0.08
  avgAmp /= 12

  ctx.beginPath()
  ctx.arc(180, 292, 52 + avgAmp * 26, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(56,189,248,0.16)'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(180, 292, 46, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  if (markImg.complete && markImg.naturalWidth > 0) {
    ctx.drawImage(markImg, 148, 266, 64, 52)
  } else {
    txt(ctx, '149', 180, 300, 22, 800, C.navy, 'center')
  }

  // Clean cellular audio wave indicator (standard voice call style)
  for (let i = 0; i < 16; i++) {
    const amp = spectrum[i] ?? 0.08
    const bh = 5 + amp * 26
    const bx = 98 + i * 10.6
    rr(ctx, bx, 378 - bh / 2, 6, bh, 3, '#38BDF8')
  }
  txt(ctx, 'Speakerphone Active', 180, 412, 11, 600, '#7DD3FC', 'center')

  drawCellularControls(ctx, true)
  statusBar(ctx, true)
  homeIndicator(ctx, true)
}

/* ---------- Screen 5: Post-Call WhatsApp Journey Card (99.5 .. 108.0s) ---------- */
function drawWhatsApp(ctx: Ctx, p: number) {
  ctx.fillStyle = C.waBg
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = C.waGreen
  ctx.fillRect(0, 0, W, 94)
  ctx.beginPath()
  ctx.arc(44, 62, 19, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  if (markImg.complete && markImg.naturalWidth > 0) {
    ctx.drawImage(markImg, 28, 49, 32, 26)
  }
  txt(ctx, 'நம் பயணம் · 149 ✓', 72, 58, 14.5, 800, '#FFFFFF', 'left', 265)
  txt(ctx, 'Sent automatically after 149 call', 72, 76, 10.5, 500, '#A7F3D0', 'left', 265)

  const slideK = easeOut(seg(p, 0.03, 0.22))
  ctx.save()
  ctx.translate(0, (1 - slideK) * 24)
  ctx.globalAlpha = slideK

  rr(ctx, 126, 104, 108, 22, 11, '#D9FDD3')
  txt(ctx, 'JUST NOW · 149', 180, 119, 10, 800, '#166534', 'center')

  // Clipped WhatsApp Journey Card Bubble — zero text overflow guaranteed!
  card(ctx, 16, 134, 328, 534, 18, '#FFFFFF')
  ctx.save()
  roundRect(ctx, 16, 134, 328, 534, 18)
  ctx.clip()

  rr(ctx, 26, 144, 308, 78, 14, C.navy)
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    rr(ctx, 34, 152, 78, 60, 10, '#FFFFFF')
    ctx.drawImage(logoImg, 38, 156, 70, 52)
  }
  txt(ctx, 'நம் பயணம் · பயண அட்டை', 122, 170, 12.5, 800, '#FCD34D', 'left', 202)
  txt(ctx, 'Journey Card · #NP-CHN-14908', 122, 189, 10.5, 600, '#FFFFFF', 'left', 202)
  rr(ctx, 122, 197, 136, 18, 9, '#16A34A')
  txt(ctx, 'VERIFIED GTFS ROUTE', 190, 209.5, 9, 800, '#FFFFFF', 'center', 126)

  // Origin -> Destination
  ctx.fillStyle = C.blue
  ctx.beginPath()
  ctx.arc(40, 248, 5.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = C.amber
  ctx.fillRect(38.5, 256, 3, 32)
  ctx.beginPath()
  ctx.arc(40, 294, 5.5, 0, Math.PI * 2)
  ctx.fillStyle = C.green
  ctx.fill()

  txt(ctx, 'FROM · புறப்படும் இடம்', 54, 244, 9.5, 800, C.sub, 'left', 274)
  txt(ctx, 'MGR Chennai Central (சென்ட்ரல்)', 54, 261, 13, 800, C.ink, 'left', 274)
  txt(ctx, 'TO · சேரும் இடம்', 54, 288, 9.5, 800, C.sub, 'left', 274)
  txt(ctx, 'Sriperumbudur (ஸ்ரீபெரும்புதூர்)', 54, 305, 13, 800, C.ink, 'left', 274)

  // Option 1
  rr(ctx, 26, 322, 308, 122, 14, '#EFF6FF', '#BFDBFE', 1.2)
  txt(ctx, 'OPTION 1 · நேர் பஸ் வழி (BUS ROUTE)', 38, 342, 10.5, 800, C.blue, 'left', 284)
  txt(ctx, '1. சென்ட்ரல் ஸ்டாப் → பஸ் 53 → பூந்தமல்லி', 38, 365, 11.5, 700, C.ink, 'left', 284)
  txt(ctx, '2. பூந்தமல்லி → பஸ் 578 → ஸ்ரீபெரும்புதூர்', 38, 386, 11.5, 700, C.ink, 'left', 284)
  txt(ctx, 'MTC Bus 53 to Poonamallee → Transfer to', 38, 409, 10.5, 500, C.sub, 'left', 284)
  txt(ctx, 'MTC Bus 578 to Sriperumbudur (~1 hr 35m)', 38, 426, 10.5, 500, C.sub, 'left', 284)

  // Option 2
  rr(ctx, 26, 454, 308, 116, 14, '#F0FDF4', '#BBF7D0', 1.2)
  txt(ctx, 'OPTION 2 · மெட்ரோ + பஸ் (FASTER)', 38, 474, 10.5, 800, C.green, 'left', 284)
  txt(ctx, '1. சென்ட்ரல் மெட்ரோ → கிரீன் லைன் → கோயம்பேடு', 38, 497, 11.5, 700, C.ink, 'left', 284)
  txt(ctx, '2. கோயம்பேடு → பஸ் 578 → ஸ்ரீபெரும்புதூர்', 38, 518, 11.5, 700, C.ink, 'left', 284)
  txt(ctx, 'CMRL Green Line + MTC 578 (~1 hr 20m)', 38, 542, 10.5, 500, C.sub, 'left', 284)

  // Disclaimer
  rr(ctx, 26, 582, 308, 48, 10, '#FFFBEB')
  txt(ctx, 'Scheduled timetable (not live GPS).', 38, 601, 10.5, 600, '#92400E', 'left', 284)
  txt(ctx, 'உதவிக்கு மீண்டும் 149 அழைக்கவும்!', 38, 619, 10.5, 700, '#92400E', 'left', 284)
  txt(ctx, '10:14 AM  ✓✓', 326, 654, 10.5, 700, '#0284C7', 'right')

  ctx.restore() // end clip
  ctx.restore() // end slide

  rr(ctx, 16, 684, 328, 44, 22, '#FFFFFF')
  txt(ctx, 'Message', 36, 711, 13, 500, C.muted)

  statusBar(ctx, true)
  homeIndicator(ctx, false)
}

/* ---------- Screen 6: Post-Call SMS Summary (108.0 .. 154s) ---------- */
function drawSms(ctx: Ctx, p: number) {
  ctx.fillStyle = '#F8FAFC'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, 96)
  ctx.fillStyle = C.line
  ctx.fillRect(0, 96, W, 1)
  ctx.beginPath()
  ctx.arc(48, 62, 19, 0, Math.PI * 2)
  ctx.fillStyle = C.navy
  ctx.fill()
  txt(ctx, '149', 48, 67, 12.5, 800, '#FCD34D', 'center')
  txt(ctx, 'VM-NAMPYN (நம் பயணம்)', 76, 58, 14.5, 800, C.ink, 'left', 260)
  txt(ctx, 'Text SMS · Works without Internet', 76, 76, 10.5, 600, C.green, 'left', 260)

  const k = easeOut(seg(p, 0.02, 0.18))
  ctx.save()
  ctx.translate(0, (1 - k) * 22)
  ctx.globalAlpha = k

  txt(ctx, 'SMS · Today 10:14 AM', 180, 120, 10.5, 600, C.muted, 'center')

  // Clipped Tamil SMS Bubble
  card(ctx, 18, 134, 324, 246, 18, '#E2E8F0')
  txt(ctx, 'நம் பயணம் (149) — வழி விவரம்', 32, 160, 12.5, 800, C.navy, 'left', 294)
  const taLines = [
    'புறப்படும் இடம்: சென்ட்ரல் ஸ்டேஷன்',
    'சேரும் இடம்: ஸ்ரீபெரும்புதூர்',
    '• வழி 1: பஸ் 53 (பூந்தமல்லி) →',
    '  அங்கிருந்து பஸ் 578 (ஸ்ரீபெரும்புதூர்).',
    '• வழி 2: சென்ட்ரல் மெட்ரோ (கிரீன் லைன்)',
    '  → கோயம்பேடு → பஸ் 578.',
    'நேரம்: அட்டவணை விவரம் (SCHEDULED)',
    'குறிப்பு எண்: NP-CHN-14908',
  ]
  taLines.forEach((ln, i) => txt(ctx, ln, 32, 186 + i * 22.5, 11.5, i >= 2 && i <= 5 ? 700 : 600, C.ink, 'left', 294))

  // Clipped English SMS Bubble
  card(ctx, 18, 396, 324, 222, 18, '#EFF6FF')
  txt(ctx, 'NAM PAYANAM (149) — ROUTE SMS', 32, 422, 12, 800, C.blue, 'left', 294)
  const enLines = [
    'From: MGR Chennai Central',
    'To: Sriperumbudur Bus Stand',
    '1) Bus 53 -> Poonamallee -> Bus 578',
    '2) Central Metro -> CMBT -> Bus 578',
    'Type: SCHEDULED GTFS Timetable',
    'Ref: NP-CHN-14908 | Call 149 anytime',
  ]
  enLines.forEach((ln, i) => txt(ctx, ln, 32, 448 + i * 24, 11.5, i === 2 || i === 3 ? 700 : 500, C.ink, 'left', 294))

  rr(ctx, 22, 638, 316, 46, 14, '#DCFCE7')
  txt(ctx, '✓ SMS + WhatsApp Delivered to Caller', 180, 666, 12, 800, '#166534', 'center', 294)

  ctx.restore()
  statusBar(ctx, false)
  homeIndicator(ctx, false)
}

export function screenAt(t: number): { id: string; p: number; start: number; idx: number } {
  for (let i = 0; i < SCREENS.length; i++) {
    const [id, a, b] = SCREENS[i]
    if (t < b || i === SCREENS.length - 1) {
      return { id, p: clamp((t - a) / (b - a)), start: a, idx: i }
    }
  }
  return { id: 'maps', p: 0, start: 0, idx: 0 }
}

export function createPhone() {
  const canvas = document.createElement('canvas')
  canvas.width = W * S
  canvas.height = H * S
  const ctx = canvas.getContext('2d')!
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter

  const screenMat = new THREE.MeshBasicMaterial({
    map: tex,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })

  const build = (realHumanScale = false) => {
    const g = new THREE.Group()
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(1, 2.12, 0.105, 4, 0.12),
      new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.32, metalness: 0.65 })
    )
    g.add(body)

    const rim = new THREE.Mesh(
      new RoundedBoxGeometry(1.022, 2.142, 0.078, 4, 0.12),
      new THREE.MeshStandardMaterial({ color: '#38BDF8', roughness: 0.28, metalness: 0.82 })
    )
    g.add(rim)

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.935, 2.02), screenMat)
    screen.position.z = 0.056
    screen.name = 'phoneScreen'
    g.add(screen)

    const camBump = new THREE.Mesh(
      new RoundedBoxGeometry(0.32, 0.36, 0.03, 3, 0.06),
      new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.25, metalness: 0.7 })
    )
    camBump.position.set(-0.24, 0.76, -0.058)
    g.add(camBump)
    for (const ly of [0.84, 0.68]) {
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.068, 0.02, 16),
        new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.1, metalness: 0.9 })
      )
      lens.rotation.x = Math.PI / 2
      lens.position.set(-0.24, ly, -0.07)
      g.add(lens)
    }

    if (realHumanScale) {
      g.scale.setScalar(0.074)
    }
    return g
  }

  function paintScreen(id: string, p: number, t: number, spectrum: number[]) {
    if (id === 'maps') drawMaps(ctx, p, t)
    else if (id === 'dialer') drawDialer(ctx, p, t)
    else if (id === 'ringing') drawRinging(ctx, p, t)
    else if (id === 'call') drawActiveCall(ctx, t, spectrum)
    else if (id === 'whatsapp') drawWhatsApp(ctx, p)
    else drawSms(ctx, p)
  }

  let lastFrame = -1
  function render(t: number, spectrum: number[], forceScreen?: string) {
    // 20 FPS UI refresh is silky smooth and cuts GPU texture uploads by 66%
    const q = Math.round(t * 20)
    if (q === lastFrame && !forceScreen) return
    lastFrame = q

    ctx.setTransform(S, 0, 0, S, 0, 0)
    if (forceScreen) {
      paintScreen(forceScreen, 1, t, spectrum)
      tex.needsUpdate = true
      return
    }

    const cur = screenAt(t)
    const trans = 0.38
    const k = cur.idx > 0 ? smooth((t - cur.start) / trans) : 1
    if (k < 1) {
      const [prevId, _pa, pb] = SCREENS[cur.idx - 1]
      ctx.save()
      ctx.translate(-k * W * 0.25, 0)
      paintScreen(prevId, 1, pb - 0.05, spectrum)
      ctx.restore()
      ctx.fillStyle = `rgba(0,0,0,${0.18 * k})`
      ctx.fillRect(0, 0, W, H)
      ctx.save()
      ctx.translate((1 - k) * W, 0)
      paintScreen(cur.id, cur.p, t, spectrum)
      ctx.restore()
    } else {
      paintScreen(cur.id, cur.p, t, spectrum)
    }
    tex.needsUpdate = true
  }

  return { build, render, canvas }
}
