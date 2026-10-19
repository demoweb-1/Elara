// Elara's voice. Two options, both free:
// - Standard: the device's built-in voice. Instant, works offline, nothing to download.
// - Natural: an open-source voice model (Kokoro-82M) that runs in the browser.
//   The first use downloads roughly 90 MB, which the browser then keeps.
//   The model runs in a background Web Worker, so the page stays responsive while Elara speaks.
//   Nothing is sent to a voice service; the text is turned into sound on the device.

export type VoiceMode = 'standard' | 'natural'

const MODE_KEY = 'elara.voice'

// Runs inside the worker. Loads the model once, then turns text into audio on request.
const WORKER_SRC = `
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const KOKORO_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
let tts = null;
(async () => {
  try {
    const mod = await import(KOKORO_URL);
    tts = await mod.KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p) => {
        if (p && typeof p.progress === 'number') postMessage({ type: 'progress', pct: Math.round(p.progress) });
      },
    });
    postMessage({ type: 'ready' });
  } catch (err) {
    postMessage({ type: 'fatal', message: String(err) });
  }
})();
self.onmessage = async (e) => {
  const { type, id, text } = e.data;
  if (type !== 'speak') return;
  try {
    if (!tts) throw new Error('model not ready');
    const out = await tts.generate(text, { voice: 'af_heart', speed: 0.95 });
    const samples = new Float32Array(out.audio);
    postMessage({ type: 'audio', id, samples, rate: out.sampling_rate }, [samples.buffer]);
  } catch (err) {
    postMessage({ type: 'error', id, message: String(err) });
  }
};
`

export function getVoiceMode(): VoiceMode {
  try { return localStorage.getItem(MODE_KEY) === 'natural' ? 'natural' : 'standard' } catch { return 'standard' }
}

let brokenNatural = false

export function setVoiceMode(mode: VoiceMode) {
  brokenNatural = false
  try { localStorage.setItem(MODE_KEY, mode) } catch { /* storage unavailable */ }
}

let worker: Worker | null = null
let readyPromise: Promise<void> | null = null
let reporter: ((pct: number) => void) | null = null
let nextId = 1
const pending = new Map<number, { resolve: (samples: Float32Array, rate: number) => void; reject: (e: Error) => void }>()
// Finished audio per line of text, as blob URLs, so each line is only generated once.
const cache = new Map<string, string>()

function loadWorker(): Promise<void> {
  if (!readyPromise) {
    readyPromise = new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }))
      const w = new Worker(url, { type: 'module' })
      worker = w
      const fail = (err: Error) => {
        brokenNatural = true
        readyPromise = null
        w.terminate()
        if (worker === w) worker = null
        pending.forEach((p) => p.reject(err))
        pending.clear()
        reject(err)
      }
      w.onmessage = (e: MessageEvent) => {
        const m = e.data
        if (m.type === 'progress') reporter?.(Math.round(m.pct * 0.8))
        else if (m.type === 'ready') resolve()
        else if (m.type === 'audio') {
          const p = pending.get(m.id)
          if (p) { pending.delete(m.id); p.resolve(m.samples, m.rate) }
        } else if (m.type === 'error') {
          const p = pending.get(m.id)
          if (p) { pending.delete(m.id); p.reject(new Error(m.message)) }
        } else if (m.type === 'fatal') fail(new Error(m.message))
      }
      w.onerror = () => fail(new Error('voice worker failed'))
    })
    readyPromise.catch(() => { /* handled by callers */ })
  }
  return readyPromise
}

function synthesizeUrl(text: string): Promise<string> {
  const cached = cache.get(text)
  if (cached) return Promise.resolve(cached)
  return loadWorker().then(() => new Promise<string>((resolve, reject) => {
    const id = nextId++
    pending.set(id, {
      resolve: (samples, rate) => {
        const url = URL.createObjectURL(toWav(samples, rate))
        cache.set(text, url)
        resolve(url)
      },
      reject,
    })
    worker?.postMessage({ type: 'speak', id, text })
  }))
}

// Loads the natural voice and prepares the given lines ahead of time,
// so the conversation never waits on generation. Reports progress from 0 to 100.
export async function prepareNaturalVoice(onProgress?: (pct: number) => void, lines: string[] = []): Promise<void> {
  reporter = onProgress ?? null
  await loadWorker()
  for (let i = 0; i < lines.length; i++) {
    try { await synthesizeUrl(lines[i]) } catch { /* generated on demand later */ }
    reporter?.(80 + Math.round(((i + 1) / Math.max(lines.length, 1)) * 20))
  }
  reporter?.(100)
}

let token = 0
let current: HTMLAudioElement | null = null

function stopCurrent() {
  if (current) { current.pause(); current.src = ''; current = null }
}

// Stops anything Elara is saying, in either voice.
export function stopSpeaking() {
  token++
  stopCurrent()
  try { window.speechSynthesis?.cancel() } catch { /* not supported */ }
}

// Frees the voice model and its audio, for example when leaving onboarding.
export function releaseNaturalVoice() {
  stopSpeaking()
  worker?.terminate()
  worker = null
  readyPromise = null
  reporter = null
  pending.clear()
  cache.forEach((url) => URL.revokeObjectURL(url))
  cache.clear()
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
      const url = await synthesizeUrl(text)
      if (my !== token) { onEnd?.(); return }
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
