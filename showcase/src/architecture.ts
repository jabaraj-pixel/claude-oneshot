import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { T } from './timeline'
import { paintDashboardStill } from './dashboard'
import { FONT, easeOutBack, labelSprite, mat, mesh, roundRect, seg, smooth, v3 } from './util'

export const ARCH_Y = 110
export const ARCH_T0 = T.arch

function slabTexture(title: string, sub: string, col: string) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 168
  const ctx = c.getContext('2d')!
  ctx.fillStyle = col
  ctx.fillRect(0, 0, 1024, 168)
  ctx.fillStyle = 'rgba(255,255,255,0.94)'
  roundRect(ctx, 28, 32, 104, 104, 26)
  ctx.fill()
  ctx.fillStyle = col
  ctx.beginPath()
  ctx.arc(80, 84, 22, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.textBaseline = 'middle'
  ctx.font = `800 54px ${FONT}`
  ctx.fillText(title, 162, 62, 830)
  ctx.font = `600 36px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.fillText(sub, 162, 118, 830)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.generateMipmaps = false
  t.minFilter = THREE.LinearFilter
  return t
}

interface ArchNode {
  obj: THREE.Object3D
  label?: THREE.Sprite
  at: number
  base: number
}

interface ArchLink {
  tube: THREE.Mesh
  curve: THREE.Curve<THREE.Vector3>
  at: number
  dots: THREE.Mesh[]
  count: number
}

export function buildArchitecture(scene: THREE.Scene, buildPhone: (real?: boolean) => THREE.Group) {
  const root = new THREE.Group()
  root.position.y = ARCH_Y
  scene.add(root)

  // Clean architectural studio platform
  const plat = new THREE.Mesh(
    new THREE.CylinderGeometry(35, 35, 0.5, 6),
    new THREE.MeshStandardMaterial({
      color: '#F0F9FF',
      roughness: 0.45,
      metalness: 0.05,
    })
  )
  plat.position.y = -0.35
  root.add(plat)

  const edge = new THREE.Mesh(
    new THREE.TorusGeometry(35, 0.22, 6, 6),
    new THREE.MeshBasicMaterial({ color: '#0284C7' })
  )
  edge.rotation.x = Math.PI / 2
  edge.rotation.z = Math.PI / 6
  edge.position.y = -0.1
  root.add(edge)

  const grid = new THREE.GridHelper(60, 30, '#0B3C5D', '#93C5FD')
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity = 0.28
  grid.position.y = -0.06
  root.add(grid)

  const nodes: ArchNode[] = []
  const addNode = (obj: THREE.Object3D, at: number, label?: THREE.Sprite, labelY = 8.8) => {
    root.add(obj)
    if (label) {
      label.position.set(obj.position.x, labelY, obj.position.z)
      root.add(label)
    }
    nodes.push({ obj, label, at, base: obj.scale.x || 1 })
  }

  // 1. Caller Phone (Dial 149 Only — No App)
  const phone = buildPhone(false)
  phone.scale.setScalar(2.4)
  phone.position.set(-24, 3.0, 0.5)
  phone.rotation.y = 0.25
  addNode(
    phone,
    0.3,
    labelSprite('1 · Dial 149 Only', 'Regular phone call · No app', { accent: '#0B3C5D', scale: 5.0 }),
    7.4
  )

  // 2. Exotel SIP / PSTN Tower (2-Ring Auto Pickup)
  const sip = new THREE.Group()
  sip.position.set(-12.5, 0, 0)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    sip.add(mesh(new THREE.CylinderGeometry(0.09, 0.14, 7.0, 6), mat('#64748B', { metal: 0.6 }), Math.cos(a) * 0.65, 3.5, Math.sin(a) * 0.65))
  }
  for (let k = 1; k <= 5; k++) {
    const r = mesh(new THREE.TorusGeometry(0.62, 0.06, 4, 4), mat(k % 2 ? '#F59E0B' : '#FFFFFF'), 0, k * 1.2, 0, false)
    r.rotation.x = Math.PI / 2
    sip.add(r)
  }
  sip.add(mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: '#F59E0B' }), 0, 7.2, 0, false))
  addNode(
    sip,
    1.2,
    labelSprite('2 · Telephony SIP', '2-ring pickup · Audio stream', { accent: '#F59E0B', scale: 5.0 }),
    9.4
  )

  // 3. FastAPI + Kural Voice AI + Deterministic GTFS Exploded Stack
  const layers: [string, string, string][] = [
    ['Casual Tamil STT', 'Chennai spoken Tamil · Sarvam AI', '#0B3C5D'],
    ['Kural Dialogue Core', 'FastAPI · Slot & Consent Engine', '#1D63B8'],
    ['Deterministic GTFS', 'CUMTA · MTC 53/578 · CMRL Metro', '#16A34A'],
    ['Youthful Tamil TTS', 'Zero-lag natural Kural voice', '#D97706'],
  ]
  const slabs: THREE.Group[] = []
  layers.forEach(([title, sub, col], i) => {
    const g = new THREE.Group()
    const box = new THREE.Mesh(
      new RoundedBoxGeometry(8.6, 1.05, 4.2, 3, 0.24),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.12 })
    )
    box.castShadow = true
    g.add(box)
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(8.1, 1.32),
      new THREE.MeshBasicMaterial({
        map: slabTexture(title, sub, col),
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      })
    )
    face.scale.y = 0.76
    face.position.z = 2.12
    g.add(face)
    g.position.set(0, 6.2 - i * 1.6, 0)
    g.userData.y = g.position.y
    addNode(g, 2.2 + i * 0.35)
    slabs.push(g)
  })
  const stackLbl = labelSprite('3 · Nam Payanam AI', 'FastAPI · Kural · Static GTFS', { accent: '#1D63B8', scale: 5.2 })
  stackLbl.position.set(0, 9.2, 0)
  root.add(stackLbl)
  nodes.push({ obj: new THREE.Object3D(), label: stackLbl, at: 2.2, base: 1 })

  // 4. WhatsApp Journey Card + SMS Gateway Node
  const msgG = new THREE.Group()
  msgG.position.set(12.5, 3.2, 0.3)
  msgG.add(mesh(new RoundedBoxGeometry(3.6, 2.4, 1.3, 3, 0.26), mat('#16A34A', { rough: 0.4 }), -0.5, 0.5, 0))
  msgG.add(mesh(new RoundedBoxGeometry(3.2, 2.0, 1.1, 3, 0.24), mat('#2563EB', { rough: 0.4 }), 0.8, -0.6, 0.4))
  addNode(
    msgG,
    4.4,
    labelSprite('4 · WhatsApp + SMS', 'Post-call Journey Card & text', { accent: '#16A34A', scale: 5.0 }),
    7.8
  )

  // 5. Admin Operations Console + Call Record Store
  const adm = new THREE.Group()
  adm.position.set(24.0, 0, 0.6)
  adm.add(mesh(new RoundedBoxGeometry(5.2, 2.8, 3.2, 3, 0.2), mat('#0F172A', { rough: 0.35, metal: 0.4 }), 0, 1.4, 0))
  const mon = mesh(new RoundedBoxGeometry(4.0, 2.5, 0.2, 2, 0.1), mat('#1E293B'), 0, 4.6, 0.35)
  adm.add(mon)
  const dashC = document.createElement('canvas')
  dashC.width = 768
  dashC.height = 480
  const dt = new THREE.CanvasTexture(dashC)
  dt.colorSpace = THREE.SRGBColorSpace
  dt.generateMipmaps = false
  dt.minFilter = THREE.LinearFilter
  paintDashboardStill(dashC, () => {
    dt.needsUpdate = true
  })
  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(3.76, 2.32),
    new THREE.MeshBasicMaterial({
      map: dt,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
  )
  scr.position.set(0, 4.6, 0.47)
  adm.add(scr)
  addNode(
    adm,
    5.6,
    labelSprite('5 · Admin Summary', 'Stored call audio & AI summary', { accent: '#7C3AED', scale: 5.0 }),
    8.6
  )

  // Clean Overhead Data Arcs (ALL above y > 1.5 — zero floor clipping!)
  const links: ArchLink[] = []
  const addLink = (a: THREE.Vector3, b: THREE.Vector3, at: number, color: string, h = 2.6) => {
    const mid = a.clone().lerp(b, 0.5)
    mid.y += h
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
    const geo = new THREE.TubeGeometry(curve, 56, 0.095, 8)
    const tube = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }))
    tube.geometry.setDrawRange(0, 0)
    root.add(tube)
    const dots: THREE.Mesh[] = []
    for (let i = 0; i < 5; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshBasicMaterial({ color: '#FFFFFF' }))
      d.visible = false
      root.add(d)
      dots.push(d)
    }
    links.push({ tube, curve, at, dots, count: geo.index!.count })
  }

  addLink(v3(-22.5, 3.6, 0.5), v3(-13.2, 6.0, 0), 0.9, '#F59E0B', 2.4)
  addLink(v3(-11.8, 6.0, 0), v3(-4.4, 5.2, 0), 1.8, '#0284C7', 2.2)
  addLink(v3(4.4, 4.2, 0), v3(10.8, 3.6, 0.3), 4.0, '#16A34A', 2.4)
  addLink(v3(10.8, 4.6, 0.3), v3(-22.5, 4.8, 0.5), 4.9, '#22C55E', 6.8) // high overhead return arc to Caller Phone!
  addLink(v3(4.4, 5.2, 0), v3(21.8, 4.5, 0.6), 5.3, '#7C3AED', 3.6)

  root.visible = false

  return {
    root,
    update(t: number) {
      const tt = t - ARCH_T0
      root.visible = t > ARCH_T0 - 1.8 && t < T.impact - 0.1
      if (!root.visible) return

      const pf = smooth(seg(tt, -1.0, 0.8))
      edge.scale.setScalar(0.75 + 0.25 * pf)

      for (const n of nodes) {
        const k = easeOutBack(seg(tt, n.at, n.at + 0.75))
        n.obj.scale.setScalar(Math.max(0.0001, n.base * k))
        if (n.label) n.label.material.opacity = smooth(seg(tt, n.at + 0.15, n.at + 0.65))
      }

      slabs.forEach((s, i) => {
        s.position.y = s.userData.y + Math.sin(t * 1.6 + i * 0.8) * 0.06
      })

      for (const lk of links) {
        const k = smooth(seg(tt, lk.at, lk.at + 0.8))
        lk.tube.geometry.setDrawRange(0, Math.floor((lk.count / 3) * k) * 3)
        lk.dots.forEach((d, idx) => {
          d.visible = k > 0.95
          if (d.visible) {
            const u = (t * 0.42 + idx / lk.dots.length) % 1
            lk.curve.getPoint(u, d.position)
          }
        })
      }
    },
  }
}
