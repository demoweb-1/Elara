import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Sparkles, Check, Copy, AlertCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { checkInvite, inviteAction } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Phase = 'loading' | 'valid' | 'expired' | 'revoked' | 'accepted' | 'invalid' | 'code-entry' | 'confirming' | 'connecting' | 'connected' | 'error'

export function InvitationLanding() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()
  const [phase, setPhase] = useState<Phase>('loading')
  const [inviterName, setInviterName] = useState('')
  const [inviterEmoji, setInviterEmoji] = useState('🌿')
  const [pairingCode, setPairingCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [myName, setMyName] = useState('')
  const [myEmoji, setMyEmoji] = useState('🌿')
  const codeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (authLoading) return
    if (!session) return

    (async () => {
      const { data: profile } = await supabase
        .from('profiles').select('display_name, avatar_emoji').eq('id', session.user.id).maybeSingle()
      if (profile) {
        setMyName((profile as any).display_name || 'You')
        setMyEmoji((profile as any).avatar_emoji || '🌿')
      }
    })()
  }, [session, authLoading])

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await checkInvite(token)
      if (!active) return

      if (error || !data) {
        setPhase('invalid')
        return
      }

      if (!data.valid) {
        if (data.reason === 'expired') setPhase('expired')
        else if (data.reason === 'accepted') setPhase('accepted')
        else if (data.reason === 'revoked') setPhase('revoked')
        else setPhase('invalid')
        return
      }

      setInviterName(data.inviterName || 'Someone')
      setInviterEmoji(data.inviterEmoji || '🌿')

      if (session) {
        setPhase('code-entry')
      } else {
        setPhase('valid')
      }
    })()
    return () => { active = false }
  }, [token, session])

  const handleValidateCode = async () => {
    if (!pairingCode.trim()) {
      setCodeError('Please enter the pairing code')
      return
    }
    setPhase('confirming')
    setCodeError('')

    const { data, error } = await inviteAction('validate_code', { token, pairingCode: pairingCode.trim() })

    if (error || !data) {
      setCodeError(error || 'Validation failed')
      setPhase('code-entry')
      return
    }

    if (!data.valid) {
      setCodeError(data.error || 'The pairing code does not match')
      setPhase('code-entry')
      return
    }

    setInviterName(data.inviterName || inviterName)
    setInviterEmoji(data.inviterEmoji || inviterEmoji)
    setPhase('confirming')
  }

  const handleConfirmConnect = async () => {
    setPhase('connecting')
    const { data, error } = await inviteAction('accept', { token, pairingCode: pairingCode.trim() })

    if (error || !data || !data.success) {
      setCodeError(error || data?.error || 'Failed to connect')
      setPhase('code-entry')
      return
    }

    setPhase('connected')
    setTimeout(() => navigate('/together'), 2500)
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode.toUpperCase())
  }

  const normalizeCode = (val: string) => {
    return val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'transparent' }}>
      {/* Ambient rose glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-40 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(200,24,63,0.12), transparent 70%)' }} />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Brand mark */}
          <div className="flex items-center justify-center gap-2 mb-8 animate-fade-in">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#C8183F' }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold" style={{ color: '#1D1317' }}>Elara</span>
          </div>

          {phase === 'loading' && (
            <div className="glass-panel rounded-3xl p-8 text-center animate-fade-in">
              <div className="w-8 h-8 mx-auto border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin" style={{ borderTopColor: '#C8183F' }} />
              <p className="text-sm mt-4" style={{ color: '#6A5A60' }}>Checking your invitation…</p>
            </div>
          )}

          {phase === 'valid' && !session && (
            <div className="glass-panel rounded-3xl p-8 animate-fade-in">
              <ConnectionIllustration leftEmoji={inviterEmoji} rightEmoji="?" />
              <h1 className="text-xl font-semibold text-center mt-6 mb-2" style={{ color: '#1D1317' }}>
                You've been invited to connect
              </h1>
              <p className="text-sm text-center leading-relaxed mb-6" style={{ color: '#6A5A60' }}>
                {inviterName} wants to link your Elara accounts so you can share approved memories and better understand each other.
              </p>
              <Link to={`/auth?redirect=${encodeURIComponent('/invite/' + token)}`}
                className="glass-button-primary w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium mb-3 transition-all">
                Sign in to continue
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to={`/auth?mode=signup&redirect=${encodeURIComponent('/invite/' + token)}`}
                className="glass-button-secondary w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all">
                Create an account
              </Link>
              <p className="text-xs text-center mt-5 leading-relaxed" style={{ color: '#6A5A60' }}>
                Connecting requires both people to have accounts and to consent. Your private conversations stay private.
              </p>
            </div>
          )}

          {phase === 'code-entry' && session && (
            <div className="glass-panel rounded-3xl p-8 animate-fade-in">
              <ConnectionIllustration leftEmoji={inviterEmoji} rightEmoji={myEmoji} />
              <h1 className="text-xl font-semibold text-center mt-6 mb-2" style={{ color: '#1D1317' }}>
                Enter the pairing code
              </h1>
              <p className="text-sm text-center leading-relaxed mb-6" style={{ color: '#6A5A60' }}>
                {inviterName} shared a 6-character code with you. Enter it below to continue.
              </p>

              <div className="flex justify-center mb-4">
                <input
                  ref={codeInputRef}
                  type="text"
                  value={pairingCode}
                  onChange={(e) => { setPairingCode(normalizeCode(e.target.value)); setCodeError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && pairingCode.length === 6) handleValidateCode() }}
                  placeholder="ABC123"
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="glass-input text-center text-2xl font-mono tracking-[0.5em] rounded-xl px-4 py-3 w-48"
                  style={{ color: '#1D1317' }}
                  aria-label="Pairing code"
                />
              </div>

              {codeError && (
                <div className="flex items-center gap-2 text-sm mb-4 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#9B1C1C' }}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{codeError}</span>
                </div>
              )}

              <button
                onClick={handleValidateCode}
                disabled={pairingCode.length !== 6}
                className="glass-button-primary w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-xs text-center mt-5 leading-relaxed" style={{ color: '#6A5A60' }}>
                The code was shown to {inviterName} when they created the invitation. Ask them to share it with you.
              </p>
            </div>
          )}

          {phase === 'confirming' && (
            <div className="glass-panel rounded-3xl p-8 animate-fade-in">
              <div className="flex items-center justify-center gap-4 mb-6">
                <ProfileCircle emoji={inviterEmoji} name={inviterName} />
                <ConnectionLine />
                <ProfileCircle emoji={myEmoji} name={myName} />
              </div>
              <h1 className="text-xl font-semibold text-center mb-2" style={{ color: '#1D1317' }}>Ready to connect?</h1>
              <p className="text-sm text-center leading-relaxed mb-6" style={{ color: '#6A5A60' }}>
                Connecting links your accounts for shared relationship features like approved memory sharing. Your private conversations and memories stay completely private.
              </p>
<p className="text-xs text-center leading-relaxed" style={{ color: '#6A5A60' }}>Once you link, your likes and dislikes are shared with each other by default. You can make any of them private at any time.</p>
              <button
                onClick={handleConfirmConnect}
                className="glass-button-primary w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all">
                <Check className="w-4 h-4" />
                Confirm connection
              </button>
              <button
                onClick={() => { setPhase('code-entry'); setCodeError('') }}
                className="w-full text-center text-sm mt-3 py-2 transition-colors" style={{ color: '#6A5A60' }}>
                Not now
              </button>
            </div>
          )}

          {phase === 'connecting' && (
            <div className="glass-panel rounded-3xl p-8 text-center animate-fade-in">
              <div className="w-8 h-8 mx-auto border-2 border-rose-200 rounded-full animate-spin" style={{ borderTopColor: '#C8183F' }} />
              <p className="text-sm mt-4" style={{ color: '#6A5A60' }}>Establishing your connection…</p>
            </div>
          )}

          {phase === 'connected' && (
            <div className="glass-panel rounded-3xl p-8 text-center animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(34,197,94,0.1)' }}>
                <Check className="w-8 h-8" style={{ color: '#22C55E' }} />
              </div>
              <h1 className="text-xl font-semibold mb-2" style={{ color: '#1D1317' }}>You're connected!</h1>
              <p className="text-sm" style={{ color: '#6A5A60' }}>Taking you to your shared space…</p>
            </div>
          )}

          {phase === 'expired' && (
            <ErrorPanel
              title="This invitation has expired"
              message="Invitations last for 7 days. Ask your partner to create a new one."
              onBack={() => navigate('/')}
            />
          )}

          {phase === 'revoked' && (
            <ErrorPanel
              title="This invitation has been revoked"
              message="The sender cancelled this invitation. Ask them to create a new one."
              onBack={() => navigate('/')}
            />
          )}

          {phase === 'accepted' && (
            <ErrorPanel
              title="This invitation was already used"
              message="Each invitation can only be accepted once. If you're already connected, head to your shared space."
              onBack={() => navigate('/together')}
              backLabel="Go to Together"
            />
          )}

          {phase === 'invalid' && (
            <ErrorPanel
              title="This invitation isn't valid"
              message="The link may be broken or the invitation may no longer exist."
              onBack={() => navigate('/')}
            />
          )}

          {phase === 'error' && (
            <ErrorPanel
              title="Something went wrong"
              message="Please try again in a moment."
              onBack={() => window.location.reload()}
              backLabel="Retry"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ConnectionIllustration({ leftEmoji, rightEmoji }: { leftEmoji: string; rightEmoji: string }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl glass-panel-soft" style={{ border: '1px solid rgba(200,24,63,0.12)' }}>
        {leftEmoji}
      </div>
      <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
        <path d="M2 10 Q20 2 38 10" stroke="#C8183F" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" fill="none" />
        <circle cx="20" cy="6" r="2" fill="#C8183F" opacity="0.3" />
      </svg>
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl glass-panel-soft" style={{ border: '1px solid rgba(200,24,63,0.12)' }}>
        {rightEmoji}
      </div>
    </div>
  )
}

function ProfileCircle({ emoji, name }: { emoji: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl glass-panel" style={{ border: '1px solid rgba(255,255,255,0.8)' }}>
        {emoji}
      </div>
      <span className="text-xs font-medium" style={{ color: '#1D1317' }}>{name}</span>
    </div>
  )
}

function ConnectionLine() {
  return (
    <svg width="36" height="24" viewBox="0 0 36 24" fill="none" className="shrink-0">
      <path d="M2 12 Q18 4 34 12" stroke="#C8183F" strokeWidth="2" opacity="0.4" fill="none" />
      <circle cx="18" cy="8" r="3" fill="#C8183F" opacity="0.2" />
    </svg>
  )
}

function ErrorPanel({ title, message, onBack, backLabel = 'Back to Elara' }: { title: string; message: string; onBack: () => void; backLabel?: string }) {
  return (
    <div className="glass-panel rounded-3xl p-8 text-center animate-fade-in">
      <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(239,68,68,0.08)' }}>
        <AlertCircle className="w-7 h-7" style={{ color: '#9B1C1C' }} />
      </div>
      <h1 className="text-lg font-semibold mb-2" style={{ color: '#1D1317' }}>{title}</h1>
      <p className="text-sm leading-relaxed mb-6" style={{ color: '#6A5A60' }}>{message}</p>
      <button onClick={onBack} className="glass-button-secondary w-full rounded-xl py-3 text-sm font-medium transition-all">
        {backLabel}
      </button>
    </div>
  )
}
