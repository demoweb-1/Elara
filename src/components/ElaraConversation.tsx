import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Volume2, VolumeX, RotateCcw } from 'lucide-react'
import type { MemoryCategory } from '@/types'
import { isDefaultShared } from '@/lib/sharing'
import { cn } from '@/lib/utils'
import { getVoiceMode, setVoiceMode, prepareNaturalVoice, releaseNaturalVoice, speakAloud, stopSpeaking, type VoiceMode } from '@/lib/elaraVoice'

// Dark, intimate palette shared with the Guess Me game.
const RED = '#FF3B4F'
const INK = '#080809'
const WARM = '#F5F5F7'
const MUTED = '#A1A1AA'
const BORDER = '#29292E'

export type ElaraAnswer = { questionId: string; label: string; category: MemoryCategory; value: string }

type Question = { id: string; label: string; ask: string; category: MemoryCategory; options: string[]; optional: boolean }

const QUESTIONS: Question[] = [
  { id: 'free_time', label: 'Free time', ask: 'How do you usually like to spend your free time?', category: 'preferences', optional: false,
    options: ['Quiet time at home', 'Going out and exploring', 'Spending time with friends', 'A little bit of everything'] },
  { id: 'food', label: 'Favourite kind of food', ask: 'What kind of food makes you happiest?', category: 'preferences', optional: true,
    options: ['Something sweet', 'Comfort food from home', 'Trying new places', 'Simple and fresh'] },
  { id: 'appreciated', label: 'Feels most appreciated when', ask: 'What makes you feel most appreciated?', category: 'communication_preferences', optional: true,
    options: ['Kind words', 'Thoughtful gestures', 'Quality time together', 'Helping hands'] },
  { id: 'unwind', label: 'Unwinds after a long day', ask: 'How do you usually unwind after a long day?', category: 'habits_routines', optional: true,
    options: ['Quiet time alone', 'Talking it through', 'Moving my body', 'Something creative'] },
  { id: 'drains', label: 'Mood drops when', ask: 'What tends to drain your mood the most?', category: 'dislikes', optional: true,
    options: ['Plans changing last minute', 'Crowded, noisy places', 'Feeling rushed', 'Being interrupted'] },
]

const GREETING_LINE = `Hey, I'm Elara. Let's get to know you a little better. ${QUESTIONS[0].ask}`

type Stage = 'welcome' | 'question' | 'confirm' | 'summary'
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: any) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function ElaraConversation({ onDone }: { onDone: (answers: ElaraAnswer[]) => void }) {
  const [stage, setStage] = useState<Stage>('welcome')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, ElaraAnswer>>({})
  const [pending, setPending] = useState<{ qid: string; label: string; value: string } | null>(null)
  const [otherOpen, setOtherOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [muted, setMuted] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [editing, setEditing] = useState(false)
  const [voice, setVoice] = useState<VoiceMode>(getVoiceMode)
  const [preparing, setPreparing] = useState(false)
  const [voicePct, setVoicePct] = useState<number | null>(null)
  const [voiceNote, setVoiceNote] = useState('')
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const skipNextSpeak = useRef(false)
  const canListen = !!getRecognitionCtor()
  const q = QUESTIONS[index]

  useEffect(() => () => { releaseNaturalVoice(); recRef.current?.stop() }, [])

  // Each question is spoken as it appears. The Start tap already spoke the first one.
  useEffect(() => {
    if (skipNextSpeak.current) { skipNextSpeak.current = false; return }
    if (stage === 'question' && q && !muted) speakAloud(q.ask, () => setSpeaking(true), () => setSpeaking(false))
    if (stage !== 'question') setSpeaking(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, index])

  function chooseVoice(mode: VoiceMode) {
    setVoiceMode(mode)
    setVoice(mode)
    setVoiceNote('')
  }

  async function start() {
    // Speaking from a tap is what lets phones play sound, so the first line is spoken here.
    if (voice === 'natural') {
      setPreparing(true)
      setVoicePct(0)
      setVoiceNote('')
      try {
        await prepareNaturalVoice(setVoicePct, [GREETING_LINE, ...QUESTIONS.map((x) => x.ask)])
      } catch {
        setVoiceNote('The natural voice could not load on this connection, so Elara will use the standard voice.')
      }
      setPreparing(false)
    }
    if (!muted) {
      skipNextSpeak.current = true
      speakAloud(GREETING_LINE, () => setSpeaking(true), () => setSpeaking(false))
    }
    setIndex(0)
    setStage('question')
  }

  function toggleMute() {
    if (!muted) { stopSpeaking(); setSpeaking(false) }
    setMuted(!muted)
  }

  function replay() {
    if (q && !muted) speakAloud(q.ask, () => setSpeaking(true), () => setSpeaking(false))
  }

  function resetInput() {
    setPending(null); setOtherOpen(false); setTyped('')
  }

  function advance(from: number) {
    stopSpeaking()
    resetInput()
    if (editing) { setEditing(false); setStage('summary'); return }
    if (from + 1 < QUESTIONS.length) { setIndex(from + 1); setStage('question') } else setStage('summary')
  }

  function save(qid: string, value: string) {
    const qi = QUESTIONS.findIndex((x) => x.id === qid)
    if (qi < 0) return
    const question = QUESTIONS[qi]
    setAnswers((prev) => ({ ...prev, [qid]: { questionId: qid, label: question.label, category: question.category, value } }))
    advance(qi)
  }

  function submitTyped() {
    const t = typed.trim()
    if (!t || !q) return
    setPending({ qid: q.id, label: q.label, value: t.slice(0, 300) })
    setStage('confirm')
  }

  function listen() {
    const Ctor = getRecognitionCtor()
    if (!Ctor || !q) return
    stopSpeaking()
    const rec = new Ctor()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = (e: any) => {
      const text = String(e?.results?.[0]?.[0]?.transcript ?? '').trim()
      if (text) { setPending({ qid: q.id, label: q.label, value: text.slice(0, 300) }); setStage('confirm') }
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  function stopListen() {
    recRef.current?.stop()
    setListening(false)
  }

  function confirmYes() {
    if (pending) save(pending.qid, pending.value)
    else setStage('question')
  }

  function tryAgain() {
    if (pending) setTyped(pending.value)
    setPending(null)
    setOtherOpen(true)
    setStage('question')
  }

  function change(qid: string) {
    const i = QUESTIONS.findIndex((x) => x.id === qid)
    if (i < 0) return
    setAnswers((prev) => { const next = { ...prev }; delete next[qid]; return next })
    resetInput()
    setEditing(true)
    setIndex(i)
    setStage('question')
  }

  function remove(qid: string) {
    setAnswers((prev) => { const next = { ...prev }; delete next[qid]; return next })
  }

  const orbClass = cn('elara-orb', speaking && 'elara-speak', listening && 'elara-listen')
  const ordered = QUESTIONS.map((x) => answers[x.id]).filter(Boolean) as ElaraAnswer[]

  if (stage === 'welcome') {
    return (
      <Shell>
        <div className={orbClass} />
        <h1 className="gm-rise" style={h1}>Hey, I&apos;m Elara.</h1>
        <p style={sub}>
          Let&apos;s get to know you a little better. I&apos;ll ask one question at a time. Tap an answer, speak it, or type your own.
        </p>

        <div className="mt-8 w-full">
          <p className="mb-2 text-xs" style={{ color: MUTED }}>Elara&apos;s voice</p>
          <div role="radiogroup" aria-label="Elara's voice" className="grid grid-cols-2 gap-3">
            <VoiceChoice selected={voice === 'standard'} title="Standard" detail="Instant. Nothing to download." onClick={() => chooseVoice('standard')} />
            <VoiceChoice selected={voice === 'natural'} title="Natural" detail="Downloads once, about 90 MB." onClick={() => chooseVoice('natural')} />
          </div>
        </div>

        {voiceNote && <p className="mt-4 text-xs" style={{ color: MUTED }}>{voiceNote}</p>}

        {preparing ? (
          <p aria-live="polite" className="mt-8 text-sm" style={{ color: WARM }}>
            Preparing Elara&apos;s voice{voicePct !== null ? `… ${voicePct}%` : '…'}
          </p>
        ) : (
          <PrimaryButton onClick={start}>Start</PrimaryButton>
        )}
        <p className="mt-6 text-xs" style={{ color: MUTED }}>I&apos;ll read each question aloud. You can mute me at any time.</p>
      </Shell>
    )
  }

  if (stage === 'question' && q) {
    return (
      <Shell>
        <div className="flex w-full items-center justify-between">
          <Eyebrow>Question {index + 1} of {QUESTIONS.length}</Eyebrow>
          <div className="flex gap-2">
            <IconBtn label={muted ? 'Unmute Elara' : 'Mute Elara'} pressed={muted} onClick={toggleMute}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </IconBtn>
            <IconBtn label="Hear the question again" onClick={replay}>
              <RotateCcw className="h-4 w-4" />
            </IconBtn>
          </div>
        </div>
        <div className={orbClass} style={{ width: 96, height: 96, marginTop: 24 }} />
        <h1 aria-live="polite" style={{ ...h1, fontSize: 26 }}>{q.ask}</h1>

        {!otherOpen ? (
          <div className="mt-6 w-full space-y-3">
            {q.options.map((opt) => (
              <AnswerCard key={opt} label={opt} onClick={() => save(q.id, opt)} />
            ))}
            <AnswerCard label="Other, tell Elara" muted onClick={() => setOtherOpen(true)} />
            {q.optional && (
              <button onClick={() => advance(index)} className="mt-4 min-h-[44px] text-sm" style={{ color: MUTED }}>
                Skip this one
              </button>
            )}
          </div>
        ) : (
          <div className="mt-6 w-full space-y-3">
            <textarea
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              maxLength={300}
              rows={3}
              aria-label="Tell Elara in your own words"
              placeholder="Tell Elara in your own words"
              className="w-full resize-none rounded-2xl p-4 text-[15px] outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: WARM }}
            />
            <div className="flex gap-3">
              <button
                onClick={submitTyped}
                disabled={!typed.trim()}
                className="min-h-[48px] flex-1 rounded-full text-[15px] font-semibold disabled:opacity-40"
                style={{ background: RED, color: INK }}
              >
                Send
              </button>
              {canListen && (
                <button
                  onClick={listening ? stopListen : listen}
                  aria-pressed={listening}
                  className="min-h-[48px] rounded-full px-5 text-[15px] font-medium"
                  style={{ border: `1px solid ${listening ? RED : BORDER}`, color: listening ? RED : WARM }}
                >
                  {listening ? 'Stop' : 'Speak'}
                </button>
              )}
            </div>
            {listening && <p aria-live="polite" className="text-sm" style={{ color: RED }}>Listening. Tap Stop when you&apos;re done.</p>}
            <button onClick={() => { setOtherOpen(false); setTyped('') }} className="min-h-[44px] text-sm" style={{ color: MUTED }}>
              Back to options
            </button>
          </div>
        )}
      </Shell>
    )
  }

  if (stage === 'confirm' && pending) {
    return (
      <Shell>
        <Eyebrow>Did I hear that right?</Eyebrow>
        <div className="w-full rounded-2xl p-5 text-left" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}` }}>
          <p className="mb-2 text-xs" style={{ color: MUTED }}>{pending.label}</p>
          <p className="text-base" style={{ color: WARM }}>{pending.value}</p>
        </div>
        <PrimaryButton onClick={confirmYes}>Yes, that&apos;s right</PrimaryButton>
        <button onClick={tryAgain} className="mt-4 min-h-[44px] text-sm" style={{ color: MUTED }}>Try again</button>
      </Shell>
    )
  }

  // Profile summary: review, change or remove before anything is saved.
  return (
    <Shell>
      <Eyebrow>Your profile</Eyebrow>
      <h1 style={{ ...h1, fontSize: 28 }}>Here&apos;s what Elara learned about you.</h1>
      <div className="mt-6 w-full space-y-3">
        {ordered.length === 0 && (
          <p className="text-sm" style={{ color: MUTED }}>Nothing saved yet. You can add more anytime from Memories.</p>
        )}
        {ordered.map((a) => (
          <div key={a.questionId} className="rounded-2xl p-4 text-left" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}` }}>
            <p className="text-xs" style={{ color: MUTED }}>
              {a.label} · {isDefaultShared(a.category) ? 'Shared with your partner once linked' : 'Private'}
            </p>
            <p className="mt-1 text-[15px]" style={{ color: WARM }}>{a.value}</p>
            <div className="mt-3 flex gap-5 text-sm">
              <button onClick={() => change(a.questionId)} style={{ color: WARM }}>Change</button>
              <button onClick={() => remove(a.questionId)} style={{ color: RED }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs leading-relaxed" style={{ color: MUTED }}>
        Likes and dislikes can be shared with your partner once you are linked. Everything else stays private. Elara does not keep recordings, only the answers you confirmed. You can edit or delete any of it in Memories.
      </p>
      <PrimaryButton onClick={() => onDone(ordered)}>Looks right, continue</PrimaryButton>
    </Shell>
  )
}

const h1: CSSProperties = { color: WARM, fontSize: 32, lineHeight: 1.15, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 24 }
const sub: CSSProperties = { color: MUTED, fontSize: 16, lineHeight: 1.5, marginTop: 12 }

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: INK, color: WARM }}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(60% 40% at 50% 0%, rgba(255,59,79,0.22), transparent 70%)' }}
      />
      <div
        className="relative mx-auto flex min-h-full max-w-md flex-col items-center justify-center px-6 text-center"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: RED }}>{children}</p>
}

function PrimaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-8 min-h-[52px] w-full max-w-xs rounded-full px-6 text-[15px] font-semibold"
      style={{ background: RED, color: INK, boxShadow: '0 0 28px rgba(255,59,79,0.4)' }}
    >
      {children}
    </button>
  )
}

function VoiceChoice({ selected, title, detail, onClick }: { selected: boolean; title: string; detail: string; onClick: () => void }) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className="gm-card rounded-2xl px-4 py-3 text-left"
      style={{
        background: selected ? 'rgba(255,59,79,0.10)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${selected ? RED : BORDER}`,
        boxShadow: selected ? '0 0 20px rgba(255,59,79,0.3)' : 'none',
      }}
    >
      <span className="block text-[15px] font-medium" style={{ color: WARM }}>{title}</span>
      <span className="mt-1 block text-xs" style={{ color: MUTED }}>{detail}</span>
    </button>
  )
}

function IconBtn({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="flex h-10 w-10 items-center justify-center rounded-full"
      style={{ background: 'rgba(255,255,255,0.06)', color: MUTED }}
    >
      {children}
    </button>
  )
}

function AnswerCard({ label, onClick, muted }: { label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="gm-card w-full rounded-2xl px-5 py-4 text-left text-[15px] font-medium"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${BORDER}`,
        color: muted ? MUTED : WARM,
      }}
    >
      {label}
    </button>
  )
}
