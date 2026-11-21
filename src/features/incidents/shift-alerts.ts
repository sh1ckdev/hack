export type ShiftAlertSeverity = 'error' | 'warning' | 'info'

export type ShiftAlertPrefs = {
  sound: boolean
  desktop: boolean
}

const PREFS_KEY = 'relay-shift-alert-prefs'

const defaultPrefs: ShiftAlertPrefs = {
  sound: true,
  desktop: false,
}

export function readShiftAlertPrefs(): ShiftAlertPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return defaultPrefs
    const parsed = JSON.parse(raw) as Partial<ShiftAlertPrefs>
    return {
      sound: parsed.sound ?? true,
      desktop: parsed.desktop ?? false,
    }
  } catch {
    return defaultPrefs
  }
}

export function writeShiftAlertPrefs(prefs: ShiftAlertPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

type Severity = ShiftAlertSeverity

let audioContext: AudioContext | undefined
let audioPrimed = false
const clipUrls: Partial<Record<Severity, string>> = {}

function getAudioContext() {
  if (!audioContext) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctx) throw new Error('AudioContext недоступен')
    audioContext = new Ctx()
  }
  return audioContext
}

function addTone(
  ctx: BaseAudioContext,
  destination: AudioNode,
  frequency: number,
  startSec: number,
  durationSec: number,
  volume: number,
  wave: OscillatorType
) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = wave
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, startSec)
  gain.gain.exponentialRampToValueAtTime(volume, startSec + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.001, startSec + durationSec)
  oscillator.connect(gain)
  gain.connect(destination)
  oscillator.start(startSec)
  oscillator.stop(startSec + durationSec + 0.02)
}

function scheduleCritical(ctx: BaseAudioContext, destination: AudioNode) {
  const step = 0.11
  const pairs: [number, number][] = [
    [1046, 740],
    [1046, 740],
    [1175, 622],
    [1318, 587],
  ]
  pairs.forEach(([high, low], index) => {
    const base = index * step * 2
    addTone(ctx, destination, high, base, step * 0.92, 0.16, 'square')
    addTone(ctx, destination, low, base + step, step * 0.92, 0.14, 'square')
  })
  addTone(
    ctx,
    destination,
    1568,
    step * pairs.length * 2,
    0.28,
    0.18,
    'sawtooth'
  )
}

function scheduleWarning(ctx: BaseAudioContext, destination: AudioNode) {
  addTone(ctx, destination, 740, 0, 0.16, 0.16, 'sine')
}

function scheduleInfo(ctx: BaseAudioContext, destination: AudioNode) {
  addTone(ctx, destination, 520, 0, 0.1, 0.1, 'sine')
}

function bufferToWavUrl(buffer: AudioBuffer) {
  const channel = buffer.getChannelData(0)
  const bytesPerSample = 2
  const blockAlign = bytesPerSample
  const byteRate = buffer.sampleRate * blockAlign
  const dataSize = channel.length * bytesPerSample
  const wav = new ArrayBuffer(44 + dataSize)
  const view = new DataView(wav)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < channel.length; i++) {
    const sample = Math.max(-1, Math.min(1, channel[i]))
    view.setInt16(
      offset,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true
    )
    offset += 2
  }
  return URL.createObjectURL(
    new Blob([wav], { type: 'audio/wav' })
  )
}

async function renderClip(
  severity: Severity,
  schedule: (ctx: BaseAudioContext, dest: AudioNode) => void,
  seconds: number
) {
  const sampleRate = 22050
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(sampleRate * seconds),
    sampleRate
  )
  schedule(offline, offline.destination)
  const rendered = await offline.startRendering()
  const previous = clipUrls[severity]
  if (previous) URL.revokeObjectURL(previous)
  clipUrls[severity] = bufferToWavUrl(rendered)
}

async function prepareSoundClips() {
  await Promise.all([
    renderClip('error', scheduleCritical, 1.4),
    renderClip('warning', scheduleWarning, 0.25),
    renderClip('info', scheduleInfo, 0.15),
  ])
}

/** Вызов из клика — разблокирует звук (в т.ч. в фоновой вкладке). */
export function primeShiftAlertAudio() {
  try {
    const ctx = getAudioContext()
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
    void ctx.resume()
    audioPrimed = true
    void prepareSoundClips()
  } catch {
    audioPrimed = false
  }
}

/** @deprecated */
export function unlockShiftAlertAudio() {
  primeShiftAlertAudio()
}

function playLiveOscillator(severity: Severity) {
  const ctx = getAudioContext()
  if (severity === 'error') scheduleCritical(ctx, ctx.destination)
  else if (severity === 'warning') scheduleWarning(ctx, ctx.destination)
  else scheduleInfo(ctx, ctx.destination)
}

function playClip(severity: Severity) {
  const url = clipUrls[severity]
  if (!url) return false
  const audio = new Audio(url)
  audio.volume = severity === 'error' ? 1 : 0.75
  void audio.play().catch(() => false)
  return true
}

export function playShiftAlertSound(severity: Severity) {
  if (!audioPrimed) return
  try {
    const ctx = getAudioContext()
    void ctx.resume()

    const inBackground = document.visibilityState === 'hidden'
    if (inBackground || clipUrls[severity]) {
      if (playClip(severity)) return
    }
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => playLiveOscillator(severity))
      return
    }
    playLiveOscillator(severity)
  } catch {
    playClip(severity)
  }
}

export function testShiftAlertSound() {
  primeShiftAlertAudio()
  playShiftAlertSound('warning')
}

export function desktopNotificationPermission():
  | NotificationPermission
  | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestDesktopNotificationPermission() {
  if (!('Notification' in window)) return 'denied' as const
  primeShiftAlertAudio()
  return Notification.requestPermission()
}

export function showDesktopNotification(
  title: string,
  options: { body?: string; tag?: string; silent?: boolean }
) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, {
      body: options.body,
      tag: options.tag,
      icon: '/images/favicon.png',
      silent: options.silent ?? false,
    })
  } catch {
    // Safari / ограничения origin
  }
}

export function deliverShiftAlert(
  prefs: ShiftAlertPrefs,
  payload: {
    severity: Severity
    title: string
    body?: string
    tag: string
  }
) {
  if (prefs.sound) playShiftAlertSound(payload.severity)

  if (prefs.desktop) {
    showDesktopNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      silent: false,
    })
  }
}