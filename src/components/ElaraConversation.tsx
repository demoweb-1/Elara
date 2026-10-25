import { useState, type CSSProperties, type ReactNode } from 'react'
import { isDefaultShared } from '@/lib/sharing'
import { cn } from '@/lib/utils'
import type { MemoryCategory } from '@/types'

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

type Stage = 'welcome' | 'question' | 'confirm' | 'summary'

export function ElaraConversation({ onDone }: { onDone: (answers: ElaraAnswer[]) => void }) {
  const [stage, setStage] = useState<Stage>('welcome')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, ElaraAnswer>>({})
  const [pending, setPending] = useState<{ qid: string; label: string; value: string } | null>(null)
  const [otherOpen, setOtherOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [editing, setEditing] = useState(false)
  const q = QUESTIONS[index]

  function resetInput() {
    setPending(null); setOtherOpen(false); setTyped('')
  }

  function advance(from: number) {
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

  const ordered = QUESTIONS.map((x) => answers[x.id]).filter(Boolean) as ElaraAnswer[]

  if (stage === 'welcome') {
    return (
      <Shell>
        <div className="elara-orb-mini is-idle" style={{ width: 132, height: 132 }} />
        <h1 className="gm-rise" style={h1}>Hey, I&apos;m Elara.</h1>
        <p style={sub}>
          Let&apos;s get to know you a little better. I&apos;ll ask one question at a time. Tap an answer, or type your own.
        </p>
        <PrimaryButton onClick={() => setStage('question')}>Start</PrimaryButton>
      </Shell>
    )
  }

  if (stage === 'question' && q) {
    return (
      <Shell>
        <Eyebrow>Question {index + 1} of {QUESTIONS.length}</Eyebrow>
        <h1 style={{ ...h1, fontSize: 26, marginTop: 24 }}>{q.ask}</h1>

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
            <button
              onClick={submitTyped}
              disabled={!typed.trim()}
              className="min-h-[48px] w-full rounded-full text-[15px] font-semibold disabled:opacity-40"
              style={{ background: RED, color: INK }}
            >
              Send
            </button>
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
        <Eyebrow>Is this right?</Eyebrow>
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
        Likes and dislikes can be shared with your partner once you are linked. Everything else stays private. You can edit or delete any of it in Memories.
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
        className={cn('relative mx-auto flex min-h-full max-w-md flex-col items-center justify-center px-6 text-center')}
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

function AnswerCard({ label, onClick, muted }: { label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="gm-card w-full rounded-2xl px-5 py-4 text-left text-[15px] font-medium"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: muted ? MUTED : WARM }}
    >
      {label}
    </button>
  )
}
