import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import logoUrl from '../assets/nam-payanam-logo.png?inline'
import markUrl from '../assets/nam-payanam-mark.png?inline'
import { buildWorld, SIDEWALK_Y } from './world'
import {
  person,
  resetPose,
  walkPose,
  sitBenchPose,
  lookAtPhonePose,
  earPhoneCallPose,
  setExpression,
  type Rig,
} from './characters'
import { createPhone, logoImg, markImg, screenAt, SCREENS } from './phone'
import { createDashboardMonitor, monitorK } from './dashboard'
import { ARCH_Y, buildArchitecture } from './architecture'
import { buildImpact } from './impact'
import { SoundEngine } from './audio'
import {
  T,
  CHAPTERS,
  DIAL_TAPS,
  activeTurnAt,
  type ClipKey,
} from './timeline'
import {
  FONT,
  clamp,
  easeInOut,
  lerp,
  roundRect,
  seg,
  smooth,
  splineAt,
  v3,
  win,
} from './util'

const TOTAL = T.total
const DEG = Math.PI / 180
const chapterAt = (t: number) => {
  let i = 0
  while (i < CHAPTERS.length - 1 && t >= CHAPTERS[i + 1].t) i++
  return i
}

/* =============================== Renderer & Error Guard =============================== */
const glCanvas = document.getElementById('gl') as HTMLCanvasElement
const overlay = document.getElementById('overlay') as HTMLCanvasElement
const octx = overlay.getContext('2d')!

function fatal(msg: string) {
  const el = document.getElementById('fatal')
  if (!el) return
  const p = el.querySelector('p')
  if (p) p.textContent = msg
  el.classList.remove('hidden')
  const s = document.getElementById('start')
  if (s) s.classList.add('gone')
}
window.addEventListener('error', e =>
  fatal('Could not start: ' + (e.message || 'the page failed to load. Reload to try again.'))
)
window.addEventListener('unhandledrejection', e =>
  fatal('Could not start: ' + (e.reason?.message || e.reason || 'the page failed to load.'))
)

let renderer: THREE.WebGLRenderer
try {
  renderer = new THREE.WebGLRenderer({
    canvas: glCanvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
} catch {
  fatal('This browser could not start 3D (WebGL). Enable hardware acceleration in Chrome or Edge.')
  throw new Error('WebGL unavailable')
}
glCanvas.addEventListener('webglcontextlost', e => {
  e.preventDefault()
  fatal('3D graphics context was lost. Please reload the page.')
})

renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.autoClear = false

const scene = new THREE.Scene()
const ui = new THREE.Scene()
ui.add(new THREE.AmbientLight('#ffffff', 1.45))
const uiSun = new THREE.DirectionalLight('#ffffff', 2.0)
uiSun.position.set(2, 3, 5)
ui.add(uiSun)

const camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.05, 3200)
ui.add(camera)

const world = buildWorld(scene)
const skyBase = (scene.background as THREE.Color).clone()
const fogBase = (scene.fog as THREE.Fog).color.clone()
const fogArch = new THREE.Color('#EDF6FC')

/* =============================== Cast (Chennai Commuters) =============================== */
const M = person({
  skin: '#9E6B4B',
  shirt: '#38BDF8',
  shirtAccent: '#0284C7',
  legs: '#1E293B',
  hair: '#18181B',
  moustache: true,
  bag: true,
})
scene.add(M.root)

interface Extra {
  rig: Rig
  kind: 'bench' | 'stand' | 'walk'
  pos: THREE.Vector3
  rot: number
  ph: number
  walkSpan?: number
}
const extras: Extra[] = [
  {
    rig: person({ skin: '#8D5A3B', shirt: '#B91C1C', saree: '#0D9488', border: '#F59E0B', hair: '#111111', bun: true }),
    kind: 'bench',
    pos: v3(3.4, SIDEWALK_Y, 3.55),
    rot: 0,
    ph: 0.4,
  },
  {
    rig: person({ skin: '#8A5638', shirt: '#FFFBEB', shirtAccent: '#FDE68A', veshti: true, veshtiBorder: '#B45309', hair: '#D4D4D8', moustache: true }),
    kind: 'stand',
    pos: v3(8.2, SIDEWALK_Y, 3.3),
    rot: -0.35,
    ph: 1.3,
  },
  {
    rig: person({ skin: '#9A6646', shirt: '#F97316', legs: '#334155', hair: '#18181B', bag: true }),
    kind: 'walk',
    pos: v3(-6, SIDEWALK_Y, 1.2),
    rot: Math.PI / 2,
    ph: 0,
    walkSpan: 24,
  },
  {
    rig: person({ skin: '#A16E4E', shirt: '#EC4899', saree: '#6366F1', border: '#FCD34D', hair: '#141414', bun: true }),
    kind: 'stand',
    pos: v3(-12.5, SIDEWALK_Y, 2.8),
    rot: 0.4,
    ph: 2.1,
  },
]
extras.forEach(e => scene.add(e.rig.root))

/* =============================== User's Smartphone (In-Hand + Hero UI) =============================== */
const phoneKit = createPhone()
const phoneInLeft = phoneKit.build(true)
M.handL.phoneMount.add(phoneInLeft)

const phoneInRight = phoneKit.build(true)
M.handR.phoneMount.add(phoneInRight)

const heroPhone = phoneKit.build(false)
ui.add(heroPhone)
const heroScreen = heroPhone.getObjectByName('phoneScreen') as THREE.Mesh

const glowTex = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(56,189,248,0.72)')
  gr.addColorStop(0.5, 'rgba(245,158,11,0.24)')
  gr.addColorStop(1, 'rgba(11,60,93,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
const heroGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: glowTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.72,
  })
)
heroGlow.scale.set(3.2, 3.2, 1)
heroGlow.position.z = -0.35
heroPhone.add(heroGlow)

const dash = createDashboardMonitor()
ui.add(dash.group)
dash.group.visible = false

const arch = buildArchitecture(scene, phoneKit.build)
const impact = buildImpact(scene)

/* =============================== 3D Signal FX =============================== */
function ringSprite(color: string) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.strokeStyle = color
  g.lineWidth = 7
  g.beginPath()
  g.arc(64, 64, 54, 0, Math.PI * 2)
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.Sprite(
    new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  )
}

const callRings = [0, 1, 2].map(() => {
  const s = ringSprite('#FBBF24')
  scene.add(s)
  return s
})

const syncPackets = Array.from({ length: 14 }, (_, i) => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 10, 8),
    new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? '#FBBF24' : '#38BDF8' })
  )
  scene.add(m)
  return m
})

/* =============================== Character & Hand Choreography =============================== */
const startWalkA = v3(0.4, SIDEWALK_Y, -1.2)
const heroSpot = v3(1.65, SIDEWALK_Y, 3.65)
const busCurbSpot = v3(4.85, SIDEWALK_Y, 6.18) // right outside heroBus53's open curb-side doorway (3.2 + 1.65 = 4.85, 7.8 - 1.27 = 6.53)!
const busStepSpot = v3(4.85, 0.52, 6.72) // up onto footboard inside open doorway!
const tmpV = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()

function animateCast(t: number, voiceLevel: number) {
  resetPose(M)

  const activeTurn = activeTurnAt(t)
  const userSpeaking = activeTurn?.speaker === 'user'

  // Put phone cleanly into pocket at t = 110.4s BEFORE Murugan walks to board MTC 53!
  const holdingPhone = t < 110.4
  const inRightEar = holdingPhone && t >= 26.15 && t < T.whatsapp
  phoneInLeft.visible = holdingPhone && !inRightEar
  phoneInRight.visible = holdingPhone && inRightEar

  if (t < T.problem) {
    const u = smooth(seg(t, 1.5, T.problem))
    M.root.position.lerpVectors(startWalkA, heroSpot, u)
    M.root.rotation.y = lerp(0.18, 0.08, u)
    if (t > 1.5 && t < T.problem - 0.1) walkPose(M, t * 5.2, 0.36)
    lookAtPhonePose(M)
    M.head.rotation.y = Math.sin(t * 0.9) * 0.24
    setExpression(M, t, { confused: smooth(seg(t, 6.5, 8.5)) * 0.5 })
    M.root.visible = true
  } else if (t < T.remember) {
    M.root.position.copy(heroSpot)
    M.root.rotation.y = 0.08
    lookAtPhonePose(M)
    M.head.rotation.x = 0.24 - 0.14 * smooth(win(t, 12.2, 14.8, 0.6))
    M.head.rotation.y = Math.sin(t * 3.4) * 0.18 * win(t, 9.5, 16.5, 0.8)
    setExpression(M, t, { confused: 0.95 })
    M.root.visible = true
  } else if (t < T.ringing) {
    M.root.position.copy(heroSpot)
    const lookPoster = win(t, 18.1, 20.8, 0.55)
    M.root.rotation.y = lerp(0.08, 0.48, lookPoster)
    M.head.rotation.y = lerp(0, 0.36, lookPoster)
    M.head.rotation.x = lerp(0.22, -0.06, lookPoster)

    const dialActive = smooth(seg(t, 20.8, 21.6)) * (1 - smooth(seg(t, 25.8, 26.3)))
    let pressK = 0
    let keyCol = 1
    let keyRow = 1
    for (const tap of DIAL_TAPS) {
      const d = Math.abs(t - tap.t)
      if (d < 0.35) {
        pressK = Math.max(pressK, Math.cos((d / 0.35) * (Math.PI / 2)))
        keyCol = tap.col
        keyRow = tap.row
      }
    }
    lookAtPhonePose(M, { dialActive, pressK, keyCol, keyRow })
    setExpression(M, t, { happy: smooth(seg(t, 18.8, 20.5)) * 0.85 })
    M.root.visible = true
  } else if (t < T.whatsapp) {
    M.root.position.copy(heroSpot)
    M.root.rotation.y = 0.12 + Math.sin(t * 0.35) * 0.08
    const raiseK = Math.min(smooth(seg(t, 26.15, 27.1)), 1 - smooth(seg(t, T.whatsapp - 0.7, T.whatsapp)))
    earPhoneCallPose(M, raiseK, t, Boolean(userSpeaking))
    M.head.rotation.y = Math.sin(t * 0.7) * 0.08
    M.head.rotation.x = userSpeaking ? 0.03 * Math.sin(t * 3.8) : 0.05 * Math.sin(t * 1.9)
    setExpression(M, t, {
      speak: userSpeaking ? Math.max(0.28, voiceLevel) : 0,
      happy: 0.65,
    })
    M.root.visible = true
  } else if (t < 110.4) {
    // Reading WhatsApp Journey Card (99.5..108s) & SMS Summary (108..110.4s)
    M.root.position.copy(heroSpot)
    M.root.rotation.y = 0.16
    lookAtPhonePose(M)
    M.head.rotation.x = 0.22
    setExpression(M, t, { happy: 1 })
    M.root.visible = true
  } else if (t < 113.4) {
    // Pockets phone & walks cleanly across sidewalk to MTC 53's open curb-side doorway!
    const wk = smooth(seg(t, 110.4, 113.4))
    M.root.position.lerpVectors(heroSpot, busCurbSpot, wk)
    M.root.rotation.y = lerp(0.16, Math.atan2(busCurbSpot.x - heroSpot.x, busCurbSpot.z - heroSpot.z), smooth(seg(t, 110.4, 111.1)))
    walkPose(M, t * 5.8, 0.38)
    setExpression(M, t, { happy: 1 })
    M.root.visible = true
  } else if (t < 114.6) {
    // Steps cleanly up onto the bus footboard and inside the open doorway!
    const sk = smooth(seg(t, 113.4, 114.5))
    M.root.position.lerpVectors(busCurbSpot, busStepSpot, sk)
    M.root.rotation.y = 0 // facing straight +Z into the open doorway
    walkPose(M, t * 5.2, 0.25 * (1 - sk))
    setExpression(M, t, { happy: 1 })
    M.root.visible = true
  } else {
    M.root.visible = false
  }

  for (const e of extras) {
    resetPose(e.rig)
    if (e.kind === 'bench') {
      e.rig.root.position.copy(e.pos)
      e.rig.root.rotation.y = e.rot
      sitBenchPose(e.rig, 0.44)
      e.rig.head.rotation.y = Math.sin(t * 0.5 + e.ph) * 0.22
    } else if (e.kind === 'walk' && e.walkSpan) {
      const u = ((t * 1.15 + e.ph) % e.walkSpan) / e.walkSpan
      e.rig.root.position.set(e.pos.x - 12 + u * 24, SIDEWALK_Y, e.pos.z)
      e.rig.root.rotation.y = Math.PI / 2
      walkPose(e.rig, t * 5.0, 0.36)
    } else {
      e.rig.root.position.copy(e.pos)
      e.rig.root.rotation.y = e.rot
      e.rig.head.rotation.y = Math.sin(t * 0.45 + e.ph) * 0.25
    }
    setExpression(e.rig, t + e.ph)
  }

  const ringShow = t >= T.ringing && t < T.whatsapp
  phoneInRight.getWorldPosition(tmpV)
  callRings.forEach((s, i) => {
    s.visible = ringShow
    if (!ringShow) return
    const k = (t * 0.85 + i / 3) % 1
    s.position.copy(tmpV)
    s.scale.setScalar(0.08 + k * 0.62)
    s.material.opacity = (1 - k) * 0.68
  })

  // High overhead telemetry arcs (Phone -> Telecom Tower -> Admin Center on North Plaza — zero building clipping!)
  const syncShow = (t >= 26.8 && t <= 31.4) || (t >= T.whatsapp - 0.3 && t <= T.admin + 1.2)
  const anchorPos = holdingPhone
    ? (inRightEar ? phoneInRight : phoneInLeft).getWorldPosition(new THREE.Vector3())
    : v3(3.2, 2.2, 4.5)
  syncPackets.forEach((pkt, i) => {
    pkt.visible = syncShow
    if (!syncShow) return
    const u = (t * 0.42 + i / syncPackets.length) % 1
    if (u < 0.5) {
      const k = u / 0.5
      pkt.position.lerpVectors(anchorPos, world.towerTop, k)
      pkt.position.y += Math.sin(k * Math.PI) * 10
    } else {
      const k = (u - 0.5) / 0.5
      const dest = t >= 114.5 ? world.adminPos.clone().add(v3(0, 10.8, 0)) : anchorPos
      pkt.position.lerpVectors(world.towerTop, dest, k)
      pkt.position.y += Math.sin(k * Math.PI) * 14
    }
  })
}

/* =============================== Cinematic Camera Direction (100% Obstruction-Free!) =============================== */
type CamSeg = {
  a: number
  b: number
  blend?: number
  keys?: { p: number[][]; l: number[][] }
  proc?: (t: number, p: THREE.Vector3, l: THREE.Vector3) => void
}

const SEGS: CamSeg[] = [
  // 1. Crane over MGR Chennai Central down to Murugan
  {
    a: 0,
    b: T.problem,
    keys: {
      p: [
        [0, 32, 26, 48],
        [3.5, 15, 12, 26],
        [6.5, 5.4, 3.2, 10.5],
        [8.5, 2.85, 1.85, 6.1],
      ],
      l: [
        [0, 0, 11, -18],
        [3.5, 0, 7, -14],
        [6.5, 1.2, 2.0, -2],
        [8.5, 1.75, 1.48, 3.65],
      ],
    },
  },
  // 2. Confused by Google Maps
  {
    a: T.problem,
    b: T.remember,
    blend: 0.9,
    keys: {
      p: [
        [8.5, 2.85, 1.82, 6.1],
        [13.0, 2.45, 1.72, 5.55],
        [18.0, 2.65, 1.76, 5.85],
      ],
      l: [
        [8.5, 1.85, 1.45, 3.65],
        [13.0, 1.92, 1.42, 3.65],
        [18.0, 2.1, 1.46, 3.7],
      ],
    },
  },
  // 3. Spots Nam Payanam 149 Shelter Poster -> Close-up on articulated hands dialing 1 - 4 - 9
  {
    a: T.remember,
    b: T.ringing,
    blend: 0.8,
    keys: {
      p: [
        [18.0, 2.6, 1.8, 6.8],
        [20.2, 3.8, 1.75, 6.9],
        [21.6, 2.32, 1.62, 5.05],
        [26.5, 2.42, 1.68, 5.25],
      ],
      l: [
        [18.0, 5.2, 1.55, 3.8],
        [20.2, 5.6, 1.52, 3.8],
        [21.6, 1.92, 1.36, 3.75],
        [26.5, 1.95, 1.44, 3.72],
      ],
    },
  },
  // 4. 2 Rings + Greeting + User Query
  {
    a: T.ringing,
    b: 50.3,
    blend: 1.0,
    proc: (t, p, l) => {
      const a = lerp(-0.22, 0.34, seg(t, T.ringing, 50.3))
      p.set(1.65 + Math.sin(a) * 2.5 + 0.52, 1.76, 3.65 + Math.cos(a) * 2.5)
      l.set(2.05, 1.54, 3.65)
    },
  },
  // 5. Kural explains Bus 53 -> Poonamallee -> Bus 578 (aerial sweep along glowing Chennai corridor)
  {
    a: 50.3,
    b: T.metro,
    blend: 1.1,
    keys: {
      p: [
        [50.3, 6, 6, 22],
        [55.0, -45, 24, 58],
        [60.0, -135, 30, 68],
        [64.0, 2.6, 1.82, 5.8],
      ],
      l: [
        [50.3, -10, 2, 10],
        [55.0, -95, 3, 12],
        [60.0, -185, 4, 8],
        [64.0, 2.0, 1.54, 3.65],
      ],
    },
  },
  // 6. Metro follow-up -> Green Line -> Koyambedu -> Bus 578 + Consent
  {
    a: T.metro,
    b: T.whatsapp,
    blend: 1.0,
    keys: {
      p: [
        [64.0, 2.6, 1.82, 5.8],
        [70.4, 2.5, 1.8, 5.7],
        [74.8, -8, 13, 42],
        [81.5, -56, 19, 52],
        [86.4, 2.45, 1.78, 5.45],
        [99.5, 2.55, 1.76, 5.5],
      ],
      l: [
        [64.0, 2.0, 1.54, 3.65],
        [70.4, 2.0, 1.54, 3.65],
        [74.8, -24, 6, 16],
        [81.5, -85, 6, 14],
        [86.4, 2.02, 1.52, 3.65],
        [99.5, 2.02, 1.48, 3.65],
      ],
    },
  },
  // 7. WhatsApp Journey Card + SMS + Curbside Boarding of MTC Bus 53 (Camera stays cleanly on Plaza side z = 1.6..5.4 — ZERO road/bus occlusion!)
  {
    a: T.whatsapp,
    b: T.admin,
    blend: 0.9,
    keys: {
      p: [
        [99.5, 2.55, 1.74, 5.4],
        [108.0, 2.8, 1.82, 5.2],
        [110.5, 9.6, 2.45, 1.4],
        [114.8, 10.8, 2.8, 1.6],
        [116.5, 24.0, 14.0, 12.0],
      ],
      l: [
        [99.5, 2.05, 1.44, 3.65],
        [108.0, 2.1, 1.46, 3.7],
        [110.5, 3.8, 1.6, 6.4],
        [114.8, 4.8, 1.7, 7.2],
        [116.5, 36.0, 6.5, -9.0],
      ],
    },
  },
  // 8. Admin Operations Center on North Plaza (unobstructed aerial orbit behind Dashboard Monitor)
  {
    a: T.admin,
    b: T.arch,
    blend: 1.0,
    proc: (t, p, l) => {
      const k = easeInOut(seg(t, T.admin, T.arch))
      p.set(lerp(24, 46, k), lerp(15, 20, k), lerp(14, 16, k))
      l.set(36, 6.5, -9)
    },
  },
  // 9. 3D System Architecture Blueprint Diorama (ARCH_Y = 110 — studio backdrop, zero clouds!)
  {
    a: T.arch,
    b: T.impact,
    blend: 1.2,
    keys: {
      p: [
        [131.5, -24, ARCH_Y + 7, 36],
        [135.0, -8, ARCH_Y + 7.5, 34],
        [139.0, 8, ARCH_Y + 7.5, 34],
        [142.0, 18, ARCH_Y + 8, 36],
        [143.5, 32, ARCH_Y + 14, 68],
      ],
      l: [
        [131.5, -18, ARCH_Y + 3, 0],
        [135.0, -4, ARCH_Y + 3.5, 0],
        [139.0, 8, ARCH_Y + 3.5, 0],
        [142.0, 18, ARCH_Y + 3.5, 0],
        [143.5, -15, 35, 0],
      ],
    },
  },
  // 10. Chennai Metropolitan Impact -> Finale Return to MGR Chennai Central Clock Tower!
  {
    a: T.impact,
    b: TOTAL,
    blend: 1.2,
    keys: {
      p: [
        [143.5, 58, 96, 148],
        [147.8, -18, 86, 152],
        [150.5, 14, 18, 40],
        [154.0, 6, 13, 32],
      ],
      l: [
        [143.5, -55, 4, 14],
        [147.8, -68, 4, 12],
        [150.5, 0, 11, -18],
        [154.0, 0, 12, -20],
      ],
    },
  },
]

const camPos = new THREE.Vector3()
const camLook = new THREE.Vector3()
function evalCamSeg(s: CamSeg, t: number, p: THREE.Vector3, l: THREE.Vector3) {
  if (s.proc) s.proc(t, p, l)
  else if (s.keys) {
    splineAt(s.keys.p, t, p)
    splineAt(s.keys.l, t, l)
  }
}
function cameraAt(t: number, p: THREE.Vector3, l: THREE.Vector3) {
  let i = 0
  while (i < SEGS.length - 1 && t >= SEGS[i + 1].a) i++
  const s = SEGS[i]
  evalCamSeg(s, t, p, l)
  if (s.blend && i > 0 && t < s.a + s.blend) {
    const pp = new THREE.Vector3()
    const pl = new THREE.Vector3()
    evalCamSeg(SEGS[i - 1], s.a, pp, pl)
    const k = easeInOut((t - s.a) / s.blend)
    p.lerpVectors(pp, p, k)
    l.lerpVectors(pl, l, k)
  }
}

/* =============================== Hero Phone Choreography =============================== */
type PMode = 'hand' | 'hero' | 'corner' | 'gone'
const PKEYS: [number, PMode][] = [
  [0, 'hand'],
  [8.6, 'hand'],
  [9.4, 'hero'],
  [18.0, 'hero'],
  [18.6, 'corner'],
  [21.2, 'corner'],
  [21.8, 'hero'],
  [50.3, 'hero'],
  [51.0, 'corner'],
  [63.6, 'corner'],
  [64.2, 'hero'],
  [74.2, 'hero'],
  [74.9, 'corner'],
  [86.0, 'corner'],
  [86.6, 'hero'],
  [110.2, 'hero'],
  [110.9, 'corner'],
  [115.6, 'corner'],
  [116.3, 'gone'],
]

let pinPhone = false
const poseP = { a: new THREE.Vector3(), b: new THREE.Vector3() }
const poseQ = { a: new THREE.Quaternion(), b: new THREE.Quaternion() }

function modePose(m: PMode, t: number, pos: THREE.Vector3, q: THREE.Quaternion) {
  if (m === 'hand') {
    const activeHandPhone = phoneInRight.visible ? phoneInRight : phoneInLeft
    activeHandPhone.getWorldPosition(pos)
    activeHandPhone.getWorldQuaternion(q)
    return 0.074
  }
  const asp = camera.aspect
  const wide = asp > 1.15
  let off: THREE.Vector3
  let s: number
  let ry: number
  if (m === 'hero') {
    off = v3(wide ? 0.56 * Math.min(1.25, asp / 1.78) : 0.02, wide ? -0.04 : -0.02, -2.5)
    s = wide ? 0.72 : 0.78
    ry = -0.22
  } else {
    off = wide ? v3(0.98 * Math.min(1.3, asp / 1.78), -0.1, -2.6) : v3(0.22, -0.4, -2.6)
    s = m === 'gone' ? 0.0001 : wide ? 0.54 : 0.38
    ry = -0.3
  }
  pos.copy(off).applyMatrix4(camera.matrixWorld)
  q.copy(camera.quaternion).multiply(
    tmpQ.setFromEuler(new THREE.Euler(Math.sin(t * 0.5) * 0.03, ry + Math.sin(t * 0.6) * 0.04, 0))
  )
  return s
}

function updateHeroPhone(t: number) {
  if (pinPhone) {
    heroPhone.visible = true
    const s = modePose('hero', t, poseP.a, poseQ.a)
    heroPhone.position.copy(poseP.a)
    heroPhone.quaternion.copy(poseQ.a)
    heroPhone.scale.setScalar(s)
    heroGlow.visible = true
    heroGlow.material.opacity = 0.72
    return
  }
  let i = 0
  while (i < PKEYS.length - 1 && t >= PKEYS[i + 1][0]) i++
  const [ta, ma] = PKEYS[i]
  const [tb, mb] = PKEYS[Math.min(i + 1, PKEYS.length - 1)]
  if ((ma === 'hand' && mb === 'hand') || (ma === 'gone' && mb === 'gone') || i === PKEYS.length - 1) {
    heroPhone.visible = false
    heroGlow.visible = false
    return
  }
  heroPhone.visible = true
  const k = tb > ta ? easeInOut((t - ta) / (tb - ta)) : 1
  const sa = modePose(ma, t, poseP.a, poseQ.a)
  const sb = modePose(mb, t, poseP.b, poseQ.b)
  heroPhone.position.lerpVectors(poseP.a, poseP.b, k)
  heroPhone.quaternion.slerpQuaternions(poseQ.a, poseQ.b, k)
  heroPhone.scale.setScalar(lerp(sa, sb, k))
  heroGlow.visible = true
  heroGlow.material.opacity = 0.72 * (ma === 'hand' ? k : mb === 'hand' ? 1 - k : 1)
}

function updateMonitor(t: number) {
  const k = monitorK(t)
  dash.group.visible = k > 0.002 && !pinPhone
  if (!dash.group.visible) return
  dash.render(t)
  const dist = 2.5
  const visH = 2 * dist * Math.tan((camera.fov * DEG) / 2)
  const visW = visH * camera.aspect
  const s = Math.min(1, (visW * 0.94) / dash.size.w, (visH * 0.8) / dash.size.h)
  const wideAsp = camera.aspect > 1.15
  tmpV.set(0, (wideAsp ? -0.07 : 0) - (1 - k) * 0.5, -dist).applyMatrix4(camera.matrixWorld)
  dash.group.position.copy(tmpV)
  dash.group.quaternion
    .copy(camera.quaternion)
    .multiply(tmpQ.setFromEuler(new THREE.Euler(-0.04 * (1 - k), Math.sin(t * 0.35) * 0.018, 0)))
  dash.group.scale.setScalar(s * (0.9 + 0.1 * k))
}

/* =============================== Fast Zero-Blur 2D Overlay HUD =============================== */
const logoForOverlay = new Image()
logoForOverlay.src = logoUrl
;(document.getElementById('brandMark') as HTMLImageElement).src = markUrl
;(document.getElementById('startLogo') as HTMLImageElement).src = logoUrl
;(document.getElementById('liveLogo') as HTMLImageElement).src = markUrl
void logoImg
void markImg

const CAPTIONS: [number, number, string, string, boolean?][] = [
  [9.2, 17.2, 'Lost outside MGR Chennai Central', 'Needs to reach Sriperumbudur — cannot use Google Maps', true],
  [18.3, 21.4, 'Dials 149 on Regular Phone Keypad', 'No app · No internet · Pure telephone number helpline', true],
  [26.8, 31.1, 'Answered within 2 rings!', 'Kural (குரல் AI) speaks natural casual Chennai Tamil', true],
  [99.8, 107.6, 'WhatsApp Journey Card Sent', 'Arrives automatically the moment the phone call ends', true],
  [108.3, 115.8, 'SMS Summary + Boards MTC Bus 53', 'Works on every mobile & keypad phone across Chennai', true],
  [T.impact + 0.6, T.impact + 5.2, 'All of Chennai. Just Dial 149.', 'MTC Buses · CMRL Metro · Suburban Rail'],
]

function oTxt(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  color: string,
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

function oCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  roundRect(ctx, x, y + 3, w, h, r)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.fill()
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

function drawOverlay(t: number) {
  const W = overlay.width
  const H = overlay.height
  const wide = camera.aspect > 1.15
  const u = wide ? Math.min(W / 1920, H / 1080) : W / 1150
  const ctx = octx
  ctx.clearRect(0, 0, W, H)
  ctx.save()

  // Intro & Finale Brand Crest
  const ia = Math.max(win(t, 0.5, 7.9, 0.8), win(t, T.end + 0.3, TOTAL - 0.2, 0.8))
  if (ia > 0) {
    ctx.globalAlpha = ia
    const cw = 360 * u
    const ch = 260 * u
    const cx = W / 2
    const cy = H * 0.38 - (1 - ia) * 18 * u
    oCard(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 38 * u, 'rgba(255,255,255,0.96)')
    if (logoForOverlay.complete && logoForOverlay.naturalWidth > 0) {
      ctx.drawImage(logoForOverlay, cx - cw / 2 + 22 * u, cy - ch / 2 + 16 * u, cw - 44 * u, ch - 32 * u)
    }
    const tag =
      t > T.end
        ? 'நம் பயணம் · Just Dial 149 · Casual Tamil Transit Guidance'
        : 'Chennai Mobility AI · Just Dial 149 on Any Phone'
    ctx.font = `700 ${28 * u}px ${FONT}`
    const tw = Math.min(W - 60 * u, ctx.measureText(tag).width + 64 * u)
    oCard(ctx, cx - tw / 2, cy + ch / 2 + 22 * u, tw, 58 * u, 29 * u, 'rgba(7,30,50,0.88)')
    oTxt(ctx, tag, cx, cy + ch / 2 + 51 * u, 28 * u, 700, '#FFFFFF', 'center', tw - 40 * u)
    ctx.globalAlpha = 1
  }

  // Chapter Pill
  const chIdx = chapterAt(t)
  if (chIdx > 0 && chIdx < CHAPTERS.length - 1) {
    const a = win(t, CHAPTERS[chIdx].t + 0.2, CHAPTERS[chIdx].t + 3.2, 0.4)
    if (a > 0) {
      ctx.globalAlpha = a
      const label = CHAPTERS[chIdx].name.toUpperCase()
      ctx.font = `800 ${19 * u}px ${FONT}`
      const w = ctx.measureText(label).width + 114 * u
      const y0 = wide ? 88 * u : 175 * u
      oCard(ctx, 56 * u, y0, w, 48 * u, 24 * u, 'rgba(11,60,93,0.92)')
      oCard(ctx, 62 * u, y0 + 6 * u, 50 * u, 36 * u, 18 * u, '#F59E0B')
      oTxt(ctx, String(chIdx).padStart(2, '0'), 87 * u, y0 + 24 * u, 17 * u, 800, '#0F172A', 'center')
      oTxt(ctx, label, 126 * u, y0 + 25 * u, 19 * u, 800, '#FFFFFF')
      ctx.globalAlpha = 1
    }
  }

  // Live Bilingual Subtitle Banner during Active Voice Call (since Phone Screen is pure Cellular Call UI!)
  const turn = activeTurnAt(t)
  if (turn && wide) {
    const a = win(t, turn.start, turn.end, 0.22)
    ctx.globalAlpha = a
    const bx = 56 * u
    const by = H - 236 * u
    const bw = 980 * u
    const bh = 136 * u
    oCard(ctx, bx, by, bw, bh, 22 * u, 'rgba(6,24,40,0.9)')
    const accent = turn.speaker === 'kural' ? '#F59E0B' : '#22C55E'
    roundRect(ctx, bx, by, 10 * u, bh, 5 * u)
    ctx.fillStyle = accent
    ctx.fill()
    oTxt(
      ctx,
      turn.speaker === 'kural' ? '📞 149 · குரல் AI (KURAL HELPLINE)' : '🎙️ முருகன் (CALLER AT MGR CENTRAL)',
      bx + 28 * u,
      by + 28 * u,
      16.5 * u,
      800,
      accent
    )
    ctx.font = `700 ${22.5 * u}px ${FONT}`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const words = turn.tamil.split(' ')
    let l1 = ''
    let l2 = ''
    for (const w of words) {
      if (!l2 && ctx.measureText(l1 + ' ' + w).width < bw - 56 * u) l1 = l1 ? l1 + ' ' + w : w
      else l2 = l2 ? l2 + ' ' + w : w
    }
    ctx.fillText(l1, bx + 28 * u, by + 64 * u, bw - 52 * u)
    if (l2) ctx.fillText(l2, bx + 28 * u, by + 94 * u, bw - 52 * u)
    oTxt(ctx, turn.english, bx + 28 * u, by + 119 * u, 15 * u, 500, '#BAE6FD', 'left', bw - 52 * u)
    ctx.globalAlpha = 1
  }

  for (const [a, b, title, sub, left] of CAPTIONS) {
    if (turn && left) continue
    const k = win(t, a, b, 0.5)
    if (k <= 0) continue
    ctx.globalAlpha = k
    const y = H - 176 * u + (1 - k) * 16 * u
    const lx = left && wide ? 64 * u : W / 2
    const al: CanvasTextAlign = left && wide ? 'left' : 'center'
    ctx.font = `800 ${(left ? 42 : 52) * u}px ${FONT}`
    let bw = ctx.measureText(title).width
    if (sub) {
      ctx.font = `600 ${23 * u}px ${FONT}`
      bw = Math.max(bw, ctx.measureText(sub).width)
    }
    bw += 74 * u
    const bh = (sub ? 128 : 86) * u
    const bx = al === 'left' ? lx - 34 * u : lx - bw / 2
    oCard(ctx, bx, y - 44 * u, bw, bh, 24 * u, 'rgba(7,28,46,0.86)')
    oTxt(ctx, title, lx, y, (left ? 42 : 52) * u, 800, '#FFFFFF', al)
    if (sub) oTxt(ctx, sub, lx, y + 46 * u, 23 * u, 600, '#BAE6FD', al)
    ctx.globalAlpha = 1
  }

  const posterA = win(t, 18.2, 21.1, 0.4)
  if (posterA > 0) {
    const p = world.posterPos.clone().project(camera)
    if (p.z < 1) {
      const px = (p.x * 0.5 + 0.5) * W
      const py = (-p.y * 0.5 + 0.5) * H
      ctx.globalAlpha = posterA
      ctx.strokeStyle = '#F59E0B'
      ctx.lineWidth = 3 * u
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + 68 * u, py - 68 * u)
      ctx.stroke()
      oCard(ctx, px + 68 * u, py - 106 * u, 350 * u, 72 * u, 18 * u, 'rgba(255,255,255,0.96)')
      oTxt(ctx, 'நம் பயணம் · Dial 149', px + 86 * u, py - 82 * u, 21 * u, 800, '#0B3C5D')
      oTxt(ctx, 'Just call 149 · No smartphone app needed', px + 86 * u, py - 54 * u, 15 * u, 600, '#475569')
      ctx.globalAlpha = 1
    }
  }

  ctx.restore()
}

/* =============================== Viewport Resize =============================== */
let fixedSize: [number, number] | null = null
function resize() {
  const w = fixedSize ? fixedSize[0] : window.innerWidth
  const h = fixedSize ? fixedSize[1] : window.innerHeight
  const dpr = fixedSize ? 1 : Math.min(window.devicePixelRatio || 1, 1.75)
  renderer.setPixelRatio(dpr)
  renderer.setSize(w, h, !fixedSize)
  overlay.width = Math.round(w * dpr)
  overlay.height = Math.round(h * dpr)
  if (!fixedSize) {
    overlay.style.width = `${w}px`
    overlay.style.height = `${h}px`
  }
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

/* =============================== Hardware-Synced Film Clock & Controls =============================== */
const controls = new OrbitControls(camera, glCanvas)
controls.enabled = false
controls.enableDamping = true
controls.maxPolarAngle = Math.PI * 0.49
controls.maxDistance = 650
controls.minDistance = 1.6

let t = 0
let playing = false
let exploring = false
let started = false
let sound: SoundEngine | null = null
let audioOn = true
let liveOpen = false
let forcePhoneScreen: string | undefined

// Hardware AudioContext clock anchors (eliminates 100% of frame-rate drift & voice jitter!)
let playFilmAnchor = 0
let playCtxAnchor = 0
let playPerfAnchor = 0

// Pre-warm SoundEngine on load so all 9 MP3s decode into RAM while Start card is shown!
try {
  sound = new SoundEngine()
} catch {
  sound = null
}

const $ = (id: string) => document.getElementById(id)!
const btnPlay = $('btnPlay')
const timeEl = $('time')
const chaptersEl = $('chapters')
const hint = $('hint')
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const chapEls = CHAPTERS.map((c, i) => {
  const end = i < CHAPTERS.length - 1 ? CHAPTERS[i + 1].t : TOTAL
  const el = document.createElement('div')
  el.className = 'chap'
  el.style.flex = String(end - c.t)
  el.innerHTML = `<span>${c.name}</span><div class="bar"><div class="fill"></div></div>`
  el.addEventListener('click', e => {
    const r = el.getBoundingClientRect()
    const f = clamp((e.clientX - r.left) / r.width)
    seek(c.t + f * (end - c.t) * 0.98)
  })
  chaptersEl.appendChild(el)
  return { el, fill: el.querySelector('.fill') as HTMLElement, a: c.t, b: end }
})

function ensureSound(): SoundEngine {
  if (!sound) sound = new SoundEngine()
  sound.start()
  sound.setMuted(!audioOn)
  return sound
}

function lockClockAnchors() {
  playFilmAnchor = t
  playPerfAnchor = performance.now() / 1000
  playCtxAnchor = sound ? sound.ctx.currentTime : 0
}

function setPlaying(p: boolean) {
  playing = p
  btnPlay.textContent = p ? '❚❚' : '▶'
  if (p && exploring) setExplore(false)
  if (p) {
    ensureSound()
    lockClockAnchors()
    sound?.syncFilmTime(t, true, liveOpen, true)
  } else {
    sound?.stopFilmVoice()
  }
}

function seek(nt: number) {
  t = clamp(nt, 0, TOTAL - 0.01)
  forcePhoneScreen = undefined
  if (exploring) setExplore(false)
  ensureSound()
  playing = true
  btnPlay.textContent = '❚❚'
  lockClockAnchors()
  sound?.syncFilmTime(t, true, liveOpen, true)
}

function setExplore(on: boolean) {
  exploring = on
  controls.enabled = on
  $('btnExplore').classList.toggle('on', on)
  hint.classList.toggle('hidden', !on)
  hotspotLayer.style.display = on ? 'block' : 'none'
  if (on) {
    if (playing) {
      playing = false
      btnPlay.textContent = '▶'
      sound?.stopFilmVoice()
    }
    controls.target.copy(camLook)
    controls.update()
  }
}

btnPlay.addEventListener('click', () => {
  ensureSound()
  setPlaying(!playing)
})

$('btnExplore').addEventListener('click', () => setExplore(!exploring))

$('btnSound').addEventListener('click', () => {
  audioOn = !audioOn
  ;($('btnSound').querySelector('span') as HTMLElement).textContent = audioOn ? 'Voice & Music' : 'Muted'
  $('btnSound').classList.toggle('on', !audioOn)
  ensureSound().setMuted(!audioOn)
})

$('btnPhonePin').addEventListener('click', () => {
  pinPhone = !pinPhone
  $('btnPhonePin').classList.toggle('on', pinPhone)
  ;($('btnPhonePin').querySelector('span') as HTMLElement).textContent = pinPhone ? 'Phone Pinned' : 'Pin Phone'
})

glCanvas.addEventListener('pointerdown', () => {
  if (started && !exploring && !recording && !liveOpen) setExplore(true)
})

function begin(explore: boolean) {
  started = true
  $('start').classList.add('gone')
  ensureSound()
  if (explore) {
    t = 12
    setExplore(true)
    camera.position.set(22, 14, 34)
    controls.target.set(0, 4, -8)
    controls.update()
  } else {
    t = 0
    setPlaying(true)
  }
}
$('btnStart').addEventListener('click', () => begin(false))
$('btnStartExplore').addEventListener('click', () => begin(true))

/* =============================== Pure Phone-Number Dialing Widget =============================== */
const liveModal = $('liveModal')
const liveDigitsEl = $('liveDigits')
const liveDialHint = $('liveDialHint')
const liveDialView = $('liveDialView')
const liveCallView = $('liveCallView')
const liveTranscript = $('liveTranscript')
const liveBadge = $('liveBadge')
const liveStatus = $('liveStatus')
const liveTimerEl = $('liveTimer')
const liveWaveCanvas = $('liveWave') as HTMLCanvasElement
const liveWaveCtx = liveWaveCanvas.getContext('2d')!
let dialedStr = ''
let ringTimers: number[] = []
let callStartPerf = 0

function clearRingTimers() {
  ringTimers.forEach(id => clearTimeout(id))
  ringTimers = []
}

function openLivePhone() {
  if (!started) {
    started = true
    $('start').classList.add('gone')
  }
  ensureSound()
  if (playing) setPlaying(false)
  liveOpen = true
  dialedStr = ''
  liveDigitsEl.textContent = ''
  liveDialHint.innerHTML = 'Type <b>149</b> on keypad &amp; press Call'
  liveModal.classList.remove('hidden')
  $('btnLiveCall').classList.add('on')
}

function closeLivePhone() {
  clearRingTimers()
  sound?.stopInteractiveVoice()
  liveOpen = false
  callStartPerf = 0
  liveModal.classList.add('hidden')
  $('btnLiveCall').classList.remove('on')
  liveDialView.classList.remove('hidden')
  liveCallView.classList.add('hidden')
}

$('btnLiveCall').addEventListener('click', () => {
  if (liveOpen) closeLivePhone()
  else openLivePhone()
})
$('btnCloseLive').addEventListener('click', closeLivePhone)

document.querySelectorAll('#liveDialView .keypad button').forEach(btn => {
  btn.addEventListener('click', () => {
    const d = (btn as HTMLElement).dataset.d || ''
    if (dialedStr.length < 11) dialedStr += d
    liveDigitsEl.textContent = dialedStr
    ensureSound().playDtmf(d)
    if (dialedStr === '149') {
      liveDialHint.innerHTML = '<span style="color:#86efac">✓ 149 · Nam Payanam Helpline — Press 📞 Call</span>'
    }
  })
})

$('btnClearDigits').addEventListener('click', () => {
  dialedStr = dialedStr.slice(0, -1)
  liveDigitsEl.textContent = dialedStr
})

function runPhoneCallSequence() {
  const s = ensureSound()
  if (dialedStr !== '149' && !dialedStr.endsWith('149')) {
    liveDialHint.innerHTML = '<span style="color:#fca5a5">Please dial <b>149</b> for Nam Payanam Helpline</span>'
    s.playChime('hangup')
    return
  }

  liveDialView.classList.add('hidden')
  liveCallView.classList.remove('hidden')
  liveStatus.textContent = 'Cellular Voice Call · 149'
  liveBadge.textContent = '🔔 Ring 1 of 2…'
  liveTimerEl.textContent = 'Calling 149…'
  liveTranscript.innerHTML = 'Outgoing voice call to <b>149</b> (no internet or app)…'
  s.playIndianRing()

  ringTimers.push(
    window.setTimeout(() => {
      liveBadge.textContent = '🔔 Ring 2 of 2…'
      s.playIndianRing()
    }, 1500),
    window.setTimeout(() => {
      s.playChime('pickup')
      callStartPerf = performance.now()
      liveBadge.textContent = '🔊 Connected · குரல் (Kural)'
      liveTranscript.innerHTML =
        '<b>குரல்:</b> வணக்கம், நம் பயணம் ஹெல்ப்லைன்ல இருந்து குரல் பேசுறேன். நீங்க இப்போ எங்க இருக்கீங்க, எங்க போகணும்னு சொல்லுங்க?'
      s.playInteractiveClip('01_kural_welcome', () => {
        // Automatically continue natural phone call flow (or user can press 1/2/3 DTMF keys!)
        ringTimers.push(
          window.setTimeout(() => {
            liveBadge.textContent = '🎙️ Caller Speaking…'
            liveTranscript.innerHTML =
              '<b>பயணி:</b> ம்மா, நான் சென்ட்ரல் ஸ்டேஷன் வாசல்ல நிக்கிறேன். எனக்கு ஸ்ரீபெரும்புதூர் போகணும், ஆனா போன்ல கூகுள் மேப்ஸ்லாம் பாக்கத் தெரியாது. எந்த பஸ்ல போறதுன்னு கொஞ்சம் சொல்றியா?'
            s.playInteractiveClip('02_user_query', () => {
              ringTimers.push(
                window.setTimeout(() => {
                  liveBadge.textContent = '🔊 குரல் (Kural) Speaking…'
                  liveTranscript.innerHTML =
                    '<b>குரல்:</b> ரொம்ப சிம்பிள் தான் சார். நீங்க நிக்கிற சென்ட்ரல் பஸ் ஸ்டாப்லயே 53 நம்பர் பஸ் ஏறுங்க, பூந்தமல்லி போயிடும். அங்க இறங்கி 578 பஸ் மாறுனீங்கன்னா, நேரா ஸ்ரீபெரும்புதூர் போயிடலாம்.'
                  s.playInteractiveClip('03_kural_route', () => {
                    liveBadge.textContent = '✓ On Call · Press 1 (Repeat), 2 (Metro), or End Call'
                  })
                }, 400)
              )
            })
          }, 450)
        )
      })
    }, 3000)
  )
}

$('btnPlaceCall').addEventListener('click', runPhoneCallSequence)

const IVR_CLIPS: Record<string, { clip: ClipKey; ta: string }> = {
  '1': {
    clip: '09_kural_repeat',
    ta: 'மறுபடியும் சொல்றேன் சார். சென்ட்ரல்ல இருந்து 53 பஸ்ல பூந்தமல்லி போங்க, இல்லன்னா மெட்ரோல கோயம்பேடு போங்க. அங்க இருந்து 578 பஸ் ஏறுனா நேரா ஸ்ரீபெரும்புதூர் போயிடலாம்.',
  },
  '2': {
    clip: '05_kural_metro_msg',
    ta: 'பக்கத்துலயே இருக்கிற சென்ட்ரல் மெட்ரோல கிரீன் லைன் ஏறி கோயம்பேடுல இறங்கிடுங்க. அங்க இருந்தே உங்களுக்கு 578 பஸ் கிடைக்கும். இந்த பஸ் நம்பர்லாம் வாட்ஸ்அப்லயும் எஸ்எம்எஸ்லயும் அனுப்பி விடட்டா?',
  },
  '3': {
    clip: '08_kural_live_policy',
    ta: 'மன்னிக்கணும் சார், இப்போதைக்கு பஸ் டைமிங் விவரம் மட்டும்தான் என்கிட்ட இருக்கு. பஸ் இப்போ நேரா எங்க வருதுன்னு பாக்குற வசதி இன்னும் வரல.',
  },
}

document.querySelectorAll('#liveCallView .keypad button').forEach(btn => {
  btn.addEventListener('click', () => {
    const k = (btn as HTMLElement).dataset.ivr || '1'
    clearRingTimers()
    const s = ensureSound()
    s.playDtmf(k)
    const item = IVR_CLIPS[k]
    if (!item) return
    window.setTimeout(() => {
      liveBadge.textContent = '🔊 குரல் (Kural) Speaking…'
      liveTranscript.innerHTML = `<b>குரல்:</b> ${item.ta}`
      s.playInteractiveClip(item.clip, () => {
        liveBadge.textContent = '✓ On Call · Press End Call to receive WhatsApp & SMS'
      })
    }, 180)
  })
})

$('btnHangupLive').addEventListener('click', () => {
  const s = ensureSound()
  s.stopInteractiveVoice()
  s.playChime('hangup')
  closeLivePhone()
  seek(T.whatsapp + 0.15)
})

window.addEventListener('keydown', e => {
  if (liveOpen && !liveDialView.classList.contains('hidden')) {
    if (/^[0-9*#]$/.test(e.key)) {
      if (dialedStr.length < 11) dialedStr += e.key
      liveDigitsEl.textContent = dialedStr
      ensureSound().playDtmf(e.key)
      return
    }
    if (e.key === 'Backspace') {
      dialedStr = dialedStr.slice(0, -1)
      liveDigitsEl.textContent = dialedStr
      return
    }
    if (e.key === 'Enter') {
      runPhoneCallSequence()
      return
    }
  }
  if (e.code === 'Space') {
    e.preventDefault()
    if (!started) begin(false)
    else {
      ensureSound()
      setPlaying(!playing)
    }
  }
  if (e.code === 'ArrowRight') seek(t + 5)
  if (e.code === 'ArrowLeft') seek(t - 5)
})

/* =============================== 3D Explore Hotspots =============================== */
const hotspotLayer = $('hotspots')
hotspotLayer.style.display = 'none'
const HOTSPOTS: { label: string; pos: () => THREE.Vector3; t: number }[] = [
  { label: 'MGR Chennai Central Station', pos: () => v3(0, 26, -20), t: T.intro + 1 },
  { label: 'Murugan · Maps Confusion', pos: () => v3(1.65, 2.3, 3.65), t: T.problem + 1 },
  { label: 'Nam Payanam 149 Bus Shelter', pos: () => world.posterPos.clone().add(v3(0, 1.4, 0)), t: T.remember + 0.5 },
  { label: 'Central Metro (Green Line)', pos: () => world.metroPortalPos.clone().add(v3(0, 4.2, 0)), t: T.metro + 8 },
  { label: 'Poonamallee Transfer (53 → 578)', pos: () => world.poonamalleePos.clone().add(v3(0, 12, 0)), t: 56 },
  { label: 'Sriperumbudur Bus Terminus', pos: () => world.sriperumbudurPos.clone().add(v3(0, 12, 0)), t: 60 },
  { label: 'WhatsApp Card & Bus 53 Boarding', pos: () => v3(3.5, 3.8, 7.6), t: T.whatsapp + 0.5 },
  { label: 'Admin Center · Call Summary', pos: () => world.adminPos.clone().add(v3(0, 15, 0)), t: T.admin + 1 },
  { label: '3D System Architecture', pos: () => v3(0, ARCH_Y + 10, 0), t: T.arch + 2 },
]
const hsEls = HOTSPOTS.map(h => {
  const el = document.createElement('div')
  el.className = 'hotspot'
  el.innerHTML = `<b>${h.label}</b><i></i>`
  el.addEventListener('pointerdown', e => e.stopPropagation())
  el.addEventListener('click', () => seek(h.t))
  hotspotLayer.appendChild(el)
  return el
})

/* =============================== 1080p Video Recording =============================== */
let recording = false
let recorder: MediaRecorder | null = null
let comp: HTMLCanvasElement | null = null
let compCtx: CanvasRenderingContext2D | null = null
const recChunks: Blob[] = []

function startRecording() {
  if (recording) return
  if (typeof MediaRecorder === 'undefined') {
    alert('Video recording requires Chrome or Edge.')
    return
  }
  const s = ensureSound()
  fixedSize = [1920, 1080]
  resize()
  comp = document.createElement('canvas')
  comp.width = 1920
  comp.height = 1080
  compCtx = comp.getContext('2d')!
  const stream = comp.captureStream(30)
  s.stream.stream.getAudioTracks().forEach(tr => stream.addTrack(tr))
  const types = [
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  const mime = types.find(m => MediaRecorder.isTypeSupported(m)) ?? ''
  recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 14_000_000 } : undefined)
  recChunks.length = 0
  recorder.ondataavailable = e => {
    if (e.data.size) recChunks.push(e.data)
  }
  recorder.onstop = () => {
    const type = recorder?.mimeType || 'video/webm'
    const blob = new Blob(recChunks, { type })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Nam-Payanam-Chennai-3D-Demo.${type.includes('mp4') ? 'mp4' : 'webm'}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    fixedSize = null
    resize()
    $('recBadge').classList.add('hidden')
    $('btnRecord').classList.remove('on')
  }
  if (exploring) setExplore(false)
  if (liveOpen) closeLivePhone()
  t = 0
  recording = true
  setPlaying(true)
  recorder.start(1000)
  $('recBadge').classList.remove('hidden')
  $('btnRecord').classList.add('on')
}

function stopRecording() {
  if (!recording) return
  recording = false
  recorder?.stop()
}

$('btnRecord').addEventListener('click', () => {
  if (!started) begin(false)
  if (recording) stopRecording()
  else startRecording()
})

/* =============================== Main Hardware-Locked Render Loop =============================== */
let lastMove = performance.now()
window.addEventListener('pointermove', () => {
  lastMove = performance.now()
})
const uiEls = Array.from(document.querySelectorAll('.ui'))
const spectrumBars = new Array<number>(24).fill(0.08)

cameraAt(0, camPos, camLook)
camera.position.copy(camPos)
camera.lookAt(camLook)

function frame(now: number) {
  const nowS = now / 1000

  if (playing) {
    // Advance film clock directly from hardware AudioContext clock when running (zero drift, zero voice jitter!)
    if (sound && sound.ctx.state === 'running') {
      t = playFilmAnchor + (sound.ctx.currentTime - playCtxAnchor)
    } else {
      t = playFilmAnchor + (nowS - playPerfAnchor)
    }
    if (t >= TOTAL) {
      t = TOTAL - 0.001
      if (recording) stopRecording()
      setPlaying(false)
    }
  }

  sound?.syncFilmTime(t, playing, liveOpen, false)
  const voiceLevel = sound ? sound.getVoiceLevel() : 0
  if (sound) sound.fillSpectrum(spectrumBars, 24)

  if (liveOpen) {
    if (callStartPerf > 0) {
      const el = Math.floor((now - callStartPerf) / 1000)
      liveTimerEl.textContent = `Voice Call · ${String(Math.floor(el / 60)).padStart(2, '0')}:${String(el % 60).padStart(2, '0')}`
    }
    liveWaveCtx.clearRect(0, 0, 280, 48)
    for (let i = 0; i < 24; i++) {
      const amp = spectrumBars[i] ?? 0.08
      const bh = 5 + amp * 36
      liveWaveCtx.fillStyle = '#38BDF8'
      roundRect(liveWaveCtx, 8 + i * 11.2, 24 - bh / 2, 7.2, bh, 3.5)
      liveWaveCtx.fill()
    }
  }

  world.update(nowS, t)
  animateCast(t, voiceLevel)
  arch.update(exploring ? T.arch + 7 : t)
  impact.update(t)

  if (exploring) {
    controls.update()
    camLook.copy(controls.target)
  } else {
    cameraAt(t, camPos, camLook)
    camera.position.copy(camPos)
    camera.lookAt(camLook)
  }
  camera.updateMatrixWorld()

  updateHeroPhone(exploring && !pinPhone ? 0 : t)
  updateMonitor(exploring ? -10 : t)
  phoneKit.render(t, spectrumBars, forcePhoneScreen)

  // Seamless studio cyclorama backdrop during Architecture chapter (both sky & fog lerp together!)
  const fogK = exploring ? 0 : win(t, T.arch - 0.5, T.impact - 0.2, 1.0)
  const fog = scene.fog as THREE.Fog
  fog.near = lerp(190, 38, fogK)
  fog.far = lerp(980, 122, fogK)
  fog.color.copy(fogBase).lerp(fogArch, fogK)
  ;(scene.background as THREE.Color).copy(skyBase).lerp(fogArch, fogK)

  renderer.clear()
  renderer.render(scene, camera)
  renderer.clearDepth()
  renderer.render(ui, camera)
  drawOverlay(exploring ? -10 : t)

  if (recording && compCtx) {
    compCtx.drawImage(glCanvas, 0, 0, 1920, 1080)
    compCtx.drawImage(overlay, 0, 0, 1920, 1080)
    $('recTime').textContent = `${fmt(t)} / ${fmt(TOTAL)}`
  }

  timeEl.textContent = `${fmt(t)} / ${fmt(TOTAL)}`
  const ci = chapterAt(t)
  chapEls.forEach((c, i) => {
    c.fill.style.width = `${clamp((t - c.a) / (c.b - c.a)) * 100}%`
    c.el.classList.toggle('active', i === ci)
  })

  const idle = started && playing && !exploring && !liveOpen && now - lastMove > 2800
  uiEls.forEach(el => el.classList.toggle('idle', idle || recording))

  if (exploring) {
    const rect = glCanvas.getBoundingClientRect()
    HOTSPOTS.forEach((h, i) => {
      const p = h.pos().project(camera)
      const vis = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05
      hsEls[i].style.display = vis ? 'flex' : 'none'
      if (vis) {
        hsEls[i].style.left = `${rect.left + (p.x * 0.5 + 0.5) * rect.width}px`
        hsEls[i].style.top = `${rect.top + (-p.y * 0.5 + 0.5) * rect.height}px`
      }
    })
  }

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

;(window as unknown as { namPayanam: unknown }).namPayanam = {
  seek,
  get t() {
    return t
  },
  play: () => {
    started = true
    $('start').classList.add('gone')
    ensureSound()
    setPlaying(true)
  },
  pause: () => setPlaying(false),
  setPinPhone: (v: boolean) => {
    pinPhone = v
  },
  SCREENS,
  screenAt,
  phoneCanvas: phoneKit.canvas,
  phoneRect: () => {
    const v = new THREE.Vector3()
    heroScreen.getWorldPosition(v)
    v.project(camera)
    return { x: v.x * 0.5 + 0.5, y: -v.y * 0.5 + 0.5, z: v.z, vis: heroPhone.visible }
  },
}
