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

export type EndFn = (completed: boolean) => void

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

const READ_KEY = 'elara.readAloud'

export function getReadAloud(): boolean {
  try { return localStorage.getItem(READ_KEY) === 'on' } catch { return false }
}

export function setReadAloud(on: boolean) {
  try { localStorage.setItem(READ_KEY, on ? 'on' : 'off') } catch { /* storage unavailable */ }
}

let token = 0
let replyRun = 0
let current: HTMLAudioElement | null = null
let activeEnd: EndFn | null = null

// Tells whoever started the current line that it has finished (completed) or was cut off.
function finishActive(completed: boolean) {
  const e = activeEnd
  activeEnd = null
  e?.(completed)
}

function stopCurrent() {
  if (current) { current.pause(); current.src = ''; current = null }
}

// Stops anything Elara is saying, in either voice, including a reply that is still being read out.
export function stopSpeaking() {
  token++
  replyRun++
  finishActive(false)
  stopCurrent()
  liveUtterance = null
  try { window.speechSynthesis?.cancel() } catch { /* not supported */ }
}

// Frees the voice model and its audio, for example when leaving the page.
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

// Keeps the speech object alive until it finishes. Without this, some browsers drop it mid-sentence,
// so the "finished" signal never arrives and reading stops after the first sentence.
let liveUtterance: SpeechSynthesisUtterance | null = null

// A rough length for a sentence, used as a fallback timer if the browser never reports it finished.
const estimateMs = (text: string) => Math.max(2500, text.length * 90) + 2000

function speakStandard(text: string, onStart: () => void, end: EndFn) {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  if (!synth) { end(false); return }
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.95
  u.pitch = 1.05
  const voices = synth.getVoices()
  const pick = voices.find((v) => /^en/i.test(v.lang) && /female|samantha|aria|jenny|zira|google uk english female/i.test(v.name))
    || voices.find((v) => /^en/i.test(v.lang))
  if (pick) u.voice = pick
  console.info('[Elara] standard voice: voices available', voices.length, '| paused', synth.paused)
  if (synth.paused) synth.resume()
  liveUtterance = u
  activeEnd = end
  const guard = window.setTimeout(() => { if (activeEnd === end) finishActive(true) }, estimateMs(text))
  u.onstart = () => onStart()
  u.onend = () => {
    window.clearTimeout(guard)
    liveUtterance = null
    if (activeEnd === end) finishActive(true)
  }
  u.onerror = (e) => {
    console.warn('[Elara] speech error:', e.error)
    window.clearTimeout(guard)
    liveUtterance = null
    if (activeEnd === end) finishActive(false)
  }
  synth.speak(u)
}

// Speaks one line in the chosen voice. Falls back to the standard voice if the natural one is unavailable.
export async function speakAloud(text: string, onStart?: () => void, onEnd?: EndFn): Promise<void> {
  const my = ++token
  const end: EndFn = onEnd ?? (() => {})
  finishActive(false)
  stopCurrent()
  try { window.speechSynthesis?.cancel() } catch { /* not supported */ }

  if (getVoiceMode() === 'natural' && !brokenNatural) {
    try {
      const url = await synthesizeUrl(text)
      if (my !== token) { end(false); return }
      const el = new Audio(url)
      current = el
      activeEnd = end
      let guard = 0
      const clear = () => window.clearTimeout(guard)
      // If the sound stops before its end, move on once its expected length has passed.
      el.onloadedmetadata = () => {
        guard = window.setTimeout(() => {
          if (current === el) { stopCurrent(); finishActive(true) }
        }, el.duration * 1000 + 1500)
      }
      el.onplay = () => onStart?.()
      el.onended = () => { clear(); if (current === el) { current = null; finishActive(true) } }
      el.onerror = () => { clear(); if (current === el) { current = null; finishActive(false) } }
      await el.play()
      return
    } catch {
      if (my !== token) { end(false); return }
      stopCurrent()
      activeEnd = null
    }
  }
  speakStandard(text, onStart ?? (() => {}), end)
}

// Reads a longer reply one sentence at a time, so the first sentence starts quickly.
export function speakReply(text: string, onStart?: () => void, onEnd?: () => void): void {
  const run = ++replyRun
  const parts = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  console.info('[Elara] reading reply:', parts.length, 'sentence(s), voice =', getVoiceMode())
  if (parts.length === 0) { onEnd?.(); return }
  let started = false
  const first = () => { if (!started) { started = true; onStart?.() } }
  const step = (i: number) => {
    speakAloud(parts[i], first, (completed) => {
      if (completed && run === replyRun && i + 1 < parts.length) step(i + 1)
      else onEnd?.()
    })
  }
  step(0)
}

type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: any) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void
}

function getRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isListeningSupported(): boolean {
  return !!getRecognitionCtor()
}

// Listens for one spoken phrase. Returns a function that stops listening early, or null if unsupported.
export function listenOnce(onText: (text: string) => void, onEnd?: () => void): (() => void) | null {
  const Ctor = getRecognitionCtor()
  if (!Ctor) return null
  stopSpeaking()
  const rec = new Ctor()
  rec.lang = 'en-US'
  rec.interimResults = false
  rec.continuous = false
  rec.onresult = (e: any) => {
    const text = String(e?.results?.[0]?.[0]?.transcript ?? '').trim()
    if (text) onText(text)
  }
  rec.onerror = () => onEnd?.()
  rec.onend = () => onEnd?.()
  rec.start()
  return () => rec.stop()
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

// A button press starts this directly, so it always runs from a user tap. Used to test the voice in isolation.
export function testVoice(): void {
  console.info('[Elara] test voice pressed')
  speakAloud(
    'Hello, this is Elara. Can you hear me?',
    () => console.info('[Elara] test voice started'),
    (completed) => console.info('[Elara] test voice finished, completed =', completed),
  )
}
