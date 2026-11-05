import * as THREE from 'three'

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (x: number) => {
  x = clamp(x)
  return x * x * (3 - 2 * x)
}
export const easeInOut = (x: number) => {
  x = clamp(x)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
export const easeOutBack = (x: number) => {
  x = clamp(x)
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

/** 0..1 progress of t inside [a, b] */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a))

/** Smooth fade-in / hold / fade-out window */
export const win = (t: number, a: number, b: number, f = 0.5) =>
  Math.min(smooth((t - a) / f), smooth((b - t) / f))

export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

/** Deterministic seeded PRNG */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const matCache = new Map<string, THREE.MeshStandardMaterial>()
export function mat(
  color: THREE.ColorRepresentation,
  opts: {
    rough?: number
    metal?: number
    emissive?: THREE.ColorRepresentation
    ei?: number
    flat?: boolean
    polyOffset?: number
  } = {}
) {
  const key = `${new THREE.Color(color).getHexString()}|${opts.rough ?? 0.78}|${opts.metal ?? 0.04}|${opts.emissive ?? ''}|${opts.ei ?? 0}|${opts.flat ?? false}|${opts.polyOffset ?? 0}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.78,
      metalness: opts.metal ?? 0.04,
      flatShading: opts.flat ?? false,
      polygonOffset: (opts.polyOffset ?? 0) !== 0,
      polygonOffsetFactor: opts.polyOffset ?? 0,
      polygonOffsetUnits: opts.polyOffset ?? 0,
    })
    if (opts.emissive) {
      m.emissive = new THREE.Color(opts.emissive)
      m.emissiveIntensity = opts.ei ?? 1
    }
    matCache.set(key, m)
  }
  return m
}

export function mesh(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  shadow = true
) {
  const m = new THREE.Mesh(geo, material)
  m.position.set(x, y, z)
  m.castShadow = shadow
  m.receiveShadow = true
  return m
}

/** Catmull-Rom interpolation of keyframed vectors. keys: [t, x, y, z] */
export function splineAt(keys: number[][], t: number, out = new THREE.Vector3()) {
  if (t <= keys[0][0]) return out.set(keys[0][1], keys[0][2], keys[0][3])
  const n = keys.length
  if (t >= keys[n - 1][0]) return out.set(keys[n - 1][1], keys[n - 1][2], keys[n - 1][3])
  let i = 0
  while (i < n - 2 && t > keys[i + 1][0]) i++
  const p0 = keys[Math.max(0, i - 1)]
  const p1 = keys[i]
  const p2 = keys[i + 1]
  const p3 = keys[Math.min(n - 1, i + 2)]
  const raw = (t - p1[0]) / (p2[0] - p1[0])
  const u = easeInOut(raw) * 0.35 + raw * 0.65
  const cr = (a: number, b: number, c: number, d: number) => {
    const u2 = u * u
    const u3 = u2 * u
    return (
      0.5 *
      (2 * b +
        (-a + c) * u +
        (2 * a - 5 * b + 4 * c - d) * u2 +
        (-a + 3 * b - 3 * c + d) * u3)
    )
  }
  return out.set(
    cr(p0[1], p1[1], p2[1], p3[1]),
    cr(p0[2], p1[2], p2[2], p3[2]),
    cr(p0[3], p1[3], p2[3], p3[3])
  )
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export const FONT = `"Noto Sans Tamil", "Nirmala UI", "Latha", "Tamil Sangam MN", Inter, "Segoe UI", Roboto, system-ui, -apple-system, sans-serif`

/** Crisp floating 3D sprite label for landmarks & architecture nodes */
export function labelSprite(
  title: string,
  sub?: string,
  opts: { color?: string; bg?: string; accent?: string; scale?: number } = {}
) {
  const c = document.createElement('canvas')
  const W = 1080
  const H = sub ? 310 : 196
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = opts.bg ?? 'rgba(255,255,255,0.95)'
  roundRect(ctx, 10, 10, W - 20, H - 20, 58)
  ctx.fill()
  ctx.strokeStyle = 'rgba(11,60,93,0.14)'
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.fillStyle = opts.accent ?? '#0B3C5D'
  roundRect(ctx, 42, H / 2 - 54, 18, 108, 9)
  ctx.fill()
  ctx.fillStyle = opts.color ?? '#0B253A'
  ctx.textBaseline = 'middle'
  ctx.font = `800 70px ${FONT}`
  ctx.fillText(title, 92, sub ? 108 : H / 2 + 2, W - 132)
  if (sub) {
    ctx.font = `600 48px ${FONT}`
    ctx.fillStyle = '#476278'
    ctx.fillText(sub, 92, 206, W - 132)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    })
  )
  const s = opts.scale ?? 4.5
  sp.scale.set(s, (s * H) / W, 1)
  return sp
}
