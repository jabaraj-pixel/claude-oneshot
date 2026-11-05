import clip01 from '../assets/audio/01_kural_welcome.mp3?inline'
import clip02 from '../assets/audio/02_user_query.mp3?inline'
import clip03 from '../assets/audio/03_kural_route.mp3?inline'
import clip04 from '../assets/audio/04_user_metro_ask.mp3?inline'
import clip05 from '../assets/audio/05_kural_metro_msg.mp3?inline'
import clip06 from '../assets/audio/06_user_consent.mp3?inline'
import clip07 from '../assets/audio/07_kural_goodbye.mp3?inline'
import clip08 from '../assets/audio/08_kural_live_policy.mp3?inline'
import clip09 from '../assets/audio/09_kural_repeat.mp3?inline'
import { CALL_TURNS, DIAL_TAPS, RING_EVENTS, T, type ClipKey } from './timeline'

const CLIP_URLS: Record<ClipKey, string> = {
  '01_kural_welcome': clip01,
  '02_user_query': clip02,
  '03_kural_route': clip03,
  '04_user_metro_ask': clip04,
  '05_kural_metro_msg': clip05,
  '06_user_consent': clip06,
  '07_kural_goodbye': clip07,
  '08_kural_live_policy': clip08,
  '09_kural_repeat': clip09,
}

function dataUrlToArrayBuffer(url: string): Promise<ArrayBuffer> {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',')
    const b64 = url.slice(comma + 1)
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return Promise.resolve(bytes.buffer)
  }
  return fetch(url).then(r => r.arrayBuffer())
}

// Pre-convert base64 payloads into ArrayBuffers immediately at page load (before Play is clicked!)
const RAW_CLIP_BUFFERS = new Map<ClipKey, Promise<ArrayBuffer>>()
for (const key of Object.keys(CLIP_URLS) as ClipKey[]) {
  RAW_CLIP_BUFFERS.set(key, dataUrlToArrayBuffer(CLIP_URLS[key]))
}

const DTMF_FREQS: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
}

export class SoundEngine {
  ctx: AudioContext
  master: GainNode
  musicBus: GainNode
  voiceBus: GainNode
  sfxBus: GainNode
  analyser: AnalyserNode
  stream: MediaStreamAudioDestinationNode

  private buffers = new Map<ClipKey, AudioBuffer>()
  private loadingPromise: Promise<void> | null = null
  private activeVoice: {
    key: ClipKey
    src: AudioBufferSourceNode
  } | null = null
  private interactiveSrc: AudioBufferSourceNode | null = null

  private timer = 0
  private next = { drone: 0, percussion: 0, melody: 0 }
  private step = { drone: 0, percussion: 0, melody: 0 }
  private started = 0
  private lastFilmT = -1
  private inCallSilent = false
  private timeData = new Uint8Array(256)
  private freqData = new Uint8Array(64)

  muted = false

  constructor() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new AC({ latencyHint: 'interactive' })
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.95

    this.musicBus = this.ctx.createGain()
    this.musicBus.gain.value = 0.24

    this.voiceBus = this.ctx.createGain()
    this.voiceBus.gain.value = 1.18

    this.sfxBus = this.ctx.createGain()
    this.sfxBus.gain.value = 0.58

    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.72

    this.stream = this.ctx.createMediaStreamDestination()

    // Direct zero-latency routing (no heavy FFT ConvolverNode or leaked GainNodes!)
    this.voiceBus.connect(this.analyser)
    this.analyser.connect(this.master)
    this.musicBus.connect(this.master)
    this.sfxBus.connect(this.master)

    this.master.connect(this.ctx.destination)
    this.master.connect(this.stream)

    this.preloadClips()
  }

  preloadClips(): Promise<void> {
    if (this.loadingPromise) return this.loadingPromise
    const keys = Object.keys(CLIP_URLS) as ClipKey[]
    this.loadingPromise = Promise.all(
      keys.map(async key => {
        try {
          const ab = await RAW_CLIP_BUFFERS.get(key)!
          const buf = await this.ctx.decodeAudioData(ab.slice(0))
          this.buffers.set(key, buf)
        } catch (err) {
          console.warn('Could not decode audio clip', key, err)
        }
      })
    ).then(() => undefined)
    return this.loadingPromise
  }

  /** Lightweight Carnatic tanpura / veena pluck (zero leaked nodes) */
  private veenaPluck(freq: number, at: number, dur = 2.6, vol = 0.08) {
    const c = this.ctx
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.linearRampToValueAtTime(vol, at + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0005, at + dur)
    g.connect(this.musicBus)

    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = freq
    o.connect(g)
    o.start(at)
    o.stop(at + dur + 0.03)
    o.onended = () => g.disconnect()
  }

  /** Lightweight Carnatic flute in Raagam Mohanam (zero leaked nodes) */
  private venuFlute(freq: number, at: number, dur: number, vol = 0.065) {
    const c = this.ctx
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.linearRampToValueAtTime(vol, at + 0.07)
    g.gain.setValueAtTime(vol, at + dur * 0.72)
    g.gain.exponentialRampToValueAtTime(0.0005, at + dur + 0.22)
    g.connect(this.musicBus)

    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(freq * 0.99, at)
    o.frequency.exponentialRampToValueAtTime(freq, at + 0.06)
    o.connect(g)
    o.start(at)
    o.stop(at + dur + 0.25)
    o.onended = () => g.disconnect()
  }

  /** Soft rhythmic pulse outside the call chapter */
  private mridangam(at: number, low: boolean, vol = 0.12) {
    const c = this.ctx
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    if (low) {
      o.frequency.setValueAtTime(110, at)
      o.frequency.exponentialRampToValueAtTime(68, at + 0.18)
    } else {
      o.frequency.value = 440
    }
    g.gain.setValueAtTime(vol, at)
    g.gain.exponentialRampToValueAtTime(0.0005, at + (low ? 0.28 : 0.12))
    o.connect(g)
    g.connect(this.musicBus)
    o.start(at)
    o.stop(at + 0.3)
    o.onended = () => g.disconnect()
  }

  private scheduleMusic() {
    if (this.ctx.state !== 'running') return
    const now = this.ctx.currentTime
    // Keep audio thread 100% dedicated to voice during phone dialing, ringing & Tamil conversation!
    if (this.inCallSilent) {
      this.next.drone = now + 0.3
      this.next.percussion = now + 0.3
      this.next.melody = now + 0.4
      return
    }

    const ahead = now + 0.25
    const SA = 146.83
    const el = now - this.started

    while (this.next.drone < ahead) {
      const seq = [SA * 0.75, SA, SA, SA * 0.5]
      this.veenaPluck(seq[this.step.drone % 4], this.next.drone, 2.4, 0.065)
      this.next.drone += 0.9
      this.step.drone++
    }

    const beat = 60 / 86 / 2
    while (this.next.percussion < ahead) {
      if (el > 3.5 && this.step.percussion % 2 === 0) {
        this.mridangam(this.next.percussion, this.step.percussion % 8 === 0, 0.09)
      }
      this.next.percussion += beat
      this.step.percussion++
    }

    const deg = [0, 2, 4, 7, 9, 12, 14, 16]
    const phrase: [number, number][] = [
      [0, 2], [1, 1], [2, 1], [3, 3], [-1, 1],
      [4, 2], [5, 2], [4, 1], [3, 1], [2, 2], [-1, 1],
      [3, 1], [4, 1], [5, 2], [4, 2], [2, 2], [1, 2], [0, 3], [-1, 2],
    ]
    while (this.next.melody < ahead) {
      const [d, b] = phrase[this.step.melody % phrase.length]
      const dur = b * beat * 2
      if (d >= 0 && el > 1.2) {
        this.venuFlute(SA * 2 * Math.pow(2, deg[d] / 12), this.next.melody, dur * 0.9)
      }
      this.next.melody += dur
      this.step.melody++
    }
  }

  /** Play authentic DTMF keypad tone */
  playDtmf(digit: string) {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const pair = DTMF_FREQS[digit]
    if (!pair) {
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(520, now)
      o.frequency.exponentialRampToValueAtTime(760, now + 0.1)
      g.gain.setValueAtTime(0.18, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.13)
      o.connect(g)
      g.connect(this.sfxBus)
      o.start(now)
      o.stop(now + 0.15)
      o.onended = () => g.disconnect()
      return
    }
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.001, now)
    g.gain.linearRampToValueAtTime(0.16, now + 0.01)
    g.gain.setValueAtTime(0.16, now + 0.12)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
    g.connect(this.sfxBus)
    for (const f of pair) {
      const o = this.ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(g)
      o.start(now)
      o.stop(now + 0.17)
      if (f === pair[1]) o.onended = () => g.disconnect()
    }
  }

  /** Authentic Indian telecom dual-cadence ringback ("Tring-tring") */
  playIndianRing() {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const bursts: [number, number][] = [
      [0, 0.4],
      [0.58, 1.0],
    ]
    for (const [b0, b1] of bursts) {
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.001, now + b0)
      g.gain.linearRampToValueAtTime(0.16, now + b0 + 0.02)
      g.gain.setValueAtTime(0.16, now + b1 - 0.03)
      g.gain.exponentialRampToValueAtTime(0.001, now + b1)
      g.connect(this.sfxBus)
      for (const freq of [400, 450]) {
        const o = this.ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = freq
        o.connect(g)
        o.start(now + b0)
        o.stop(now + b1 + 0.02)
        if (freq === 450) o.onended = () => g.disconnect()
      }
    }
  }

  /** Call connect / disconnect / notification chimes */
  playChime(kind: 'pickup' | 'hangup' | 'whatsapp' | 'sms') {
    this.ensureRunning()
    const now = this.ctx.currentTime
    const notes: [number, number, number][] =
      kind === 'pickup'
        ? [[587.3, 0, 0.09], [880, 0.08, 0.14]]
        : kind === 'hangup'
          ? [[659.3, 0, 0.1], [440, 0.1, 0.16]]
          : kind === 'whatsapp'
            ? [[784, 0, 0.08], [1046.5, 0.08, 0.16]]
            : [[698.5, 0, 0.09], [932.3, 0.09, 0.16]]
    for (const [freq, off, dur] of notes) {
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      o.type = 'triangle'
      o.frequency.value = freq
      g.gain.setValueAtTime(0.001, now + off)
      g.gain.linearRampToValueAtTime(0.2, now + off + 0.015)
      g.gain.exponentialRampToValueAtTime(0.001, now + off + dur)
      o.connect(g)
      g.connect(this.sfxBus)
      o.start(now + off)
      o.stop(now + off + dur + 0.02)
      o.onended = () => g.disconnect()
    }
  }

  stopFilmVoice() {
    if (this.activeVoice) {
      try {
        this.activeVoice.src.onended = null
        this.activeVoice.src.stop()
        this.activeVoice.src.disconnect()
      } catch {
        // ignore
      }
      this.activeVoice = null
    }
  }

  stopInteractiveVoice() {
    if (this.interactiveSrc) {
      try {
        this.interactiveSrc.onended = null
        this.interactiveSrc.stop()
        this.interactiveSrc.disconnect()
      } catch {
        // ignore
      }
      this.interactiveSrc = null
    }
  }

  /** Play a standalone clip for Dial-by-Phone-Number mode */
  async playInteractiveClip(key: ClipKey, onEnded?: () => void) {
    this.ensureRunning()
    this.stopFilmVoice()
    this.stopInteractiveVoice()
    await this.preloadClips()
    const buf = this.buffers.get(key)
    if (!buf) {
      onEnded?.()
      return
    }
    this.inCallSilent = true
    this.musicBus.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.08)
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.connect(this.voiceBus)
    this.interactiveSrc = src
    src.onended = () => {
      if (this.interactiveSrc === src) {
        this.interactiveSrc = null
      }
      onEnded?.()
    }
    src.start()
  }

  /**
   * Synchronizes voice & SFX with film time `t`.
   * Once a voice turn starts playing, it NEVER stops or re-seeks mid-sentence
   * unless `forceSeek` is true (explicit user scrub), eliminating 100% of jitter/lag!
   */
  syncFilmTime(t: number, playing: boolean, interactiveOpen = false, forceSeek = false) {
    if (interactiveOpen) {
      this.stopFilmVoice()
      this.lastFilmT = t
      return
    }

    // Completely silence background score during dialing, ringing & telephone call!
    const inCallZone = t >= T.remember + 3.2 && t <= T.whatsapp + 0.2
    this.inCallSilent = inCallZone
    if (this.ctx.state === 'running') {
      this.musicBus.gain.setTargetAtTime(inCallZone ? 0.0 : 0.22, this.ctx.currentTime, 0.15)
    }

    if (!playing) {
      this.stopFilmVoice()
      this.lastFilmT = t
      return
    }

    const prev = this.lastFilmT
    if (!forceSeek && prev >= 0 && t >= prev && t - prev < 0.45) {
      for (const tap of DIAL_TAPS) {
        if (prev < tap.t && t >= tap.t) this.playDtmf(tap.digit)
      }
      if (prev < RING_EVENTS.ring1Start && t >= RING_EVENTS.ring1Start) this.playIndianRing()
      if (prev < RING_EVENTS.ring2Start && t >= RING_EVENTS.ring2Start) this.playIndianRing()
      if (prev < RING_EVENTS.pickup && t >= RING_EVENTS.pickup) this.playChime('pickup')
      if (prev < RING_EVENTS.hangup && t >= RING_EVENTS.hangup) this.playChime('hangup')
      if (prev < RING_EVENTS.whatsappPing && t >= RING_EVENTS.whatsappPing) this.playChime('whatsapp')
      if (prev < RING_EVENTS.smsPing && t >= RING_EVENTS.smsPing) this.playChime('sms')
    }
    this.lastFilmT = t

    const turn = CALL_TURNS.find(c => t >= c.start && t < c.end - 0.04)
    if (!turn) {
      if (this.activeVoice && (t < CALL_TURNS[0].start || t > CALL_TURNS[CALL_TURNS.length - 1].end + 0.3 || forceSeek)) {
        this.stopFilmVoice()
      }
      return
    }

    // If this exact turn is already playing and user did NOT scrub, let hardware audio play uninterrupted!
    if (!forceSeek && this.activeVoice && this.activeVoice.key === turn.key) {
      return
    }

    const buf = this.buffers.get(turn.key)
    if (!buf) return

    this.stopFilmVoice()
    const offset = Math.max(0, Math.min(buf.duration - 0.04, t - turn.start))
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.connect(this.voiceBus)
    const entry = { key: turn.key, src }
    this.activeVoice = entry
    src.onended = () => {
      if (this.activeVoice === entry) this.activeVoice = null
    }
    src.start(0, offset)
  }

  getVoiceLevel(): number {
    if (!this.activeVoice && !this.interactiveSrc) return 0
    this.analyser.getByteTimeDomainData(this.timeData)
    let sumSq = 0
    for (let i = 0; i < this.timeData.length; i++) {
      const v = (this.timeData[i] - 128) / 128
      sumSq += v * v
    }
    return Math.min(1, Math.sqrt(sumSq / this.timeData.length) * 4.2)
  }

  fillSpectrum(out: number[], count = 24) {
    if (!this.activeVoice && !this.interactiveSrc) {
      for (let i = 0; i < count; i++) out[i] = 0.06
      return
    }
    this.analyser.getByteFrequencyData(this.freqData)
    for (let i = 0; i < count; i++) {
      const idx = Math.min(this.freqData.length - 1, Math.floor((i / count) * 28) + 1)
      out[i] = Math.max(0.08, Math.min(1, (this.freqData[idx] / 255) * 1.45))
    }
  }

  ensureRunning() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  start() {
    this.ensureRunning()
    if (this.timer) return
    const now = this.ctx.currentTime + 0.05
    this.started = now
    this.next = { drone: now, percussion: now, melody: now + 0.4 }
    this.step = { drone: 0, percussion: 0, melody: 0 }
    this.timer = window.setInterval(() => this.scheduleMusic(), 80)
  }

  setMuted(m: boolean) {
    this.muted = m
    this.master.gain.setTargetAtTime(m ? 0 : 0.95, this.ctx.currentTime, 0.06)
  }
}
