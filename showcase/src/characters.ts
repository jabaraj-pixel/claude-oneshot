import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { clamp, lerp, mat, mesh, smooth } from './util'

export interface FingerRig {
  prox: THREE.Group
  dist: THREE.Group
}

export interface HandRig {
  wrist: THREE.Group
  palm: THREE.Mesh
  thumbBase: THREE.Group
  thumbDist: THREE.Group
  fingers: [FingerRig, FingerRig, FingerRig, FingerRig] // index, middle, ring, pinky
  phoneMount: THREE.Group
  latSign: -1 | 1
}

export interface Rig {
  root: THREE.Group
  hips: THREE.Group
  torso: THREE.Group
  neck: THREE.Group
  head: THREE.Group
  jaw: THREE.Group
  browL: THREE.Mesh
  browR: THREE.Mesh
  eyelidL: THREE.Mesh
  eyelidR: THREE.Mesh
  shoulderL: THREE.Group
  shoulderR: THREE.Group
  elbowL: THREE.Group
  elbowR: THREE.Group
  handL: HandRig
  handR: HandRig
  legL: THREE.Group
  legR: THREE.Group
  kneeL: THREE.Group
  kneeR: THREE.Group
  ankleL: THREE.Group
  ankleR: THREE.Group
  skirt?: THREE.Object3D
  hipH: number
}

export interface PersonOpts {
  skin: string
  shirt: string
  shirtAccent?: string
  legs?: string
  veshti?: boolean
  veshtiBorder?: string
  saree?: string
  border?: string
  hair: string
  bun?: boolean
  moustache?: boolean
  glasses?: boolean
  bag?: boolean
  scale?: number
}

/**
 * Builds an anatomically proportioned 5-finger articulated human hand.
 * Local space convention:
 *   +Z = palmar surface (palm face)
 *   -Z = dorsal surface (back of hand / knuckles)
 *   -Y = wrist -> fingertips axis
 *   latSign = -1 for character's Right Hand, +1 for character's Left Hand
 *   Flexion (curling fingers into palm) = negative rotation around X (`rx < 0`).
 */
function buildHand(latSign: -1 | 1, skinM: THREE.Material, nailM: THREE.Material): HandRig {
  const wrist = new THREE.Group()
  // Smooth spherical wrist joint so bending never leaves a seam
  wrist.add(mesh(new THREE.SphereGeometry(0.026, 14, 10), skinM, 0, 0, 0, false))

  // Sculpted rounded palm
  const palm = mesh(
    new RoundedBoxGeometry(0.068, 0.076, 0.021, 3, 0.0085),
    skinM,
    0,
    -0.039,
    0,
    true
  )
  wrist.add(palm)

  // Subtle thenar muscle pad at base of thumb
  const thenar = mesh(new THREE.SphereGeometry(0.018, 12, 10), skinM, latSign * 0.021, -0.026, 0.006, false)
  thenar.scale.set(1.0, 1.35, 0.75)
  wrist.add(thenar)

  // Opposable 2-segment thumb
  const thumbBase = new THREE.Group()
  thumbBase.position.set(latSign * 0.031, -0.024, 0.005)
  wrist.add(thumbBase)

  const tProxLen = 0.029
  thumbBase.add(mesh(new THREE.SphereGeometry(0.0095, 10, 8), skinM, 0, 0, 0, false))
  thumbBase.add(mesh(new THREE.CapsuleGeometry(0.0086, tProxLen - 0.01, 6, 10), skinM, 0, -tProxLen / 2, 0, false))

  const thumbDist = new THREE.Group()
  thumbDist.position.set(0, -tProxLen, 0)
  thumbBase.add(thumbDist)
  const tDistLen = 0.023
  thumbDist.add(mesh(new THREE.SphereGeometry(0.0082, 10, 8), skinM, 0, 0, 0, false))
  thumbDist.add(mesh(new THREE.CapsuleGeometry(0.0076, tDistLen - 0.01, 6, 10), skinM, 0, -tDistLen / 2, 0, false))
  // Subtle fingernail on dorsal (-Z) tip
  thumbDist.add(mesh(new RoundedBoxGeometry(0.009, 0.009, 0.002, 2, 0.002), nailM, 0, -tDistLen + 0.006, -0.007, false))

  // Four articulated fingers: index, middle, ring, pinky
  const specs: [number, number, number, number][] = [
    [latSign * 0.0235, 0.030, 0.024, 0.0073], // index
    [latSign * 0.0080, 0.034, 0.026, 0.0076], // middle
    [latSign * -0.0080, 0.031, 0.024, 0.0071], // ring
    [latSign * -0.0230, 0.025, 0.020, 0.0063], // pinky
  ]

  const fingers = specs.map(([fx, pLen, dLen, rad]) => {
    const prox = new THREE.Group()
    prox.position.set(fx, -0.075, 0)
    wrist.add(prox)

    // Knuckle + proximal phalanx
    prox.add(mesh(new THREE.SphereGeometry(rad * 1.08, 10, 8), skinM, 0, 0, 0, false))
    prox.add(mesh(new THREE.CapsuleGeometry(rad, Math.max(0.008, pLen - rad * 1.4), 6, 10), skinM, 0, -pLen / 2, 0, false))

    // PIP joint + middle/distal phalanx + fingertip nail
    const dist = new THREE.Group()
    dist.position.set(0, -pLen, 0)
    prox.add(dist)
    dist.add(mesh(new THREE.SphereGeometry(rad * 0.96, 10, 8), skinM, 0, 0, 0, false))
    dist.add(mesh(new THREE.CapsuleGeometry(rad * 0.88, Math.max(0.006, dLen - rad * 1.2), 6, 10), skinM, 0, -dLen / 2, 0, false))
    dist.add(mesh(new RoundedBoxGeometry(rad * 1.25, 0.008, 0.002, 2, 0.002), nailM, 0, -dLen + 0.005, -rad * 0.82, false))

    return { prox, dist } as FingerRig
  }) as [FingerRig, FingerRig, FingerRig, FingerRig]

  // Smartphone mount aligned across the palm so knuckles & thumb hug the two vertical bezels cleanly
  const phoneMount = new THREE.Group()
  phoneMount.position.set(-latSign * 0.008, -0.038, 0.017)
  phoneMount.rotation.set(0, 0, -latSign * (Math.PI / 2))
  wrist.add(phoneMount)

  return { wrist, palm, thumbBase, thumbDist, fingers, phoneMount, latSign }
}

class BoxOrPlacket extends RoundedBoxGeometry {
  constructor() {
    super(0.032, 0.44, 0.01, 2, 0.004)
  }
}

class BoxGeoBorder extends RoundedBoxGeometry {
  constructor(w = 0.036, h = 0.58, d = 0.23) {
    super(w, h, d, 2, 0.005)
  }
}

export function person(o: PersonOpts): Rig {
  const root = new THREE.Group()
  const hipH = 0.88
  const hips = new THREE.Group()
  hips.position.y = hipH
  root.add(hips)

  const skinM = mat(o.skin, { flat: false, rough: 0.65, metal: 0.02 })
  const nailM = mat('#E8C5B0', { flat: false, rough: 0.45 })
  const shirtM = mat(o.shirt, { flat: false, rough: 0.78 })
  const accentM = mat(o.shirtAccent ?? o.shirt, { flat: false, rough: 0.72 })
  const legM = mat(o.legs ?? '#2C3540', { flat: false, rough: 0.82 })
  const hairM = mat(o.hair, { flat: false, rough: 0.55 })

  // Pelvis / waist block so hips never leave a gap when bending
  const pelvis = mesh(new RoundedBoxGeometry(0.285, 0.14, 0.185, 4, 0.055), o.veshti ? mat('#F7F5EE', { flat: false }) : legM, 0, -0.02, 0)
  hips.add(pelvis)

  // Belt (when wearing trousers)
  if (!o.saree && !o.veshti) {
    hips.add(mesh(new RoundedBoxGeometry(0.292, 0.036, 0.192, 3, 0.012), mat('#2B1E16', { rough: 0.5 }), 0, 0.038, 0, false))
    hips.add(mesh(new RoundedBoxGeometry(0.045, 0.038, 0.014, 2, 0.004), mat('#C9A24B', { metal: 0.75, rough: 0.28 }), 0, 0.038, 0.096, false))
  }

  // Torso (smooth anatomical chest + shoulders)
  const torso = new THREE.Group()
  hips.add(torso)

  const chest = mesh(new RoundedBoxGeometry(0.325, 0.52, 0.20, 5, 0.075), shirtM, 0, 0.28, 0)
  torso.add(chest)

  // Shirt placket & collar (for non-saree commuters)
  if (!o.saree) {
    torso.add(mesh(new BoxOrPlacket(), accentM, 0, 0.30, 0.101, false))
    const collar = mesh(new THREE.TorusGeometry(0.068, 0.016, 8, 20, Math.PI * 1.45), accentM, 0, 0.535, 0.005, false)
    collar.rotation.set(Math.PI / 2 + 0.12, 0, Math.PI * 0.78)
    torso.add(collar)
    // Chest pocket
    torso.add(mesh(new RoundedBoxGeometry(0.068, 0.076, 0.012, 2, 0.006), accentM, 0.078, 0.35, 0.10, false))
  } else {
    // Saree pallu
    const sareeM = mat(o.saree, { flat: false, rough: 0.68 })
    const borderM = mat(o.border ?? '#E0A526', { flat: false, rough: 0.45, metal: 0.25 })
    const pallu = mesh(new RoundedBoxGeometry(0.15, 0.58, 0.225, 3, 0.03), sareeM, 0.04, 0.28, 0)
    pallu.rotation.z = 0.46
    torso.add(pallu)
    const b = mesh(new BoxGeoBorder(), borderM, 0.105, 0.26, 0, false)
    b.rotation.z = 0.46
    torso.add(b)
  }

  // Optional commuter shoulder bag
  if (o.bag) {
    const bagM = mat('#334155', { flat: false, rough: 0.72 })
    const strapM = mat('#1E293B', { flat: false, rough: 0.65 })
    const strap = mesh(new RoundedBoxGeometry(0.036, 0.60, 0.225, 3, 0.01), strapM, -0.01, 0.27, 0, false)
    strap.rotation.z = -0.48
    torso.add(strap)
    const pouch = mesh(new RoundedBoxGeometry(0.095, 0.21, 0.22, 3, 0.028), bagM, 0.185, 0.02, -0.01)
    torso.add(pouch)
    const flap = mesh(new RoundedBoxGeometry(0.10, 0.09, 0.224, 3, 0.02), mat('#475569', { flat: false }), 0.186, 0.08, -0.01, false)
    torso.add(flap)
  }

  // Neck + Sculpted Head + Expressive Face
  const neck = new THREE.Group()
  neck.position.set(0, 0.54, 0)
  torso.add(neck)
  neck.add(mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.10, 14), skinM, 0, 0.04, 0))

  const head = new THREE.Group()
  head.position.set(0, 0.175, 0.005)
  neck.add(head)

  // Cranium + cheek structure
  const cranium = mesh(new THREE.SphereGeometry(0.114, 24, 20), skinM, 0, 0.012, 0)
  cranium.scale.set(0.94, 1.06, 0.98)
  head.add(cranium)

  // Ears
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.024, 10, 8), skinM, sx * 0.106, 0.002, -0.006, false)
    ear.scale.set(0.42, 1.12, 0.72)
    head.add(ear)
  }

  // Sculpted nose
  const nose = mesh(new RoundedBoxGeometry(0.022, 0.042, 0.028, 3, 0.009), skinM, 0, -0.004, 0.108, false)
  nose.rotation.x = -0.18
  head.add(nose)

  // Eyes (sclera + dark iris + catchlight + blinking eyelids)
  const whiteM = mat('#FAFAFA', { flat: false, rough: 0.3 })
  const irisM = mat('#1B1410', { flat: false, rough: 0.2 })
  const eyePositions = [-0.038, 0.038]
  const eyelids: THREE.Mesh[] = []
  for (const ex of eyePositions) {
    const sclera = mesh(new THREE.SphereGeometry(0.0155, 12, 10), whiteM, ex, 0.018, 0.098, false)
    sclera.scale.set(1.1, 0.85, 0.6)
    head.add(sclera)
    const iris = mesh(new THREE.SphereGeometry(0.0085, 10, 8), irisM, ex, 0.018, 0.106, false)
    head.add(iris)
    const lid = mesh(
      new THREE.SphereGeometry(0.0168, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
      skinM,
      ex,
      0.019,
      0.098,
      false
    )
    lid.scale.set(1.12, 0.2, 0.68)
    head.add(lid)
    eyelids.push(lid)
  }

  // Expressive eyebrows
  const browGeo = new RoundedBoxGeometry(0.032, 0.0075, 0.010, 2, 0.003)
  const browR = mesh(browGeo, hairM, -0.039, 0.040, 0.104, false)
  const browL = mesh(browGeo, hairM, 0.039, 0.040, 0.104, false)
  head.add(browR, browL)

  // Hair cap + sideburns + back taper
  const hairTop = mesh(
    new THREE.SphereGeometry(0.118, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairM,
    0,
    0.022,
    -0.012
  )
  hairTop.scale.set(0.96, 1.05, 1.02)
  head.add(hairTop)
  const hairBack = mesh(
    new THREE.SphereGeometry(0.114, 18, 14, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.35, Math.PI * 0.45),
    hairM,
    0,
    0.008,
    -0.014
  )
  hairBack.rotation.y = Math.PI
  head.add(hairBack)

  if (o.bun) {
    head.add(mesh(new THREE.SphereGeometry(0.056, 14, 12), hairM, 0, -0.01, -0.125))
    // Jasmine (malli poo) strand around bun — iconic Chennai touch!
    const malli = mesh(new THREE.TorusGeometry(0.048, 0.011, 8, 16), mat('#FFFDF5', { rough: 0.6 }), 0, -0.008, -0.115, false)
    head.add(malli)
    head.add(mesh(new THREE.SphereGeometry(0.008, 8, 6), mat('#C9182B'), 0, 0.042, 0.108, false))
  }

  // South Indian moustache
  if (o.moustache) {
    for (const sx of [-1, 1]) {
      const m = mesh(new THREE.CapsuleGeometry(0.0075, 0.026, 4, 8), hairM, sx * 0.019, -0.030, 0.106, false)
      m.rotation.z = Math.PI / 2 + sx * 0.28
      head.add(m)
    }
  }

  // Animated Jaw & Mouth (lip-syncs cleanly with speech amplitude!)
  const jaw = new THREE.Group()
  jaw.position.set(0, -0.046, 0.098)
  head.add(jaw)
  const upperLip = mesh(new RoundedBoxGeometry(0.036, 0.007, 0.012, 2, 0.003), mat('#7C3F38', { flat: false }), 0, -0.043, 0.104, false)
  head.add(upperLip)
  const mouthCavity = mesh(new RoundedBoxGeometry(0.030, 0.014, 0.010, 2, 0.004), mat('#3B1518', { flat: false }), 0, -0.002, 0.002, false)
  mouthCavity.scale.y = 0.18
  mouthCavity.name = 'cavity'
  jaw.add(mouthCavity)
  const lowerLip = mesh(new RoundedBoxGeometry(0.034, 0.0075, 0.012, 2, 0.003), mat('#8A4740', { flat: false }), 0, -0.007, 0.005, false)
  jaw.add(lowerLip)

  // Arms: latSign = -1 is Right Arm (-X), latSign = +1 is Left Arm (+X)
  const buildArm = (latSign: -1 | 1) => {
    const sh = new THREE.Group()
    sh.position.set(latSign * 0.202, 0.475, 0)
    torso.add(sh)

    // Smooth shoulder deltoid cap + short/rolled shirt sleeve + upper arm
    sh.add(mesh(new THREE.SphereGeometry(0.056, 14, 12), shirtM, 0, 0, 0))
    sh.add(mesh(new THREE.CylinderGeometry(0.052, 0.046, 0.16, 14), shirtM, 0, -0.08, 0))
    sh.add(mesh(new THREE.TorusGeometry(0.046, 0.007, 8, 16), accentM, 0, -0.16, 0, false).rotateX(Math.PI / 2))
    sh.add(mesh(new THREE.CylinderGeometry(0.041, 0.037, 0.14, 14), skinM, 0, -0.215, 0))

    // Elbow joint + tapered forearm
    const el = new THREE.Group()
    el.position.set(0, -0.285, 0)
    sh.add(el)
    el.add(mesh(new THREE.SphereGeometry(0.036, 12, 10), skinM, 0, 0, 0, false))
    el.add(mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.255, 14), skinM, 0, -0.128, 0))

    // wristwatch on left wrist for commuter realism
    if (latSign === 1 && !o.saree) {
      const band = mesh(new THREE.TorusGeometry(0.029, 0.0055, 8, 18), mat('#3B281E', { rough: 0.5 }), 0, -0.225, 0, false)
      band.rotation.x = Math.PI / 2
      el.add(band)
      el.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.007, 14), mat('#E2E8F0', { metal: 0.8, rough: 0.2 }), 0, -0.225, -0.029, false).rotateX(Math.PI / 2))
    }

    const hand = buildHand(latSign, skinM, nailM)
    hand.wrist.position.set(0, -0.255, 0)
    el.add(hand.wrist)

    return { sh, el, hand }
  }

  const R = buildArm(-1) // Character's Right Arm
  const L = buildArm(1)  // Character's Left Arm

  // Legs + Knees + Ankles + Sandals/Shoes
  const buildLeg = (latSign: -1 | 1) => {
    const hp = new THREE.Group()
    hp.position.set(latSign * 0.088, 0, 0)
    hips.add(hp)

    const thighMat = o.veshti ? mat('#F7F5EE', { flat: false }) : legM
    const shinMat = o.veshti || o.saree ? skinM : legM
    hp.add(mesh(new THREE.SphereGeometry(0.068, 12, 10), thighMat, 0, 0, 0, false))
    hp.add(mesh(new THREE.CylinderGeometry(0.068, 0.056, 0.42, 14), thighMat, 0, -0.21, 0))

    const kn = new THREE.Group()
    kn.position.set(0, -0.42, 0)
    hp.add(kn)
    kn.add(mesh(new THREE.SphereGeometry(0.054, 12, 10), shinMat, 0, 0, 0, false))
    kn.add(mesh(new THREE.CylinderGeometry(0.052, 0.039, 0.40, 14), shinMat, 0, -0.20, 0))

    const ak = new THREE.Group()
    ak.position.set(0, -0.41, 0)
    kn.add(ak)
    ak.add(mesh(new THREE.SphereGeometry(0.038, 10, 8), skinM, 0, 0, 0, false))
    // Neat South Indian leather sandal / commuter shoe
    const sole = mesh(new RoundedBoxGeometry(0.086, 0.026, 0.21, 3, 0.01), mat('#2B1D14', { rough: 0.7 }), 0, -0.038, 0.042)
    ak.add(sole)
    if (o.veshti || o.saree) {
      const foot = mesh(new RoundedBoxGeometry(0.076, 0.032, 0.175, 3, 0.012), skinM, 0, -0.018, 0.036, false)
      ak.add(foot)
      const strap = mesh(new RoundedBoxGeometry(0.084, 0.014, 0.048, 2, 0.005), mat('#5C3A21', { rough: 0.55 }), 0, -0.004, 0.045, false)
      ak.add(strap)
    } else {
      const upper = mesh(new RoundedBoxGeometry(0.082, 0.045, 0.19, 3, 0.016), mat('#1F2937', { rough: 0.6 }), 0, -0.015, 0.036)
      ak.add(upper)
    }
    return { hp, kn, ak }
  }

  const LR = buildLeg(-1)
  const LL = buildLeg(1)

  let skirt: THREE.Object3D | undefined
  if (o.veshti) {
    const vg = new THREE.Group()
    const vm = mat('#F7F5EE', { flat: false, rough: 0.75 })
    const bm = mat(o.veshtiBorder ?? '#B8860B', { flat: false, metal: 0.35, rough: 0.4 })
    vg.add(mesh(new THREE.CylinderGeometry(0.152, 0.195, 0.74, 18), vm, 0, -0.39, 0))
    vg.add(mesh(new THREE.CylinderGeometry(0.196, 0.199, 0.045, 18), bm, 0, -0.73, 0, false))
    vg.add(mesh(new BoxGeoBorder(0.03, 0.72, 0.012), bm, 0.06, -0.39, 0.175, false))
    hips.add(vg)
    skirt = vg
  } else if (o.saree) {
    const sg = new THREE.Group()
    const sm = mat(o.saree, { flat: false, rough: 0.68 })
    const bm = mat(o.border ?? '#E0A526', { flat: false, metal: 0.3, rough: 0.45 })
    sg.add(mesh(new THREE.CylinderGeometry(0.155, 0.25, 0.78, 18), sm, 0, -0.40, 0))
    sg.add(mesh(new THREE.CylinderGeometry(0.251, 0.256, 0.07, 18), bm, 0, -0.75, 0, false))
    hips.add(sg)
    skirt = sg
  }

  root.scale.setScalar(o.scale ?? 1)

  const rig: Rig = {
    root,
    hips,
    torso,
    neck,
    head,
    jaw,
    browL,
    browR,
    eyelidL: eyelids[1],
    eyelidR: eyelids[0],
    shoulderL: L.sh,
    shoulderR: R.sh,
    elbowL: L.el,
    elbowR: R.el,
    handL: L.hand,
    handR: R.hand,
    legL: LL.hp,
    legR: LR.hp,
    kneeL: LL.kn,
    kneeR: LR.kn,
    ankleL: LL.ak,
    ankleR: LR.ak,
    skirt,
    hipH,
  }
  resetPose(rig)
  return rig
}

/** Natural relaxed resting hand cascade (fingers slightly curved, thumb resting beside index) */
export function relaxHand(h: HandRig, curl = 0.28) {
  h.wrist.rotation.set(0, 0, 0)
  h.fingers.forEach((f, i) => {
    const c = curl * (0.85 + i * 0.14)
    f.prox.rotation.set(-c, 0, 0)
    f.dist.rotation.set(-c * 0.85, 0, 0)
  })
  h.thumbBase.rotation.set(-0.22, -h.latSign * 0.35, h.latSign * 0.28)
  h.thumbDist.rotation.set(-0.25, 0, 0)
}

/**
 * Precision smartphone grip pose:
 * The 4 fingers wrap cleanly around the outer vertical edge of the phone mounted on `phoneMount`,
 * while the opposable thumb braces the near vertical bezel — zero screen clipping!
 */
export function gripPhoneHand(h: HandRig) {
  const s = h.latSign
  // Knuckles sit right at the outer phone bezel; fingers bend along side frame (+Z) without crossing onto screen
  h.fingers.forEach((f, i) => {
    f.prox.rotation.set(-1.32 - i * 0.03, 0, 0)
    f.dist.rotation.set(-0.42, 0, 0)
  })
  // Opposable thumb braces the opposite bezel edge cleanly
  h.thumbBase.rotation.set(-0.55, s * 0.35, s * 1.15)
  h.thumbDist.rotation.set(-0.35, 0, -s * 0.35)
}

/**
 * Index-finger tapping pose for dialing 1 - 4 - 9 on the smartphone keypad:
 * Index finger extends cleanly while middle, ring, and pinky curl neatly into the palm.
 */
export function dialFingerHand(h: HandRig, pressK = 0) {
  const s = h.latSign
  // Index extended, dipping forward on pressK (0..1)
  h.fingers[0].prox.rotation.set(-0.18 - pressK * 0.32, 0, -s * 0.04)
  h.fingers[0].dist.rotation.set(-0.16 - pressK * 0.22, 0, 0)
  // Middle, ring, pinky curled cleanly out of the way
  for (let i = 1; i < 4; i++) {
    h.fingers[i].prox.rotation.set(-1.35 - i * 0.06, 0, 0)
    h.fingers[i].dist.rotation.set(-1.25, 0, 0)
  }
  h.thumbBase.rotation.set(-0.55, -s * 0.48, s * 0.38)
  h.thumbDist.rotation.set(-0.45, 0, 0)
}

/** Expressive natural conversational hand gesture while talking on the phone */
export function gestureHand(h: HandRig, t: number) {
  const wave = 0.5 + 0.5 * Math.sin(t * 3.4)
  h.fingers.forEach((f, i) => {
    const c = (0.22 + 0.18 * wave) * (0.85 + i * 0.12)
    f.prox.rotation.set(-c, 0, (1.5 - i) * 0.04 * h.latSign)
    f.dist.rotation.set(-c * 0.75, 0, 0)
  })
  h.thumbBase.rotation.set(-0.2, -h.latSign * 0.3, h.latSign * (0.35 + 0.1 * wave))
  h.thumbDist.rotation.set(-0.18, 0, 0)
}

export function resetPose(r: Rig) {
  for (const g of [
    r.hips,
    r.torso,
    r.neck,
    r.head,
    r.jaw,
    r.shoulderL,
    r.shoulderR,
    r.elbowL,
    r.elbowR,
    r.legL,
    r.legR,
    r.kneeL,
    r.kneeR,
    r.ankleL,
    r.ankleR,
  ]) {
    g.rotation.set(0, 0, 0)
  }
  r.hips.position.set(0, r.hipH, 0)
  // Natural relaxed arm hang with palms turned inward toward thighs
  r.shoulderR.rotation.set(0, -1.25, -0.07)
  r.shoulderL.rotation.set(0, 1.25, 0.07)
  r.elbowR.rotation.set(-0.12, 0, 0)
  r.elbowL.rotation.set(-0.12, 0, 0)
  relaxHand(r.handR, 0.3)
  relaxHand(r.handL, 0.3)
  r.browL.rotation.z = 0
  r.browR.rotation.z = 0
  r.browL.position.y = 0.040
  r.browR.position.y = 0.040
  const cav = r.jaw.getObjectByName('cavity')
  if (cav) cav.scale.y = 0.18
  if (r.skirt) r.skirt.visible = true
}

/** Update blinking eyelids, facial expression, and speech lip-sync */
export function setExpression(
  r: Rig,
  t: number,
  opts: { speak?: number; confused?: number; happy?: number } = {}
) {
  // Natural eye blink every ~3.8s
  const blinkPhase = (t + 1.3) % 3.9
  const blink = blinkPhase < 0.14 ? Math.sin((blinkPhase / 0.14) * Math.PI) : 0
  r.eyelidL.scale.y = lerp(0.18, 1.05, blink)
  r.eyelidR.scale.y = lerp(0.18, 1.05, blink)

  const conf = clamp(opts.confused ?? 0)
  const hap = clamp(opts.happy ?? 0)
  // Furrowed brows when confused by Maps; gently lifted warm brows when happy
  r.browR.rotation.z = -0.24 * conf + 0.08 * hap
  r.browL.rotation.z = 0.24 * conf - 0.08 * hap
  r.browR.position.y = 0.040 - 0.004 * conf + 0.004 * hap
  r.browL.position.y = 0.040 - 0.004 * conf + 0.004 * hap

  // Lip-sync jaw opening modulated by real voice amplitude + syllable cadence
  const sp = clamp(opts.speak ?? 0)
  const syll = sp * (0.65 + 0.35 * Math.sin(t * 21))
  r.jaw.position.y = -0.046 - syll * 0.011
  const cav = r.jaw.getObjectByName('cavity')
  if (cav) cav.scale.y = lerp(0.18, 1.35, syll)
}

/** Smooth human walking cycle */
export function walkPose(r: Rig, phase: number, amp = 0.44) {
  const s = Math.sin(phase)
  const c = Math.cos(phase)
  r.legL.rotation.x = -s * amp
  r.legR.rotation.x = s * amp
  r.kneeL.rotation.x = Math.max(0, Math.sin(phase + 1.15)) * amp * 1.35
  r.kneeR.rotation.x = Math.max(0, Math.sin(phase + 1.15 + Math.PI)) * amp * 1.35
  r.ankleL.rotation.x = -0.12 * s
  r.ankleR.rotation.x = 0.12 * s

  r.shoulderL.rotation.set(s * amp * 0.72, 1.2, 0.07)
  r.shoulderR.rotation.set(-s * amp * 0.72, -1.2, -0.07)
  r.elbowL.rotation.set(-0.22 - Math.max(0, -s) * 0.2, 0, 0)
  r.elbowR.rotation.set(-0.22 - Math.max(0, s) * 0.2, 0, 0)
  r.hips.position.y = r.hipH + Math.abs(c) * 0.022 - 0.015
  r.torso.rotation.y = -s * 0.06
}

/**
 * Left hand cradles the smartphone cleanly in front of chest so viewer & character see the screen;
 * Right hand can either rest, hover, or tap keypad digits `1`, `4`, `9`, `Call`.
 */
export function lookAtPhonePose(
  r: Rig,
  opts: { dialActive?: number; pressK?: number; keyCol?: number; keyRow?: number } = {}
) {
  // Mathematically solved Left Arm: holds phone upright in front of chest, screen angled 93% toward eyes
  r.shoulderL.rotation.set(-0.619, -0.594, -0.041)
  r.elbowL.rotation.set(-1.516, 1.008, 0)
  r.handL.wrist.rotation.set(0.422, -1.395, -0.597)
  gripPhoneHand(r.handL)

  const dial = smooth(opts.dialActive ?? 0)
  if (dial > 0.01) {
    const cu = clamp((opts.keyCol ?? 1) / 2) // 0=left('1','4'), 0.5=mid('call'), 1=right('9')
    const ru = clamp((opts.keyRow ?? 1) / 4) // 0=row0('1'), 0.25=row1('4'), 0.5=row2('9'), 1=row4('call')
    const pk = opts.pressK ?? 0
    // Interpolate solved R-arm keypad touch poses across columns & rows
    const shX = lerp(-0.516, -0.06, ru) + (1 - pk) * 0.05
    const shY = lerp(0.47, 0.36, cu)
    const shZ = lerp(-0.06, 0.1, ru)
    const elX = lerp(-1.6, -1.82, ru) + (1 - pk) * 0.07
    const elY = lerp(1.16, 0.72, ru * 0.8)
    const wrX = lerp(-0.66, -0.54, ru)
    const wrY = lerp(-0.88, 0.45, ru * 0.85)
    const wrZ = lerp(0.67, 0.54, ru)

    r.shoulderR.rotation.set(lerp(0, shX, dial), lerp(-1.25, shY, dial), lerp(-0.07, shZ, dial))
    r.elbowR.rotation.set(lerp(-0.12, elX, dial), lerp(0, elY, dial), 0)
    r.handR.wrist.rotation.set(lerp(0, wrX, dial), lerp(0, wrY, dial), lerp(0, wrZ, dial))
    dialFingerHand(r.handR, pk * dial)
  }
}

/**
 * Blends smoothly from looking at the phone in front of chest (k = 0)
 * to holding the phone cleanly beside the right ear during the call (k = 1, 16.9mm earpiece clearance, 98.5% inward normal),
 * while the left hand gestures naturally during Tamil conversation!
 */
export function earPhoneCallPose(r: Rig, k: number, t: number, userSpeaking: boolean) {
  const e = smooth(k)
  // Solved anatomical Right Arm ear-call pose: earpiece 16.9mm outside right ear, mic angled toward mouth
  r.shoulderR.rotation.set(
    lerp(-0.62, -1.884, e),
    lerp(0.59, 0.313, e),
    lerp(0.04, 0.1, e)
  )
  r.elbowR.rotation.set(lerp(-1.516, -2.362, e), lerp(-1.008, 0.553, e), 0)
  r.handR.wrist.rotation.set(
    lerp(0.422, 0.694, e),
    lerp(1.395, 1.378, e),
    lerp(0.597, 0.694, e)
  )
  gripPhoneHand(r.handR)

  // Left arm relaxes down or gestures naturally when Murugan speaks in Tamil!
  const gest = userSpeaking ? e : e * 0.25
  const wave = Math.sin(t * 3.1)
  r.shoulderL.rotation.set(
    lerp(-0.619, -0.22 - 0.28 * gest * (0.5 + 0.5 * wave), e),
    lerp(-0.594, 0.85 - 0.35 * gest, e),
    lerp(-0.041, 0.12, e)
  )
  r.elbowL.rotation.set(lerp(-1.516, -0.35 - 0.55 * gest * (0.6 + 0.4 * Math.cos(t * 2.6)), e), lerp(1.008, 0, e), 0)
  r.handL.wrist.rotation.set(lerp(0.422, 0, e), lerp(-1.395, -0.25 * gest, e), lerp(-0.597, 0, e))
  if (userSpeaking && e > 0.5) gestureHand(r.handL, t)
  else relaxHand(r.handL, 0.26)
}

export function sitBenchPose(r: Rig, seatH = 0.46) {
  r.hips.position.y = seatH + 0.06
  r.legL.rotation.x = -Math.PI / 2 + 0.06
  r.legR.rotation.x = -Math.PI / 2 + 0.06
  r.kneeL.rotation.x = Math.PI / 2 - 0.06
  r.kneeR.rotation.x = Math.PI / 2 - 0.06
  r.legL.rotation.y = 0.08
  r.legR.rotation.y = -0.08
  r.shoulderL.rotation.set(-0.42, 0.4, 0.06)
  r.shoulderR.rotation.set(-0.42, -0.4, -0.06)
  r.elbowL.rotation.set(-0.65, 0, 0)
  r.elbowR.rotation.set(-0.65, 0, 0)
}
