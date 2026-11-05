import * as THREE from 'three'
import { T } from './timeline'
import { easeOut, labelSprite, seg, smooth, v3 } from './util'

// Open road/plaza coordinates across Chennai (never piercing landmark buildings!)
const CHENNAI_HUBS: [string, number, number, string][] = [
  ['MGR Central', 4, 7, '#F59E0B'],
  ['Egmore', -38, 14, '#0284C7'],
  ['Koyambedu CMBT', -85, 14, '#16A34A'],
  ['Anna Nagar', -72, -36, '#0284C7'],
  ['T. Nagar', -26, 56, '#D97706'],
  ['Guindy', -64, 80, '#16A34A'],
  ['Adyar', 18, 86, '#0284C7'],
  ['Marina Beach', 68, 46, '#D97706'],
  ['Porur', -112, 44, '#16A34A'],
  ['Tambaram', -96, 114, '#D97706'],
  ['Poonamallee', -148, 14, '#0284C7'],
  ['Sriperumbudur', -220, 14, '#F59E0B'],
]

export function buildImpact(scene: THREE.Scene) {
  const root = new THREE.Group()
  scene.add(root)

  const origin = v3(4, 2.5, 7)
  const beaconGeo = new THREE.CylinderGeometry(1.1, 1.1, 1, 16, 1, true)
  beaconGeo.translate(0, 0.5, 0)
  const ringGeo = new THREE.RingGeometry(1.8, 2.9, 32)
  ringGeo.rotateX(-Math.PI / 2)

  // Use NormalBlending (not AdditiveBlending!) so daytime sky & ground never wash out to white!
  const items = CHENNAI_HUBS.map(([name, x, z, col], i) => {
    const pos = v3(x, 0.25, z)
    const beacon = new THREE.Mesh(
      beaconGeo,
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
    beacon.position.copy(pos)
    root.add(beacon)

    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    )
    ring.position.set(x, 0.35, z)
    root.add(ring)

    const lbl = labelSprite(name, undefined, { accent: col, scale: 7.2 })
    lbl.position.set(x, 20, z)
    lbl.material.opacity = 0
    root.add(lbl)

    let arc: THREE.Mesh | null = null
    let count = 0
    if (i > 0) {
      const mid = origin.clone().lerp(pos, 0.5)
      mid.y += 22 + origin.distanceTo(pos) * 0.15
      const curve = new THREE.QuadraticBezierCurve3(origin, mid, pos.clone().setY(2.5))
      const tg = new THREE.TubeGeometry(curve, 52, 0.45, 8)
      arc = new THREE.Mesh(
        tg,
        new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.9,
        })
      )
      tg.setDrawRange(0, 0)
      root.add(arc)
      count = tg.index!.count
    }

    return { beacon, ring, lbl, arc, count, at: i * 0.18 }
  })

  root.visible = false

  return {
    update(t: number) {
      const tt = t - T.impact
      root.visible = t >= T.impact - 0.4 && t <= T.end + 1.8
      if (!root.visible) return
      const fadeOut = 1 - smooth(seg(t, T.end - 0.2, T.end + 1.6))

      items.forEach(it => {
        const k = easeOut(seg(tt, it.at, it.at + 0.7))
        it.beacon.scale.set(1, 3 + 15 * k, 1)
        ;(it.beacon.material as THREE.MeshBasicMaterial).opacity = 0.38 * k * fadeOut
        const rk = (t * 0.7 + it.at) % 1
        it.ring.scale.setScalar(0.8 + rk * 2.0)
        ;(it.ring.material as THREE.MeshBasicMaterial).opacity = (1 - rk) * 0.7 * k * fadeOut
        it.lbl.material.opacity = k * fadeOut
        if (it.arc) {
          const ak = smooth(seg(tt, it.at + 0.15, it.at + 1.1))
          it.arc.geometry.setDrawRange(0, Math.floor((it.count / 3) * ak) * 3)
          ;(it.arc.material as THREE.MeshBasicMaterial).opacity = 0.9 * fadeOut
        }
      })
    },
  }
}
