import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import logoUrl from '../assets/nam-payanam-logo.png?inline'
import { FONT, clamp, easeInOut, easeOut, labelSprite, lerp, mat, mesh, rng, roundRect, seg, smooth, v3 } from './util'
import { T } from './timeline'

export const SIDEWALK_Y = 0.14
const BoxGeo = THREE.BoxGeometry

/** High-DPI signboard texture generator (supports Tamil + English cleanly) */
function signTexture(
  line1: string,
  line2: string,
  opts: { bg?: string; fg?: string; sub?: string; border?: string; w?: number; h?: number } = {}
) {
  const W = opts.w ?? 1024
  const H = opts.h ?? 220
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = opts.bg ?? '#0B3C5D'
  ctx.fillRect(0, 0, W, H)
  if (opts.border) {
    ctx.strokeStyle = opts.border
    ctx.lineWidth = 10
    ctx.strokeRect(10, 10, W - 20, H - 20)
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = opts.fg ?? '#FFFFFF'
  ctx.font = `800 ${line2 ? 50 : 62}px ${FONT}`
  ctx.fillText(line1, W / 2, line2 ? H * 0.36 : H * 0.5, W - 56)
  if (line2) {
    ctx.fillStyle = opts.sub ?? '#FCD34D'
    ctx.font = `700 38px ${FONT}`
    ctx.fillText(line2, W / 2, H * 0.72, W - 56)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** Clock face texture for MGR Chennai Central & Ripon Building */
function clockTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#FFFDF6'
  ctx.beginPath()
  ctx.arc(128, 128, 118, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#1E293B'
  ctx.lineWidth = 10
  ctx.stroke()
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(128 + Math.sin(a) * 90, 128 - Math.cos(a) * 90)
    ctx.lineTo(128 + Math.sin(a) * 106, 128 - Math.cos(a) * 106)
    ctx.lineWidth = i % 3 === 0 ? 7 : 4
    ctx.stroke()
  }
  // 10:10 hands
  ctx.lineCap = 'round'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(128, 128)
  ctx.lineTo(84, 96)
  ctx.stroke()
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(128, 128)
  ctx.lineTo(176, 86)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(128, 128, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#B91C1C'
  ctx.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Nam Payanam 149 illuminated bus-shelter poster texture (with the attached logo!) */
function buildPosterTexture() {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 960
  const ctx = c.getContext('2d')!
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8

  const paint = (img?: HTMLImageElement) => {
    const g = ctx.createLinearGradient(0, 0, 0, 960)
    g.addColorStop(0, '#FFFFFF')
    g.addColorStop(0.56, '#F0F7FF')
    g.addColorStop(1, '#0B3C5D')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 640, 960)

    // Gold top ribbon
    ctx.fillStyle = '#F59E0B'
    ctx.fillRect(0, 0, 640, 22)

    if (img && img.complete && img.naturalWidth > 0) {
      const iw = 540
      const ih = (iw * img.naturalHeight) / img.naturalWidth
      ctx.drawImage(img, (640 - iw) / 2, 42, iw, ih)
    } else {
      ctx.fillStyle = '#0B3C5D'
      ctx.font = `800 58px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('நம் பயணம்', 320, 180)
      ctx.font = `700 40px ${FONT}`
      ctx.fillText('Nam Payanam', 320, 240)
    }

    // Call 149 hero badge
    roundRect(ctx, 44, 468, 552, 178, 34)
    ctx.fillStyle = '#0B3C5D'
    ctx.fill()
    ctx.strokeStyle = '#F59E0B'
    ctx.lineWidth = 6
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.fillStyle = '#FCD34D'
    ctx.font = `700 30px ${FONT}`
    ctx.fillText('கூகுள் மேப்ஸ் தேவையில்லை · அழைக்கவும்', 320, 514)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `900 92px ${FONT}`
    ctx.fillText('📞 149', 320, 606)

    // Bottom Tamil + English instructions
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `700 31px ${FONT}`
    ctx.fillText('குரல் AI தமிழில் உடனே வழிகாட்டும்!', 320, 718)
    ctx.fillStyle = '#BAE6FD'
    ctx.font = `600 25px ${FONT}`
    ctx.fillText('Speak in Tamil · Get Bus & Metro Route', 320, 768)

    roundRect(ctx, 64, 808, 512, 66, 33)
    ctx.fillStyle = '#16A34A'
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `800 26px ${FONT}`
    ctx.fillText('✓ WhatsApp பயண அட்டை + SMS இலவசம்', 320, 848)

    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = `600 20px ${FONT}`
    ctx.fillText('MTC Bus · CMRL Metro · Suburban Rail', 320, 922)
    tex.needsUpdate = true
  }

  paint()
  const img = new Image()
  img.onload = () => paint(img)
  img.src = logoUrl
  return tex
}

/**
 * Puratchi Thalaivar Dr. M.G.R. Chennai Central Railway Station
 * Authentic Indo-Saracenic red brick + white Chunar limestone trim + central clock tower + twin turrets
 */
function buildChennaiCentral(): THREE.Group {
  const g = new THREE.Group()
  const redBrick = mat('#B92525', { rough: 0.78 })
  const darkBrick = mat('#941B1B', { rough: 0.82 })
  const whiteTrim = mat('#F8F5EE', { rough: 0.55 })
  const archVoid = mat('#2B1818', { rough: 0.9 })
  const slateRoof = mat('#334155', { rough: 0.65, metal: 0.15 })
  const goldM = mat('#EAB308', { metal: 0.75, rough: 0.25 })
  const clockTex = clockTexture()

  // Broad granite plinth
  g.add(mesh(new BoxGeo(52, 0.75, 14), mat('#CBD5E1', { rough: 0.85 }), 0, 0.375, 0))
  // Forecourt steps
  for (let s = 0; s < 3; s++) {
    g.add(mesh(new BoxGeo(14 - s * 0.8, 0.24, 1.4 - s * 0.35), mat('#E2E8F0', { rough: 0.8 }), 0, 0.12 + s * 0.24, 7.5 - s * 0.35))
  }

  // Main 2-storey red-brick wings
  g.add(mesh(new BoxGeo(48, 10.6, 11.2), redBrick, 0, 6.05, 0))
  // White horizontal limestone stringcourses & cornice bands
  for (const hy of [0.9, 5.7, 11.15]) {
    g.add(mesh(new BoxGeo(48.5, 0.38, 11.55), whiteTrim, 0, hy, 0))
  }
  // Steep pitched heritage roof
  const roofPrism = new THREE.CylinderGeometry(3.8, 3.8, 47.6, 3)
  roofPrism.rotateZ(Math.PI / 2)
  roofPrism.rotateX(Math.PI / 6)
  const mainRoof = mesh(roofPrism, slateRoof, 0, 12.6, 0)
  mainRoof.scale.set(1, 0.68, 1.45)
  g.add(mainRoof)

  // Indo-Saracenic white-trimmed arched colonnade bays along front facade (+Z)
  for (let side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const bx = side * (6.8 + i * 3.55)
      // White pilasters
      g.add(mesh(new BoxGeo(0.42, 10.2, 0.45), whiteTrim, bx - side * 1.75, 6.0, 5.65))
      // Ground floor pointed arch surround + dark recessed veranda
      for (const fy of [3.1, 8.2]) {
        const aw = 2.1
        const ah = fy < 5 ? 3.4 : 2.9
        g.add(mesh(new BoxGeo(aw + 0.36, ah, 0.28), whiteTrim, bx, fy, 5.62))
        g.add(mesh(new BoxGeo(aw, ah - 0.22, 0.36), archVoid, bx, fy - 0.08, 5.66))
        const crown = mesh(new THREE.CylinderGeometry(aw / 2 + 0.18, aw / 2 + 0.18, 0.3, 16, 1, false, 0, Math.PI), whiteTrim, bx, fy + ah / 2 - 0.1, 5.62)
        crown.rotation.x = Math.PI / 2
        crown.rotation.z = -Math.PI / 2
        g.add(crown)
      }
      // Rooftop decorative white-and-red gable dormers
      if (i % 2 === 1) {
        g.add(mesh(new BoxGeo(2.4, 2.2, 1.4), redBrick, bx, 12.2, 5.1))
        const gable = mesh(new THREE.ConeGeometry(1.65, 1.5, 4), whiteTrim, bx, 13.9, 5.1)
        gable.rotation.y = Math.PI / 4
        g.add(gable)
      }
    }

    // Flanking corner towers (signature twin side towers of Chennai Central!)
    const tx = side * 23.2
    g.add(mesh(new BoxGeo(5.2, 15.6, 12.2), darkBrick, tx, 8.55, 0.3))
    for (const qy of [2, 5.7, 9.6, 13.4, 16.3]) {
      g.add(mesh(new BoxGeo(5.55, 0.34, 12.55), whiteTrim, tx, qy, 0.3))
    }
    const sideSpire = mesh(new THREE.ConeGeometry(3.5, 4.8, 4), slateRoof, tx, 18.8, 0.3)
    sideSpire.rotation.y = Math.PI / 4
    g.add(sideSpire)
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8), goldM, tx, 21.8, 0.3))
  }

  // Grand Central Clock Tower (136 ft heritage focal point!)
  g.add(mesh(new BoxGeo(8.2, 15.5, 9.2), redBrick, 0, 8.5, 1.8))
  // White corner quoins on clock tower
  for (const qx of [-4.05, 4.05]) {
    for (let k = 0; k < 14; k++) {
      g.add(mesh(new BoxGeo(0.55, 0.55, 0.55), whiteTrim, qx, 1.8 + k * 1.05, 6.35))
    }
  }
  // Upper clock tower shaft
  g.add(mesh(new BoxGeo(6.2, 9.2, 6.2), darkBrick, 0, 20.6, 1.8))
  g.add(mesh(new BoxGeo(6.7, 0.45, 6.7), whiteTrim, 0, 16.2, 1.8))
  g.add(mesh(new BoxGeo(6.6, 0.45, 6.6), whiteTrim, 0, 21.2, 1.8))
  g.add(mesh(new BoxGeo(6.8, 0.55, 6.8), whiteTrim, 0, 25.2, 1.8))

  // Illuminated Clock Faces on all 4 sides
  const clockMat = new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  for (let d = 0; d < 4; d++) {
    const a = (d * Math.PI) / 2
    const face = new THREE.Mesh(new THREE.CircleGeometry(1.55, 28), clockMat)
    face.position.set(Math.sin(a) * 3.16, 23.1, 1.8 + Math.cos(a) * 3.16)
    face.rotation.y = a
    g.add(face)
    const rim = mesh(new THREE.TorusGeometry(1.62, 0.14, 10, 28), whiteTrim, face.position.x, face.position.y, face.position.z, false)
    rim.rotation.y = a
    g.add(rim)
  }

  // Pyramidal clock spire + finials + waving Indian Tricolour
  const mainSpire = mesh(new THREE.ConeGeometry(4.5, 6.6, 4), slateRoof, 0, 28.8, 1.8)
  mainSpire.rotation.y = Math.PI / 4
  g.add(mainSpire)
  const mast = mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.8, 8), whiteTrim, 0, 33.4, 1.8, false)
  g.add(mast)

  // Indian National Flag
  const flag = new THREE.Group()
  flag.position.set(0.05, 34.6, 1.8)
  flag.add(mesh(new BoxGeo(1.8, 0.38, 0.04), mat('#FF9933', { emissive: '#FF9933', ei: 0.2 }), 0.9, 0.38, 0, false))
  flag.add(mesh(new BoxGeo(1.8, 0.38, 0.04), mat('#FFFFFF', { emissive: '#FFFFFF', ei: 0.2 }), 0.9, 0, 0, false))
  flag.add(mesh(new BoxGeo(1.8, 0.38, 0.04), mat('#138808', { emissive: '#138808', ei: 0.2 }), 0.9, -0.38, 0, false))
  flag.add(mesh(new THREE.CircleGeometry(0.15, 16), new THREE.MeshBasicMaterial({ color: '#000080', side: THREE.DoubleSide }), 0.9, 0, 0.03, false))
  g.add(flag)
  g.userData.flag = flag

  // Grand Entrance Portico + Bilingual Fascia Signboard
  g.add(mesh(new BoxGeo(13.6, 0.65, 4.4), whiteTrim, 0, 5.8, 7.2))
  for (const px of [-5.8, -2.2, 2.2, 5.8]) {
    g.add(mesh(new THREE.CylinderGeometry(0.32, 0.36, 5.1, 14), whiteTrim, px, 3.0, 9.0))
  }
  const boardTex = signTexture(
    'புரட்சித் தலைவர் டாக்டர் எம்.ஜி.ஆர் மத்திய ரயில் நிலையம்',
    'PURATCHI THALAIVAR DR. M.G.R. CHENNAI CENTRAL',
    { bg: '#881313', fg: '#FFFFFF', sub: '#FDE047', border: '#F8F5EE', w: 1400, h: 220 }
  )
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(13.0, 2.05),
    new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  )
  signMesh.position.set(0, 7.15, 6.48)
  g.add(signMesh)
  g.add(mesh(new BoxGeo(13.3, 2.25, 0.22), whiteTrim, 0, 7.15, 6.32))

  return g
}

/** Gleaming white Ripon Building (Greater Chennai Corporation) beside Central */
function buildRiponBuilding(): THREE.Group {
  const g = new THREE.Group()
  const cream = mat('#FCFBF7', { rough: 0.5 })
  const trim = mat('#E2E8F0', { rough: 0.6 })
  const domeM = mat('#CBD5E1', { rough: 0.4, metal: 0.25 })
  g.add(mesh(new BoxGeo(28, 9.2, 10), cream, 0, 4.6, 0))
  g.add(mesh(new BoxGeo(28.6, 0.45, 10.5), trim, 0, 9.3, 0))
  g.add(mesh(new BoxGeo(6.4, 15.2, 7.2), cream, 0, 7.6, 1.2))
  g.add(mesh(new THREE.SphereGeometry(2.6, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeM, 0, 15.2, 1.2))
  for (const sx of [-11, 11]) {
    g.add(mesh(new BoxGeo(4.8, 11.6, 8.2), cream, sx, 5.8, 0.5))
    g.add(mesh(new THREE.SphereGeometry(2.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeM, sx, 11.6, 0.5))
  }
  for (let i = -5; i <= 5; i++) {
    if (Math.abs(i) <= 1) continue
    g.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, 8.4, 10), trim, i * 2.2, 4.4, 5.15))
  }
  return g
}

/** Marina Lighthouse & Dravidian Temple Gopuram on the Chennai skyline */
function buildMarinaLighthouse(): THREE.Group {
  const g = new THREE.Group()
  for (let i = 0; i < 7; i++) {
    const r0 = 2.6 - i * 0.16
    const r1 = 2.6 - (i + 1) * 0.16
    g.add(mesh(new THREE.CylinderGeometry(r1, r0, 4.2, 18), mat(i % 2 === 0 ? '#DC2626' : '#FFFFFF', { rough: 0.6 }), 0, 2.1 + i * 4.2, 0))
  }
  g.add(mesh(new THREE.CylinderGeometry(1.9, 1.9, 1.2, 18), mat('#1E293B'), 0, 30.0, 0))
  g.add(mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.4, 16), mat('#FEF08A', { emissive: '#FDE047', ei: 0.9 }), 0, 31.8, 0))
  g.add(mesh(new THREE.ConeGeometry(1.7, 2.2, 16), mat('#DC2626'), 0, 34.1, 0))
  return g
}

function buildGopuram(): THREE.Group {
  const g = new THREE.Group()
  const colors = ['#D97706', '#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#EA580C', '#0284C7']
  g.add(mesh(new BoxGeo(11, 4.5, 7.5), mat('#D6D3D1'), 0, 2.25, 0))
  for (let t = 0; t < 7; t++) {
    const w = 10.2 - t * 0.95
    const d = 6.8 - t * 0.58
    const y = 5.6 + t * 2.45
    g.add(mesh(new BoxGeo(w, 2.2, d), mat(colors[t % colors.length], { rough: 0.7 }), 0, y, 0))
    g.add(mesh(new BoxGeo(w + 0.35, 0.32, d + 0.35), mat('#FDE047', { rough: 0.5 }), 0, y + 1.12, 0))
  }
  // Barrel vault crown + golden kalasams
  const topY = 5.6 + 7 * 2.45
  g.add(mesh(new BoxGeo(3.8, 1.5, 2.4), mat('#B45309'), 0, topY, 0))
  for (let k = -2; k <= 2; k++) {
    g.add(mesh(new THREE.ConeGeometry(0.24, 0.95, 10), mat('#FACC15', { metal: 0.85, rough: 0.2 }), k * 0.72, topY + 1.2, 0))
  }
  return g
}

/** Authentic MTC Chennai Bus Shelter + Nam Payanam 149 Illuminated Poster */
function buildBusShelter(posterTex: THREE.Texture): THREE.Group {
  const g = new THREE.Group()
  const steel = mat('#94A3B8', { metal: 0.75, rough: 0.28 })
  const mtcBlue = mat('#0B4F8A', { rough: 0.45, metal: 0.15 })
  const dark = mat('#1E293B', { rough: 0.5 })

  // Steel pillars (resting on sidewalk y = 0 local)
  for (const px of [-2.6, 0.4, 2.6]) {
    g.add(mesh(new THREE.CylinderGeometry(0.065, 0.065, 2.65, 12), steel, px, 1.325, -0.75))
  }
  for (const px of [-2.6, 2.6]) {
    g.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.55, 12), steel, px, 1.275, 0.65))
  }

  // Cantilevered curved shelter roof
  const roof = mesh(new RoundedBoxGeometry(6.0, 0.16, 2.1, 3, 0.06), mtcBlue, 0, 2.68, -0.02)
  roof.rotation.x = 0.05
  g.add(roof)

  // MTC Fascia Signboard
  const fasciaTex = signTexture(
    'சென்னை மாநகர போக்குவரத்துக் கழகம் · சென்ட்ரல்',
    'MTC CHENNAI · MGR CENTRAL BUS STOP (53 · 15B · 101 · 29C)',
    { bg: '#0B4F8A', fg: '#FFFFFF', sub: '#BAE6FD', w: 1200, h: 160 }
  )
  const fascia = new THREE.Mesh(
    new THREE.PlaneGeometry(5.8, 0.52),
    new THREE.MeshBasicMaterial({ map: fasciaTex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  )
  fascia.position.set(0, 2.86, 1.04)
  g.add(fascia)
  g.add(mesh(new BoxGeo(5.88, 0.58, 0.1), dark, 0, 2.86, 0.98))

  // Back glass / route panel + steel commuter bench
  g.add(mesh(new BoxGeo(2.8, 1.65, 0.06), mat('#E2E8F0', { rough: 0.3 }), -1.1, 1.42, -0.75))
  g.add(mesh(new RoundedBoxGeometry(2.5, 0.08, 0.46, 2, 0.03), steel, -1.1, 0.46, -0.32))
  for (const bx of [-2.1, -0.1]) {
    g.add(mesh(new BoxGeo(0.08, 0.46, 0.38), dark, bx, 0.23, -0.32))
  }

  // Illuminated Nam Payanam 149 Mupi Poster Lightbox on the right side of the shelter!
  g.add(mesh(new RoundedBoxGeometry(1.48, 2.16, 0.16, 3, 0.05), dark, 1.65, 1.28, -0.15))
  const posterMat = new THREE.MeshBasicMaterial({
    map: posterTex,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })
  const posterFront = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 2.0), posterMat)
  posterFront.position.set(1.65, 1.28, -0.06)
  g.add(posterFront)
  const posterBack = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 2.0), posterMat)
  posterBack.position.set(1.65, 1.28, -0.24)
  posterBack.rotation.y = Math.PI
  g.add(posterBack)

  return g
}

/** Realistic MTC Chennai Bus (Blue & White Deluxe livery + glowing Tamil/English LED route board) */
export function buildMtcBus(routeNo: string, destTa: string, destEn: string, bodyColor = '#1D63B8'): THREE.Group {
  const g = new THREE.Group()
  const blueM = mat(bodyColor, { rough: 0.42, metal: 0.15 })
  const whiteM = mat('#F8FAFC', { rough: 0.45 })
  const glassM = mat('#1E293B', { rough: 0.18, metal: 0.55 })
  const tireM = mat('#171717', { rough: 0.85 })
  const rimM = mat('#CBD5E1', { metal: 0.7, rough: 0.3 })

  // Lower blue body + white upper window band + rounded roof
  g.add(mesh(new RoundedBoxGeometry(9.6, 1.35, 2.52, 3, 0.12), blueM, 0, 1.05, 0))
  g.add(mesh(new RoundedBoxGeometry(9.56, 1.15, 2.50, 3, 0.10), whiteM, 0, 2.15, 0))
  g.add(mesh(new RoundedBoxGeometry(9.4, 0.32, 2.44, 3, 0.12), blueM, 0, 2.82, 0))
  // Yellow safety stripe
  g.add(mesh(new BoxGeo(9.64, 0.10, 2.54), mat('#F59E0B'), 0, 1.56, 0, false))

  // Front (+X) windshield & headlights
  g.add(mesh(new BoxGeo(0.08, 1.05, 2.26), glassM, 4.78, 2.12, 0, false))
  for (const hz of [-0.88, 0.88]) {
    g.add(mesh(new THREE.CircleGeometry(0.16, 14), new THREE.MeshBasicMaterial({ color: '#FEF9C3' }), 4.82, 0.78, hz, false).rotateY(Math.PI / 2))
    g.add(mesh(new THREE.CircleGeometry(0.13, 14), new THREE.MeshBasicMaterial({ color: '#EF4444' }), -4.82, 0.82, hz, false).rotateY(-Math.PI / 2))
  }

  // Side passenger windows
  for (let i = 0; i < 6; i++) {
    const wx = -3.4 + i * 1.32
    g.add(mesh(new BoxGeo(1.08, 0.82, 2.53), glassM, wx, 2.15, 0, false))
  }

  // Glowing Amber LED Destination Board (Front & Curb Side)
  const ledTex = signTexture(`${routeNo}  ${destTa}`, `${routeNo} · ${destEn}`, {
    bg: '#111827',
    fg: '#FBBF24',
    sub: '#38BDF8',
    w: 768,
    h: 170,
  })
  const ledMat = new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  const frontLed = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.38), ledMat)
  frontLed.position.set(4.81, 2.74, 0)
  frontLed.rotation.y = Math.PI / 2
  g.add(frontLed)

  const sideLed = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.36), ledMat)
  sideLed.position.set(2.2, 2.66, -1.27)
  sideLed.rotation.y = Math.PI
  g.add(sideLed)
  const sideLed2 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.36), ledMat)
  sideLed2.position.set(2.2, 2.66, 1.27)
  g.add(sideLed2)

  // Curb-side passenger doorway + animated sliding doors (-Z curb side, x = 1.65)
  g.add(mesh(new BoxGeo(1.18, 2.05, 0.14), mat('#0F172A', { rough: 0.9 }), 1.65, 1.48, -1.22, false))
  g.add(mesh(new BoxGeo(1.16, 0.1, 0.22), mat('#94A3B8', { metal: 0.5 }), 1.65, 0.48, -1.22, false))
  const doorMat = mat('#E2E8F0', { rough: 0.35, metal: 0.3 })
  const doorL = mesh(new BoxGeo(0.56, 1.98, 0.05), doorMat, 1.36, 1.48, -1.27, false)
  const doorR = mesh(new BoxGeo(0.56, 1.98, 0.05), doorMat, 1.94, 1.48, -1.27, false)
  g.add(doorL, doorR)
  g.userData.doorL = doorL
  g.userData.doorR = doorR

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.28, 18)
  wheelGeo.rotateX(Math.PI / 2)
  const hubGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.30, 14)
  hubGeo.rotateX(Math.PI / 2)
  for (const wx of [-2.85, 2.95]) {
    for (const wz of [-1.18, 1.18]) {
      g.add(mesh(wheelGeo, tireM, wx, 0.48, wz))
      g.add(mesh(hubGeo, rimM, wx, 0.48, wz, false))
    }
  }
  return g
}

/** Iconic Chennai Yellow-and-Black Auto Rickshaw */
function buildAutoRickshaw(): THREE.Group {
  const g = new THREE.Group()
  const yellow = mat('#FACC15', { rough: 0.45 })
  const black = mat('#1F2937', { rough: 0.72 })
  const glass = mat('#334155', { rough: 0.2, metal: 0.5 })
  const tire = mat('#111827', { rough: 0.85 })

  g.add(mesh(new RoundedBoxGeometry(2.45, 0.68, 1.28, 3, 0.1), black, -0.1, 0.52, 0))
  g.add(mesh(new RoundedBoxGeometry(2.42, 0.45, 1.26, 3, 0.08), yellow, -0.05, 0.92, 0))
  // Front nose + windshield + single front wheel
  g.add(mesh(new RoundedBoxGeometry(0.75, 0.85, 0.86, 3, 0.12), yellow, 1.0, 0.78, 0))
  g.add(mesh(new BoxGeo(0.06, 0.58, 0.96), glass, 1.12, 1.34, 0, false).rotateZ(0.22))
  // Black canvas canopy roof
  g.add(mesh(new RoundedBoxGeometry(2.15, 0.18, 1.28, 3, 0.08), black, -0.08, 1.72, 0))
  for (const px of [-1.05, 0.85]) {
    for (const pz of [-0.56, 0.56]) {
      g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6), black, px, 1.38, pz, false))
    }
  }
  const wGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.16, 14)
  wGeo.rotateX(Math.PI / 2)
  g.add(mesh(wGeo, tire, 1.18, 0.26, 0))
  g.add(mesh(wGeo, tire, -0.82, 0.26, -0.58))
  g.add(mesh(wGeo, tire, -0.82, 0.26, 0.58))
  return g
}

/** Compact city car */
function buildCar(color: string): THREE.Group {
  const g = new THREE.Group()
  const bodyM = mat(color, { rough: 0.35, metal: 0.3 })
  const glassM = mat('#1E293B', { rough: 0.2, metal: 0.6 })
  const tireM = mat('#171717', { rough: 0.85 })
  g.add(mesh(new RoundedBoxGeometry(4.1, 0.68, 1.78, 3, 0.12), bodyM, 0, 0.56, 0))
  g.add(mesh(new RoundedBoxGeometry(2.25, 0.58, 1.56, 3, 0.14), bodyM, -0.15, 1.12, 0))
  g.add(mesh(new RoundedBoxGeometry(2.28, 0.44, 1.59, 2, 0.08), glassM, -0.15, 1.12, 0, false))
  const wGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.2, 14)
  wGeo.rotateX(Math.PI / 2)
  for (const wx of [-1.25, 1.28]) {
    for (const wz of [-0.84, 0.84]) g.add(mesh(wGeo, tireM, wx, 0.31, wz))
  }
  return g
}

/** Sleek 3-Coach CMRL Chennai Metro Train */
function buildMetroTrain(): THREE.Group {
  const g = new THREE.Group()
  const silver = mat('#E2E8F0', { metal: 0.55, rough: 0.28 })
  const cmrlBlue = mat('#0284C7', { rough: 0.35, metal: 0.2 })
  const glass = mat('#0F172A', { rough: 0.18, metal: 0.65 })
  for (let c = -1; c <= 1; c++) {
    const cx = c * 11.4
    g.add(mesh(new RoundedBoxGeometry(11.0, 2.75, 2.7, 4, 0.28), silver, cx, 1.55, 0))
    g.add(mesh(new BoxGeo(11.04, 0.36, 2.74), cmrlBlue, cx, 1.02, 0, false))
    g.add(mesh(new BoxGeo(11.04, 0.22, 2.74), cmrlBlue, cx, 2.52, 0, false))
    for (let w = -2; w <= 2; w++) {
      g.add(mesh(new BoxGeo(1.5, 0.88, 2.75), glass, cx + w * 2.0, 1.78, 0, false))
    }
  }
  // Aerodynamic cab windows at both ends
  for (const s of [-1, 1]) {
    g.add(mesh(new RoundedBoxGeometry(0.35, 1.25, 2.2, 2, 0.1), glass, s * 16.85, 1.85, 0, false))
  }
  return g
}

/** Tropical Chennai Coconut Palm & Neem/Gulmohar Avenue Tree */
function buildCoconutPalm(r: () => number): THREE.Group {
  const g = new THREE.Group()
  const trunkM = mat('#6B4F3A', { rough: 0.9 })
  const leafM = mat('#2E7D32', { rough: 0.65 })
  const h = 6.8 + r() * 2.2
  const curveX = (r() - 0.5) * 0.8
  for (let s = 0; s < 7; s++) {
    const f = s / 7
    const segM = mesh(new THREE.CylinderGeometry(0.18 * (1 - f * 0.35), 0.22 * (1 - f * 0.3), h / 6.6, 8), trunkM, curveX * f * f, (s + 0.5) * (h / 7), 0)
    segM.rotation.z = (-curveX * 0.22 * f)
    g.add(segM)
  }
  const crown = new THREE.Group()
  crown.position.set(curveX, h, 0)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + r() * 0.3
    const frond = new THREE.Group()
    frond.rotation.y = a
    const blade = mesh(new BoxGeo(2.6, 0.06, 0.52), leafM, 1.25, -0.25, 0)
    blade.rotation.z = -0.38
    frond.add(blade)
    crown.add(frond)
  }
  g.add(crown)
  return g
}

function buildAvenueTree(blossomColor?: string): THREE.Group {
  const g = new THREE.Group()
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.6, 8), mat('#5C4033'), 0, 1.3, 0))
  const green = mat('#2F855A', { rough: 0.78 })
  for (const [dx, dy, dz, rad] of [
    [0, 3.8, 0, 1.85],
    [-1.1, 3.3, 0.5, 1.35],
    [1.1, 3.4, -0.4, 1.4],
    [0.2, 4.5, 0.6, 1.25],
  ] as const) {
    g.add(mesh(new THREE.IcosahedronGeometry(rad, 1), green, dx, dy, dz))
  }
  if (blossomColor) {
    // Flame-of-the-forest (Gulmohar) blossoms along Chennai avenues!
    const bm = mat(blossomColor, { emissive: blossomColor, ei: 0.15 })
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      g.add(mesh(new THREE.IcosahedronGeometry(0.45, 0), bm, Math.cos(a) * 1.35, 4.1 + (i % 2) * 0.4, Math.sin(a) * 1.25, false))
    }
  }
  return g
}

export function buildWorld(scene: THREE.Scene) {
  const r = rng(149)

  // Bright warm coastal Chennai sky + atmospheric haze
  scene.background = new THREE.Color('#CBE7FA')
  scene.fog = new THREE.Fog('#D9EEFC', 190, 980)

  const skyGeo = new THREE.SphereGeometry(1500, 24, 16)
  const skyPos = skyGeo.attributes.position
  const skyCols = new Float32Array(skyPos.count * 3)
  const cZenith = new THREE.Color('#3B82C4')
  const cMid = new THREE.Color('#9BD3F7')
  const cHorizon = new THREE.Color('#FFF4E0')
  const tmpC = new THREE.Color()
  for (let i = 0; i < skyPos.count; i++) {
    const h = clamp(skyPos.getY(i) / 1500, 0, 1)
    tmpC.copy(cHorizon).lerp(cMid, Math.pow(h, 0.42)).lerp(cZenith, Math.pow(h, 1.25))
    skyCols[i * 3] = tmpC.r
    skyCols[i * 3 + 1] = tmpC.g
    skyCols[i * 3 + 2] = tmpC.b
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCols, 3))
  scene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })))

  // Warm Chennai morning sunlight + Bay of Bengal sky fill
  scene.add(new THREE.HemisphereLight('#BCE3FF', '#C4B59B', 0.85))
  const sun = new THREE.DirectionalLight('#FFF6E3', 2.25)
  sun.position.set(68, 96, 74)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 10
  sun.shadow.camera.far = 320
  const sc = sun.shadow.camera
  sc.left = -85
  sc.right = 85
  sc.top = 75
  sc.bottom = -65
  sun.shadow.bias = -0.0004
  scene.add(sun)

  const world = new THREE.Group()
  scene.add(world)

  // Base urban ground plane
  const earth = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), mat('#DCE5D5', { rough: 1 }))
  earth.rotation.x = -Math.PI / 2
  earth.position.y = -0.04
  earth.receiveShadow = true
  world.add(earth)

  // Bay of Bengal strip far East (+X > 150)
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 1600), mat('#2589BD', { rough: 0.35, metal: 0.2 }))
  sea.rotation.x = -Math.PI / 2
  sea.position.set(390, -0.01, 0)
  world.add(sea)
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(46, 1600), mat('#F3DFB6', { rough: 0.95 }))
  sand.rotation.x = -Math.PI / 2
  sand.position.set(150, 0.0, 0)
  world.add(sand)

  /* ---- Poonamallee High Road (EVR Periyar Salai) -> NH-48 Sriperumbudur Corridor ---- */
  const ROAD_LEN = 620
  const ROAD_X0 = -90 // spans from x = -400 (Sriperumbudur West) to x = +220 (Beach East)
  const roadMat = mat('#2B303A', { rough: 0.88, polyOffset: -1 })
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_LEN, 16.4), roadMat)
  road.rotation.x = -Math.PI / 2
  road.position.set(ROAD_X0, 0.02, 14.5)
  road.receiveShadow = true
  world.add(road)

  // Dedicated MGR Central Bus Boarding Bay recess (z = 5.4..7.2, x = -6..+14)
  const busBay = new THREE.Mesh(new THREE.PlaneGeometry(24, 2.6), roadMat)
  busBay.rotation.x = -Math.PI / 2
  busBay.position.set(4.0, 0.022, 6.2)
  busBay.receiveShadow = true
  world.add(busBay)

  // Crisp white lane markings & zebra pedestrian crossing (elevated + polyOffset -> zero z-fighting!)
  const stripeMat = new THREE.MeshBasicMaterial({
    color: '#F8FAFC',
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  })
  for (let x = -380; x <= 200; x += 7.5) {
    for (const lz of [10.4, 18.6]) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.16), stripeMat)
      dash.rotation.x = -Math.PI / 2
      dash.position.set(x, 0.045, lz)
      world.add(dash)
    }
  }
  // Zebra crossing near Central Metro / Plaza
  for (let z = 7.2; z <= 21.8; z += 1.05) {
    if (Math.abs(z - 14.5) < 0.8) continue
    const zb = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.48), stripeMat)
    zb.rotation.x = -Math.PI / 2
    zb.position.set(-10.5, 0.048, z)
    world.add(zb)
  }

  // Yellow-and-Black Chennai Concrete Road Median + Bougainvillea Shrubs
  for (let x = -360; x <= 190; x += 4.0) {
    if (Math.abs(x - -10.5) < 3.2) continue // gap for pedestrian zebra crossing
    const col = Math.floor((x + 400) / 4) % 2 === 0 ? '#FACC15' : '#1E293B'
    world.add(mesh(new BoxGeo(3.92, 0.42, 0.72), mat(col, { rough: 0.8 }), x, 0.22, 14.5))
    if (Math.floor((x + 400) / 4) % 3 === 0) {
      world.add(mesh(new THREE.IcosahedronGeometry(0.42, 0), mat('#2E7D32'), x, 0.65, 14.5))
      world.add(mesh(new THREE.IcosahedronGeometry(0.22, 0), mat('#EC4899'), x + 0.15, 0.88, 14.5, false))
    }
  }

  // North Forecourt Plaza & Sidewalk (MGR Central side: y = SIDEWALK_Y = 0.14)
  const northPlaza = mesh(new BoxGeo(160, SIDEWALK_Y, 44), mat('#CBD5E1', { rough: 0.88 }), 0, SIDEWALK_Y / 2, -16.8)
  world.add(northPlaza)
  // Forecourt tiled walkway strip along bus shelter
  const walkStrip = mesh(new BoxGeo(340, SIDEWALK_Y, 4.8), mat('#D6D3D1', { rough: 0.85 }), -80, SIDEWALK_Y / 2, 2.8)
  world.add(walkStrip)
  // South Sidewalk
  world.add(mesh(new BoxGeo(520, SIDEWALK_Y, 16), mat('#CBD5E1', { rough: 0.88 }), -80, SIDEWALK_Y / 2, 30.8))

  // Streetlamps along Poonamallee High Road (set back on sidewalk, clear of bus bay x=[-16..22])
  for (let x = -220; x <= 90; x += 26) {
    if (x > -16 && x < 22) continue
    const pole = mesh(new THREE.CylinderGeometry(0.08, 0.11, 7.2, 8), mat('#475569', { metal: 0.6 }), x, 3.6, 4.35)
    world.add(pole)
    world.add(mesh(new BoxGeo(0.12, 0.12, 0.9), mat('#475569', { metal: 0.6 }), x, 7.15, 4.72, false))
    world.add(mesh(new BoxGeo(0.35, 0.1, 0.45), mat('#FEF9C3', { emissive: '#FEF08A', ei: 0.8 }), x, 7.08, 5.05, false))
  }

  /* ---- Hero Chennai Landmarks ---- */
  const central = buildChennaiCentral()
  central.position.set(0, SIDEWALK_Y, -22)
  world.add(central)

  const ripon = buildRiponBuilding()
  ripon.position.set(-46, SIDEWALK_Y, -24)
  world.add(ripon)

  // Southern Railway HQ (East of Central)
  const srHq = buildRiponBuilding()
  srHq.scale.set(0.85, 0.9, 0.9)
  srHq.position.set(44, SIDEWALK_Y, -23)
  world.add(srHq)

  // Skyline Icons: Marina Lighthouse, Temple Gopuram, LIC Tower
  const lighthouse = buildMarinaLighthouse()
  lighthouse.position.set(138, 0, 48)
  world.add(lighthouse)

  const gopuram = buildGopuram()
  gopuram.position.set(74, 0, 52)
  world.add(gopuram)

  // LIC Building (14-storey modernist icon on Anna Salai skyline)
  const lic = new THREE.Group()
  lic.position.set(34, 0, 56)
  lic.add(mesh(new BoxGeo(11, 34, 6.2), mat('#E2E8F0', { rough: 0.5 }), 0, 17, 0))
  lic.add(mesh(new BoxGeo(10.2, 31, 6.35), mat('#1E40AF', { rough: 0.3, metal: 0.4 }), 0, 16.5, 0))
  for (let f = 1; f <= 12; f++) {
    lic.add(mesh(new BoxGeo(10.6, 0.35, 6.45), mat('#F8FAFC'), 0, f * 2.55, 0, false))
  }
  const licSign = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 1.4),
    new THREE.MeshBasicMaterial({ map: signTexture('LIC · CHENNAI', '', { bg: '#0B3C5D', fg: '#FACC15', w: 512, h: 120 }), toneMapped: false })
  )
  licSign.position.set(0, 35.0, 0)
  licSign.rotation.y = Math.PI
  lic.add(licSign)
  world.add(lic)

  /* ---- MTC Bus Shelter & Nam Payanam 149 Poster right outside MGR Central ---- */
  const posterTex = buildPosterTexture()
  const shelterPos = v3(4.5, SIDEWALK_Y, 3.85)
  const shelter = buildBusShelter(posterTex)
  shelter.position.copy(shelterPos)
  world.add(shelter)

  /* ---- Central Metro Station Portal + Elevated CMRL Green Line Viaduct ---- */
  const metroPortal = new THREE.Group()
  metroPortal.position.set(-15.5, SIDEWALK_Y, 2.4)
  metroPortal.add(mesh(new RoundedBoxGeometry(6.2, 3.4, 3.8, 3, 0.14), mat('#0284C7', { rough: 0.35, metal: 0.25 }), 0, 1.7, 0))
  metroPortal.add(mesh(new BoxGeo(5.4, 2.5, 3.85), mat('#0F172A', { rough: 0.2, metal: 0.6 }), 0, 1.35, 0))
  const metroSign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.8, 0.72),
    new THREE.MeshBasicMaterial({
      map: signTexture('சென்ட்ரல் மெட்ரோ · CENTRAL METRO', 'CMRL GREEN LINE → KOYAMBEDU (CMBT)', {
        bg: '#0369A1',
        fg: '#FFFFFF',
        sub: '#86EFAC',
        w: 1024,
        h: 150,
      }),
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
  )
  metroSign.position.set(0, 3.05, 1.94)
  metroPortal.add(metroSign)
  world.add(metroPortal)

  // Elevated CMRL Metro Viaduct along z = 25.5
  const viaductY = 7.8
  world.add(mesh(new BoxGeo(520, 0.85, 4.2), mat('#CBD5E1', { rough: 0.75 }), -80, viaductY, 25.5))
  world.add(mesh(new BoxGeo(520, 0.55, 0.22), mat('#0284C7'), -80, viaductY + 0.62, 23.45))
  world.add(mesh(new BoxGeo(520, 0.55, 0.22), mat('#0284C7'), -80, viaductY + 0.62, 27.55))
  for (let px = -320; px <= 160; px += 22) {
    world.add(mesh(new THREE.CylinderGeometry(0.65, 0.75, viaductY - 0.3, 12), mat('#94A3B8', { rough: 0.8 }), px, (viaductY - 0.3) / 2, 25.5))
    world.add(mesh(new BoxGeo(2.2, 0.65, 4.0), mat('#94A3B8'), px, viaductY - 0.5, 25.5))
  }

  const metroTrain = buildMetroTrain()
  metroTrain.position.set(40, viaductY + 0.42, 25.5)
  world.add(metroTrain)

  /* ---- Westward Corridor Hubs: Koyambedu (CMBT), Poonamallee, Sriperumbudur ---- */
  const makeHub = (x: number, z: number, titleTa: string, titleEn: string, accent: string) => {
    const g = new THREE.Group()
    g.position.set(x, SIDEWALK_Y, z)
    g.add(mesh(new RoundedBoxGeometry(16, 5.6, 8, 3, 0.2), mat('#F8FAFC', { rough: 0.6 }), 0, 2.8, -5))
    g.add(mesh(new BoxGeo(16.4, 0.85, 8.4), mat(accent), 0, 5.4, -5))
    const sp = labelSprite(titleTa, titleEn, { accent, scale: 9.5 })
    sp.position.set(0, 10.2, -3)
    g.add(sp)
    world.add(g)
    return v3(x, SIDEWALK_Y, z)
  }

  const koyambeduPos = makeHub(-85, 2.0, 'கோயம்பேடு · Koyambedu (CMBT)', 'CMRL Green Line ↔ MTC 578', '#16A34A')
  const poonamalleePos = makeHub(-148, 2.0, 'பூந்தமல்லி · Poonamallee', 'MTC 53 Terminus → Board MTC 578', '#0284C7')
  const sriperumbudurPos = makeHub(-220, 2.0, 'ஸ்ரீபெரும்புதூர் · Sriperumbudur', 'Destination · NH-48 Bus Terminus', '#D97706')

  // Sriperumbudur SIPCOT / Rajiv Gandhi Memorial Archway landmark
  const archG = new THREE.Group()
  archG.position.set(-220, 0, 14.5)
  for (const az of [6.5, 22.5]) {
    archG.add(mesh(new BoxGeo(1.6, 10.5, 1.6), mat('#F59E0B'), 0, 5.25, az - 14.5))
  }
  archG.add(mesh(new BoxGeo(1.8, 1.8, 18.0), mat('#0B3C5D'), 0, 10.8, 0))
  world.add(archG)

  /* ---- Telecom Tower & Nam Payanam Admin Operations HQ ---- */
  const towerPos = v3(-26, SIDEWALK_Y, -9)
  const towerG = new THREE.Group()
  towerG.position.copy(towerPos)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    towerG.add(mesh(new THREE.CylinderGeometry(0.12, 0.26, 22, 6), mat('#CBD5E1', { metal: 0.7 }), Math.cos(a) * 1.4, 11, Math.sin(a) * 1.4))
  }
  for (let k = 1; k <= 7; k++) {
    const ring = mesh(new THREE.TorusGeometry(1.45 - k * 0.08, 0.08, 4, 4), mat(k % 2 === 0 ? '#EF4444' : '#FFFFFF'), 0, k * 2.8, 0, false)
    ring.rotation.x = Math.PI / 2
    ring.rotation.z = Math.PI / 4
    towerG.add(ring)
  }
  towerG.add(mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshBasicMaterial({ color: '#EF4444' }), 0, 22.4, 0, false))
  world.add(towerG)

  const adminPos = v3(36, SIDEWALK_Y, -9)
  const adminG = new THREE.Group()
  adminG.position.copy(adminPos)
  adminG.add(mesh(new RoundedBoxGeometry(13, 10.5, 8.5, 3, 0.25), mat('#0F172A', { rough: 0.3, metal: 0.5 }), 0, 5.25, 0))
  adminG.add(mesh(new BoxGeo(13.3, 0.65, 8.8), mat('#F59E0B'), 0, 10.6, 0))
  const adminLbl = labelSprite('நம் பயணம் · Admin Center', 'Stored Queries & Call Summaries', { accent: '#0B3C5D', scale: 7.4 })
  adminLbl.position.set(0, 13.8, 0)
  adminG.add(adminLbl)
  world.add(adminG)

  /* ---- Urban Chennai Commercial Backdrop Buildings & Tropical Trees ---- */
  const shopColors = ['#FEF3C7', '#E0F2FE', '#FCE7F3', '#ECFDF5', '#F3F4F6', '#FFEDD5']
  for (let i = 0; i < 24; i++) {
    const bx = -195 + i * 13.5 + (r() - 0.5) * 2
    if (Math.abs(bx - 28) < 11 || Math.abs(bx - 34) < 8) continue
    const bh = 6.5 + Math.floor(r() * 4) * 2.8
    const bw = 9.0 + r() * 2.5
    const bldg = mesh(new BoxGeo(bw, bh, 8.5), mat(shopColors[i % shopColors.length], { rough: 0.8 }), bx, SIDEWALK_Y + bh / 2, 37.5)
    world.add(bldg)
    // Colorful Chennai shopfront signboard
    world.add(mesh(new BoxGeo(bw - 0.6, 0.95, 0.25), mat(['#0B3C5D', '#B91C1C', '#15803D', '#B45309'][i % 4]), bx, SIDEWALK_Y + 3.1, 33.15))
  }

  // Coconut palms & Gulmohar / Neem avenue trees
  for (let x = -210; x <= 120; x += 18) {
    if (Math.abs(x) < 28 && x > -20) continue
    const palm = buildCoconutPalm(r)
    palm.position.set(x + r() * 3, SIDEWALK_Y, -3.5 - r() * 4)
    world.add(palm)
    const ave = buildAvenueTree(x % 36 === 0 ? '#EF4444' : undefined)
    ave.position.set(x + 6, SIDEWALK_Y, 33.2)
    world.add(ave)
  }
  // Framing palms near Central Square
  for (const [px, pz] of [
    [-25, -4],
    [24, -4],
    [-34, 2],
    [32, 2],
  ] as const) {
    const p = buildCoconutPalm(r)
    p.position.set(px, SIDEWALK_Y, pz)
    world.add(p)
  }

  /* ---- Animated Chennai Traffic (Keep-Left Indian Road Rules!) ---- */
  // Hero MTC 53 Bus that pulls into MGR Central Bus Bay for Murugan to board!
  const heroBus53 = buildMtcBus('53', 'பூந்தமல்லி', 'POONAMALLEE', '#1D63B8')
  world.add(heroBus53)

  // Flowing traffic vehicles
  interface Vehicle {
    obj: THREE.Group
    dir: 1 | -1 // +1 Eastbound (z ~ 9.2..11.8), -1 Westbound toward Sriperumbudur (z ~ 17.2..20.2)
    z: number
    speed: number
    offset: number
  }
  const vehicles: Vehicle[] = []
  const addVeh = (obj: THREE.Group, dir: 1 | -1, z: number, speed: number, offset: number) => {
    obj.rotation.y = dir === 1 ? 0 : Math.PI
    world.add(obj)
    vehicles.push({ obj, dir, z, speed, offset })
  }

  addVeh(buildMtcBus('578', 'ஸ்ரீபெரும்புதூர்', 'SRIPERUMBUDUR', '#0F4C81'), -1, 20.1, 11.5, 20)
  addVeh(buildMtcBus('29C', 'பெரம்பூர்', 'PERAMBUR', '#1D63B8'), 1, 12.6, 10.2, 80)
  addVeh(buildMtcBus('101', 'திருவொற்றியூர்', 'THIRUVOTRIYUR', '#15803D'), 1, 11.2, 9.4, 240)
  addVeh(buildMtcBus('53', 'பூந்தமல்லி', 'POONAMALLEE', '#1D63B8'), -1, 17.2, 12.2, 190)

  for (let i = 0; i < 8; i++) {
    const dir: 1 | -1 = i % 2 === 0 ? -1 : 1
    const z = dir === -1 ? (i % 4 === 0 ? 20.2 : 17.3) : (i % 4 === 1 ? 11.1 : 12.7)
    addVeh(buildAutoRickshaw(), dir, z, 8.5 + (i % 3) * 1.4, i * 48)
  }
  const carPalette = ['#F8FAFC', '#DC2626', '#2563EB', '#475569', '#D97706', '#0D9488']
  for (let i = 0; i < 8; i++) {
    const dir: 1 | -1 = i % 2 === 0 ? 1 : -1
    const z = dir === 1 ? 12.6 : 17.2
    addVeh(buildCar(carPalette[i % carPalette.length]), dir, z, 12.5 + (i % 3) * 1.6, i * 52 + 24)
  }

  /* ---- Glowing 3D Route Ribbon (Central -> Poonamallee / Koyambedu -> Sriperumbudur) ---- */
  const routeGroup = new THREE.Group()
  world.add(routeGroup)

  const busCurve = new THREE.CatmullRomCurve3([
    v3(4.5, 1.2, 6.2),
    v3(-35, 2.2, 18.5),
    v3(-85, 2.6, 18.5),
    v3(-148, 2.6, 16.5),
    v3(-220, 2.6, 16.5),
  ])
  const busTubeGeo = new THREE.TubeGeometry(busCurve, 120, 0.42, 8, false)
  const busTube = new THREE.Mesh(
    busTubeGeo,
    new THREE.MeshBasicMaterial({ color: '#F59E0B', transparent: true, opacity: 0.88 })
  )
  routeGroup.add(busTube)

  const metroCurve = new THREE.CatmullRomCurve3([
    v3(-15.5, 3.2, 4.0),
    v3(-25, 8.8, 25.5),
    v3(-85, 8.8, 25.5),
    v3(-92, 3.0, 18.5),
  ])
  const metroTubeGeo = new THREE.TubeGeometry(metroCurve, 80, 0.38, 8, false)
  const metroTube = new THREE.Mesh(
    metroTubeGeo,
    new THREE.MeshBasicMaterial({ color: '#22C55E', transparent: true, opacity: 0.88 })
  )
  routeGroup.add(metroTube)

  // Soft puffy coastal clouds
  const clouds: THREE.Group[] = []
  const cloudM = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 1,
    emissive: '#F0F9FF',
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.9,
  })
  for (let i = 0; i < 16; i++) {
    const cg = new THREE.Group()
    for (let k = 0; k < 4; k++) {
      cg.add(mesh(new THREE.IcosahedronGeometry(4 + r() * 3.5, 1), cloudM, k * 4.5 - 6, r() * 2, r() * 2, false))
    }
    cg.position.set(-280 + i * 36, 48 + r() * 12, -90 + (r() - 0.5) * 160)
    world.add(cg)
    clouds.push(cg)
  }

  const flag = central.userData.flag as THREE.Group
  const doorL = heroBus53.userData.doorL as THREE.Mesh
  const doorR = heroBus53.userData.doorR as THREE.Mesh

  return {
    centralPos: v3(0, SIDEWALK_Y, -22),
    shelterPos,
    posterPos: v3(shelterPos.x + 1.65, SIDEWALK_Y + 1.35, shelterPos.z - 0.05),
    metroPortalPos: v3(-15.5, SIDEWALK_Y, 2.4),
    koyambeduPos,
    poonamalleePos,
    sriperumbudurPos,
    towerTop: towerPos.clone().setY(towerPos.y + 22.4),
    adminPos,
    heroBus53,
    update(nowS: number, filmT: number) {
      flag.rotation.y = Math.sin(nowS * 3.2) * 0.18

      // Hide clouds during high-altitude Architecture diorama so zero clouds clip 3D nodes!
      const showClouds = !(filmT >= T.arch - 2.0 && filmT <= T.impact + 0.2)
      for (const c of clouds) {
        c.visible = showClouds
        c.position.x += 0.018
        if (c.position.x > 340) c.position.x = -340
      }

      const metroSpan = 340
      metroTrain.position.x = 110 - ((nowS * 16) % metroSpan)

      const span = 420
      for (const v of vehicles) {
        const travel = (nowS * v.speed + v.offset) % span
        v.obj.position.set(v.dir === 1 ? -260 + travel : 160 - travel, 0.02, v.z)
      }

      // Hero MTC 53 Bus pulls cleanly into dedicated curbside bay (z = 7.8), opens doors, and departs!
      if (filmT < 103.5) {
        heroBus53.position.set(-95, 0.02, 7.8)
        heroBus53.rotation.y = 0
        doorL.position.x = 1.36
        doorR.position.x = 1.94
      } else {
        const arriveK = easeOut(seg(filmT, 103.5, 110.2))
        const departK = easeInOut(seg(filmT, 115.2, 121.0))
        heroBus53.position.set(lerp(-65, 3.2, arriveK) + departK * 65, 0.02, 7.8)
        heroBus53.rotation.y = 0
        const doorOpen = smooth(seg(filmT, 110.2, 110.9)) * (1 - smooth(seg(filmT, 114.6, 115.1)))
        doorL.position.x = 1.36 - doorOpen * 0.48
        doorR.position.x = 1.94 + doorOpen * 0.48
      }

      // Glowing 3D Route Ribbon synced to casual Tamil route & Metro explanation
      const showRoute = filmT >= 50.0 && filmT <= 92.0
      routeGroup.visible = showRoute
      if (showRoute) {
        const busK = smooth(seg(filmT, 50.8, 62.5))
        const fadeOut = 1 - smooth(seg(filmT, 89.0, 92.0))
        busTubeGeo.setDrawRange(0, Math.floor((busTubeGeo.index!.count / 3) * busK) * 3)
        ;(busTube.material as THREE.MeshBasicMaterial).opacity = 0.88 * fadeOut

        const metK = smooth(seg(filmT, 71.0, 81.5))
        metroTubeGeo.setDrawRange(0, Math.floor((metroTubeGeo.index!.count / 3) * metK) * 3)
        ;(metroTube.material as THREE.MeshBasicMaterial).opacity = 0.88 * fadeOut
      }
    },
  }
}
