import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { PageSkeleton } from '@/components/ui/Skeletons'
import { cn } from '@/lib/utils'
import {
  getConnectionId, getQuestion, guessMeState, guessMeBegin, guessMeAnswer, guessMeClose, type GuessState,
} from '@/lib/guessMe'

// Dark, cinematic palette for this game only. The rest of Elara stays light.
const RED = '#FF3B4F'
const INK = '#080809'
const WARM = '#F5F5F7'
const MUTED = '#A1A1AA'
const BORDER = '#29292E'

const h1Style = { color: WARM, fontSize: 32, lineHeight: 1.15, fontWeight: 600, letterSpacing: '-0.02em' }
const subStyle = { color: MUTED, fontSize: 16, lineHeight: 1.5, marginTop: 12 }

export function GuessMe() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [connId, setConnId] = useState<string | null | undefined>(undefined)
  const [state, setState] = useState<GuessState | null>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState(false)

  const refresh = useCallback(async (id: string) => {
    try {
      setState(await guessMeState(id))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => { if (user) getConnectionId(user.id).then(setConnId) }, [user])
  useEffect(() => { if (connId) refresh(connId) }, [connId, refresh])

  const round = state?.round ?? null
  const isRevealed = round?.status === 'revealed'
  const waitingOnPartner = !!round && round.status === 'open' && state?.me?.self != null && state?.me?.guess != null

  // While waiting, check quietly so the reveal appears on both phones without a refresh.
  useEffect(() => {
    if (!connId || !waitingOnPartner) return
    const t = window.setInterval(() => refresh(connId), 3000)
    return () => window.clearInterval(t)
  }, [connId, waitingOnPartner, refresh])

  // The reveal opens after a short pause, so the cards feel like they are being unveiled.
  useEffect(() => {
    if (!isRevealed) { setRevealed(false); return }
    const t = window.setTimeout(() => setRevealed(true), 900)
    return () => window.clearTimeout(t)
  }, [isRevealed, round?.id])

  const close = () => navigate('/together')

  async function run(action: () => Promise<GuessState>) {
    setBusy(true)
    setError('')
    try {
      setState(await action())
      setChoice(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (connId === undefined) return <PageSkeleton />

  if (connId === null) {
    return (
      <Shell onClose={close}>
        <Eyebrow>Guess Me</Eyebrow>
        <h1 style={h1Style}>Connect with your partner first.</h1>
        <p style={subStyle}>Guess Me is played together, so link your accounts to begin.</p>
        <PrimaryButton onClick={close}>Go to Together</PrimaryButton>
      </Shell>
    )
  }

  if (!state) {
    return <Shell onClose={close}><p style={subStyle}>{error || 'Loading…'}</p></Shell>
  }

  const partner = state.partner_name

  // Screen A: the invitation
  if (!round) {
    return (
      <Shell onClose={close}>
        <Glow />
        <Eyebrow>Guess Me</Eyebrow>
        <h1 className="gm-rise" style={h1Style}>There&apos;s more to discover.</h1>
        <p className="gm-rise" style={{ ...subStyle, animationDelay: '120ms' }}>
          See how well you understand each other&apos;s little world.
        </p>
        <PrimaryButton disabled={busy} onClick={() => run(() => guessMeBegin(connId))}>
          Begin the discovery
        </PrimaryButton>
        <ErrorText text={error} />
      </Shell>
    )
  }

  const q = getQuestion(round.question_id)
  if (!q) {
    return (
      <Shell onClose={close}>
        <h1 style={h1Style}>This round is no longer available.</h1>
        <PrimaryButton disabled={busy} onClick={() => run(() => guessMeClose(connId, round.id))}>Done</PrimaryButton>
      </Shell>
    )
  }

  // Screen D: the reveal
  if (isRevealed && state.reveal) {
    const r = state.reveal
    const rows = [
      {
        left: 'You guessed', leftText: q.options[r.my_guess],
        right: `${partner} chose`, rightText: q.options[r.partner_self],
        matched: r.my_guess === r.partner_self,
      },
      {
        left: `${partner} guessed`, leftText: q.options[r.partner_guess],
        right: 'You chose', rightText: q.options[r.my_self],
        matched: r.partner_guess === r.my_self,
      },
    ]
    const matches = rows.filter((x) => x.matched).length
    const headline = matches === 2 ? 'You matched on both.'
      : matches === 1 ? 'You matched on one.'
      : 'Different answers, a good place to talk.'

    return (
      <Shell onClose={close}>
        <Eyebrow>Revealed</Eyebrow>
        <h1 style={{ ...h1Style, fontSize: 28 }}>{headline}</h1>
        <p style={subStyle}>{q.partnerPrompt}</p>
        <div className="mt-6 w-full space-y-6">
          {rows.map((row, i) => (
            <div key={i} className="relative overflow-hidden">
              <div className="grid grid-cols-2 gap-3">
                <RevealCard title={row.left} text={row.leftText} shown={revealed} delay={i * 180} />
                <RevealCard title={row.right} text={row.rightText} shown={revealed} delay={i * 180 + 90} />
              </div>
              {revealed && (
                <>
                  <div aria-hidden className="gm-sweep pointer-events-none absolute inset-0 rounded-2xl" />
                  <div className="mt-3 flex items-center gap-3">
                    <div
                      className={cn('h-px flex-1', row.matched && 'gm-bridge')}
                      style={{ background: row.matched
                        ? `linear-gradient(90deg, transparent, ${RED}, transparent)`
                        : `linear-gradient(90deg, transparent, ${BORDER}, transparent)` }}
                    />
                    <span className="text-xs" style={{ color: row.matched ? RED : MUTED }}>
                      {row.matched ? 'Matched' : 'A little different'}
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <PrimaryButton disabled={busy || !revealed} onClick={() => run(() => guessMeClose(connId, round.id))}>
          Done
        </PrimaryButton>
        <ErrorText text={error} />
      </Shell>
    )
  }

  // Screen C: waiting for the partner. Calm, no countdown, never implies they are ignoring you.
  if (waitingOnPartner) {
    const started = state.partner_progress?.self || state.partner_progress?.guess
    return (
      <Shell onClose={close}>
        <Glow pulse />
        <Eyebrow>Guess Me</Eyebrow>
        <h1 style={h1Style}>Your answers are saved.</h1>
        <p style={subStyle}>We&apos;ll reveal them together once {partner} has answered too.</p>
        <p className="mt-6 text-sm" style={{ color: MUTED }}>
          {started ? `${partner} has started answering.` : `${partner} will answer when they are ready. Take your time.`}
        </p>
        <button onClick={close} className="mt-10 text-sm font-medium" style={{ color: MUTED }}>
          Back to Together
        </button>
      </Shell>
    )
  }

  // Screen B: answering. Predict the partner first, then answer for yourself.
  const step: 'guess' | 'self' = state.me?.guess == null ? 'guess' : 'self'
  const prompt = step === 'guess' ? q.partnerPrompt : q.selfPrompt
  const stepLabel = step === 'guess' ? `Predict ${partner}'s answer` : 'Now your own answer'

  return (
    <Shell onClose={close}>
      <Eyebrow>{step === 'guess' ? 'Step 1 of 2' : 'Step 2 of 2'}</Eyebrow>
      <h1 style={{ ...h1Style, fontSize: 28 }}>{prompt}</h1>
      <p style={subStyle}>{stepLabel}</p>
      <div role="radiogroup" aria-label={prompt} className="mt-6 w-full space-y-3">
        {q.options.map((opt, i) => {
          const selected = choice === i
          return (
            <button
              key={i}
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(i)}
              className="gm-card w-full rounded-2xl px-5 py-4 text-left text-[15px] font-medium"
              style={{
                background: selected ? 'rgba(255,59,79,0.10)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${selected ? RED : BORDER}`,
                color: WARM,
                boxShadow: selected ? '0 0 24px rgba(255,59,79,0.35)' : 'none',
                transform: selected ? 'translateY(-2px)' : 'none',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
      <PrimaryButton
        disabled={choice === null || busy}
        onClick={() => run(() => guessMeAnswer(connId, round.id, step, choice as number))}
      >
        Continue
      </PrimaryButton>
      <ErrorText text={error} />
    </Shell>
  )
}

function Shell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: INK, color: WARM }}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(60% 40% at 50% 0%, rgba(255,59,79,0.22), transparent 70%)' }}
      />
      <button
        onClick={onClose}
        aria-label="Close"
        className="fixed right-4 z-10 rounded-full p-2"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)', background: 'rgba(255,255,255,0.06)', color: MUTED }}
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="relative mx-auto flex min-h-full max-w-md flex-col items-center justify-center px-6 text-center"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em]" style={{ color: RED }}>
      {children}
    </p>
  )
}

function Glow({ pulse = false }: { pulse?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn('mb-8 h-28 w-28 rounded-full', pulse ? 'gm-glow-orb' : 'gm-rise')}
      style={{
        background: `radial-gradient(circle at 35% 35%, rgba(255,120,135,0.95), ${RED} 45%, rgba(255,59,79,0.15) 72%, transparent 73%)`,
        boxShadow: '0 0 60px rgba(255,59,79,0.45)',
      }}
    />
  )
}

function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-8 min-h-[52px] w-full max-w-xs rounded-full px-6 text-[15px] font-semibold transition disabled:opacity-40"
      style={{ background: RED, color: INK, boxShadow: '0 0 28px rgba(255,59,79,0.4)' }}
    >
      {children}
    </button>
  )
}

function ErrorText({ text }: { text: string }) {
  if (!text) return null
  return <p role="alert" className="mt-4 text-sm" style={{ color: RED }}>{text}</p>
}

function RevealCard({ title, text, shown, delay }: { title: string; text: string; shown: boolean; delay: number }) {
  return (
    <div
      className="gm-card rounded-2xl p-4 text-left"
      style={{
        background: shown ? 'rgba(255,255,255,0.05)' : 'linear-gradient(145deg, rgba(255,59,79,0.18), rgba(255,255,255,0.03))',
        border: `1px solid ${BORDER}`,
        opacity: shown ? 1 : 0.4,
        filter: shown ? 'none' : 'blur(6px)',
        transform: shown ? 'none' : 'translateY(8px) scale(0.98)',
        transition: 'opacity 0.7s ease, filter 0.9s ease, transform 0.9s cubic-bezier(0.2,0.7,0.2,1)',
        transitionDelay: `${delay}ms`,
      }}
    >
      <p className="mb-2 text-xs" style={{ color: MUTED }}>{title}</p>
      <p className="text-sm font-medium leading-snug" style={{ color: WARM }}>{text}</p>
    </div>
  )
}
