// Elara's voice. Two options, both free:
// - Standard: the device's built-in voice. Instant, works offline, nothing to download.
// - Natural: an open-source voice model (Kokoro-82M) that runs inside the browser.
//   The first use downloads roughly 90 MB, which the browser then keeps.
//   The text is turned into sound on the device, so nothing is sent to a voice service.

export type VoiceMode = 'standard' | 'natural'

const MODE_KEY = 'elara.voice'
const KOKORO_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm'
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const VOICE_ID = 'af_heart'

type KokoroOutput = { audio: Float32Array; sampling_rate: number }
type KokoroInstance = { generate: (text: string, opts: { voice: string; speed?: number }) => Promise<KokoroOutput> }
type KokoroModule = {
  KokoroTTS: {
    from_pretrained: (
      id: string,
      opts: { dtype: string; device: string; progress_callback?: (p: { progress?: number }) => void },
    ) => Promise<KokoroInstance>
  }
}

export function getVoiceMode(): VoiceMode {
  try { return localStorage.getItem(MODE_KEY) === 'natural' ? 'natural' : 'standard' } catch { return 'standard' }
}

let brokenNatural = false

export function setVoiceMode(mode: VoiceMode) {
  brokenNatural = false
  try { localStorage.setItem(MODE_KEY, mode) } catch { /* storage unavailable */ }
}

let modelPromise: Promise<KokoroInstance> | null = null

// Downloads and loads the natural voice once. Later calls reuse the same model.
export function prepareNaturalVoice(onProgress?: (pct: number) => void): Promise<KokoroInstance> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const mod = (await import(/* @vite-ignore */ KOKORO_URL)) as KokoroModule
      return mod.KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (p) => {
          if (typeof p.progress === 'number') onProgress?.(Math.round(p.progress))
        },
      })
    })()
    modelPromise.catch(() => { modelPromise = null; brokenNatural = true })
  }
  return modelPromise
}

let token = 0
let current: HTMLAudioElement | null = null
let currentUrl: string | null = null

function stopCurrent() {
  if (current) { current.pause(); current.src = ''; current = null }
  if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null }
}

// Stops anything Elara is saying, in either voice.
export function stopSpeaking() {
  token++
  stopCurrent()
  try { window.speechSynthesis?.cancel() } catch { /* not supported */ }
}

function speakStandard(text: string, onStart?: () => void, onEnd?: () => void) {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  if (!synth) { onEnd?.(); return }
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.95
  u.pitch = 1.05
  const voices = synth.getVoices()
  const pick = voices.find((v) => /^en/i.test(v.lang) && /female|samantha|aria|jenny|zira|google uk english female/i.test(v.name))
    || voices.find((v) => /^en/i.test(v.lang))
  if (pick) u.voice = pick
  u.onstart = () => onStart?.()
  u.onend = () => onEnd?.()
  u.onerror = () => onEnd?.()
  synth.speak(u)
}

// Speaks a line in the chosen voice. Falls back to the standard voice if the natural one is unavailable.
export async function speakAloud(text: string, onStart?: () => void, onEnd?: () => void): Promise<void> {
  const my = ++token
  stopCurrent()
  try { window.speechSynthesis?.cancel() } catch { /* not supported */ }

  if (getVoiceMode() === 'natural' && !brokenNatural) {
    try {
      const tts = await prepareNaturalVoice()
      const out = await tts.generate(text, { voice: VOICE_ID, speed: 0.95 })
      if (my !== token) { onEnd?.(); return }
      const url = URL.createObjectURL(toWav(out.audio, out.sampling_rate))
      currentUrl = url
      const el = new Audio(url)
      current = el
      el.onplay = () => onStart?.()
      el.onended = () => { stopCurrent(); onEnd?.() }
      el.onerror = () => { stopCurrent(); onEnd?.() }
      await el.play()
      return
    } catch {
      if (my !== token) { onEnd?.(); return }
      stopCurrent()
    }
  }
  speakStandard(text, onStart, onEnd)
}

// Packs the model's raw samples into a WAV file the audio element can play.
function toWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}
