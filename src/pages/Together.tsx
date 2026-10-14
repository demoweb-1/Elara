import { TogetherSkeleton } from '@/components/ui/Skeletons'
import { DEFAULT_SHARED_CATEGORIES } from '@/lib/sharing'
import { Overlap } from '@/components/Overlap'
import { useState, useEffect, useCallback } from 'react'
import {
  Heart, UserPlus, Copy, Check, Lock, Unlink, Sparkles, Share2,
  MessageCircle, Send, X, RefreshCw, Clock, Link2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { inviteAction, checkInvite, type InviteResponse } from '@/lib/api'
import { cn, relativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import type { Memory, MemoryShare, MemoryCategory } from '@/types'
import { CATEGORY_LABELS, CATEGORY_EMOJIS } from '@/types'

type ViewState = 'loading' | 'disconnected' | 'pending' | 'connected'

export function Together() {
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const [view, setView] = useState<ViewState>('loading')
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState('')
  const [partnerEmoji, setPartnerEmoji] = useState('')
  const [pendingExpiresAt, setPendingExpiresAt] = useState<string | null>(null)
  const [sharedMemories, setSharedMemories] = useState<Memory[]>([])
  const [myShares, setMyShares] = useState<MemoryShare[]>([])
  const [mySharedMemories, setMySharedMemories] = useState<Memory[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [enterCodeOpen, setEnterCodeOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<Memory | null>(null)

  const loadData = useCallback(async () => {
    if (!user) return
    setView('loading')

    const { data } = await inviteAction('get_connection', {})
    if (data?.error) {
      setView('disconnected')
      return
    }

    const conn = data?.connection as any
    if (!conn || conn.invitation_status === 'disconnected') {
      setView('disconnected')
      return
    }

    if (conn.invitation_status === 'pending') {
      setView('pending')
      setConnectionId(conn.id)
      setPendingExpiresAt(conn.expires_at)
      return
    }

    if (conn.invitation_status === 'accepted') {
      setView('connected')
      setConnectionId(conn.id)
      setPartnerName(data?.partnerName || 'your partner')
      setPartnerEmoji(data?.partnerEmoji || '🤝')

      const { data: shared } = await supabase.from('memories').select('*').neq('user_id', user.id)
      setSharedMemories((shared as Memory[]) || [])

      const { data: mySh } = await supabase.from('memory_shares').select('*').eq('owner_id', user.id).eq('status', 'active')
      setMyShares((mySh as MemoryShare[]) || [])
      if (mySh && mySh.length > 0) {
        const ids = (mySh as MemoryShare[]).map((s) => s.memory_id)
        const { data: myMems } = await supabase.from('memories').select('*').in('id', ids).eq('user_id', user.id)
        setMySharedMemories((myMems as Memory[]) || [])
      } else {
        setMySharedMemories([])
      }
      const { data: defMine } = await supabase.from('memories').select('*').eq('user_id', user.id).eq('is_private', false).in('category', DEFAULT_SHARED_CATEGORIES)
      setMySharedMemories((prev) => { const seen = new Set(prev.map((m) => m.id)); return [...prev, ...((defMine as Memory[]) || []).filter((m) => !seen.has(m.id))] })
      return
    }

    setView('disconnected')
  }, [user])

  useEffect(() => { if (user) loadData() }, [user, loadData])

  const handleDisconnect = async () => {
    if (!connectionId) return
    const { error } = await inviteAction('disconnect', { connectionId })
    if (error) { toast(error, 'error'); return }
    toast('Partner connection ended. All shared memories revoked.', 'success')
    setDisconnectOpen(false)
    setView('disconnected')
    setConnectionId(null)
    setPartnerName('')
    setPartnerEmoji('')
    setSharedMemories([])
    setMyShares([])
    setMySharedMemories([])
  }

  const handleRevokeShare = async () => {
    if (!revokeTarget) return
    const share = myShares.find((s) => s.memory_id === revokeTarget.id)
    const { error } = share ? await inviteAction('revoke_share', { shareId: share.id }) : await supabase.from('memories').update({ is_private: true }).eq('id', revokeTarget.id)
    if (error) { toast(typeof error === 'string' ? error : error.message, 'error'); return }
    toast('Share revoked', 'success')
    setRevokeTarget(null)
    loadData()
  }

  if (view === 'loading') {
    return <TogetherSkeleton />
  }

  return (
    <div className="min-h-full overflow-y-auto" style={{ background: 'transparent' }}>
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(200,24,63,0.1), transparent 70%)' }} />

      <div className="relative z-10 px-4 md:px-8 py-6 max-w-2xl mx-auto w-full">
        {/* Brand + heading */}
        <div className="flex items-center gap-2 mb-1 animate-fade-in">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#C8183F' }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#1D1317' }}>Elara</span>
        </div>

        {view === 'disconnected' && (
          <DisconnectedView
            onInvite={() => setInviteOpen(true)}
            onEnterCode={() => setEnterCodeOpen(true)}
          />
        )}

        {view === 'pending' && (
          <PendingView
            expiresAt={pendingExpiresAt}
            connectionId={connectionId}
            onRevoke={async () => {
              if (!connectionId) return
              const { error } = await inviteAction('revoke', { connectionId })
              if (error) { toast(error, 'error'); return }
              toast('Invitation revoked', 'success')
              loadData()
            }}
            onReplace={async () => {
              if (!connectionId) return
              const { error } = await inviteAction('revoke', { connectionId })
              if (error) { toast(error, 'error'); return }
              setInviteOpen(true)
            }}
            onReload={loadData}
          />
        )}

        {view === 'connected' && (
          <ConnectedView
            profile={profile}
            partnerName={partnerName}
            partnerEmoji={partnerEmoji}
            connectionId={connectionId}
            sharedMemories={sharedMemories}
            mySharedMemories={mySharedMemories}
            onChanged={loadData}
            onDisconnect={() => setDisconnectOpen(true)}
            onRevokeShare={(m) => setRevokeTarget(m)}
          />
        )}
      </div>

      <CreateInviteModal
        open={inviteOpen}
        onClose={() => { setInviteOpen(false); loadData() }}
      />

      <EnterCodeModal
        open={enterCodeOpen}
        onClose={() => setEnterCodeOpen(false)}
        onConnected={() => { setEnterCodeOpen(false); loadData() }}
      />

      <ConfirmDialog
        open={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        onConfirm={handleDisconnect}
        title="End your connection?"
        message="This will unlink your accounts and revoke all shared memories. Your private conversations and personal memories are not affected. You can reconnect later."
        confirmLabel="Disconnect"
        danger
      />

      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevokeShare}
        title="Revoke this share?"
        message="Your partner will no longer see this memory. They may have already seen it."
        confirmLabel="Revoke share"
        danger
      />
    </div>
  )
}

// === DISCONNECTED VIEW ===
function DisconnectedView({ onInvite, onEnterCode }: { onInvite: () => void; onEnterCode: () => void }) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: '#1D1317' }}>Your connection starts here.</h1>
      <p className="text-sm leading-relaxed mb-8" style={{ color: '#6A5A60' }}>
        Connect with your partner so Elara can understand your relationship and help you both remember what matters.
      </p>

      <div className="glass-panel rounded-3xl p-8 mb-4">
        <div className="flex items-center justify-center mb-6">
          <Overlap left="🌿" right="🤝" />
        </div>

        <button onClick={onInvite}
          className="glass-button-primary w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium mb-3 transition-all">
          <UserPlus className="w-4 h-4" />
          Invite your partner
        </button>
        <button onClick={onEnterCode}
          className="glass-button-secondary w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium transition-all">
          <Link2 className="w-4 h-4" />
          I have an invitation code
        </button>
      </div>

      <p className="text-xs text-center leading-relaxed px-6" style={{ color: '#6A5A60' }}>
        Connecting requires both people to consent. Elara never shares your private conversations with your partner.
      </p>
    </div>
  )
}

// === PENDING VIEW ===
function PendingView({
  expiresAt, connectionId, onRevoke, onReplace, onReload,
}: {
  expiresAt: string | null
  connectionId: string | null
  onRevoke: () => void
  onReplace: () => void
  onReload: () => void
}) {
  const [revokeConfirm, setRevokeConfirm] = useState(false)

  const expiryText = expiresAt
    ? `Expires ${relativeTime(expiresAt)}`
    : 'Expires in 7 days'

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: '#1D1317' }}>Invitation pending.</h1>
      <p className="text-sm leading-relaxed mb-6" style={{ color: '#6A5A60' }}>
        Your invitation is waiting to be accepted. Share the link or pairing code with your partner.
      </p>

      <div className="glass-panel rounded-3xl p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(200,24,63,0.1)' }}>
            <Clock className="w-5 h-5" style={{ color: '#C8183F' }} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: '#1D1317' }}>Awaiting acceptance</p>
            <p className="text-xs" style={{ color: '#6A5A60' }}>{expiryText}</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed mb-4" style={{ color: '#6A5A60' }}>
          Your pairing code and link were shown when you created this invitation. If you lost them, you can revoke this invitation and create a new one.
        </p>

        <div className="flex gap-2">
          <button onClick={() => setRevokeConfirm(true)}
            className="glass-button-secondary flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all">
            <X className="w-3.5 h-3.5" />
            Revoke
          </button>
          <button onClick={onReplace}
            className="glass-button-secondary flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
            Create new
          </button>
        </div>
      </div>

      <p className="text-xs text-center leading-relaxed" style={{ color: '#6A5A60' }}>
        Only one pending invitation at a time. Creating a new one revokes the current invitation.
      </p>

      <ConfirmDialog
        open={revokeConfirm}
        onClose={() => setRevokeConfirm(false)}
        onConfirm={() => { setRevokeConfirm(false); onRevoke() }}
        title="Revoke this invitation?"
        message="Your partner won't be able to use the current link or code. You can create a new invitation afterwards."
        confirmLabel="Revoke invitation"
        danger
      />
    </div>
  )
}

// === CONNECTED VIEW ===
function ConnectedView({
  profile, partnerName, partnerEmoji, connectionId,
  sharedMemories, mySharedMemories, onChanged, onDisconnect, onRevokeShare,
}: {
  profile: any
  partnerName: string
  partnerEmoji: string
  connectionId: string | null
  sharedMemories: Memory[]
  mySharedMemories: Memory[]
  onChanged: () => void
  onDisconnect: () => void
  onRevokeShare: (m: Memory) => void
}) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-2xl font-semibold" style={{ color: '#1D1317' }}>Your connection.</h1>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.08)' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }} />
          <span className="text-xs font-medium" style={{ color: '#16A34A' }}>Active</span>
        </div>
      </div>
      <p className="text-sm leading-relaxed mb-6" style={{ color: '#6A5A60' }}>
        Two people. One connection. A better understanding of each other.
      </p>

      {/* Connection card */}
      <div className="glass-panel rounded-3xl p-6 mb-6">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="flex flex-col items-center gap-2">
            <Overlap left={profile?.avatar_emoji || '🌿'} right={partnerEmoji || '🤝'} />
            <span className="text-xs font-medium" style={{ color: '#1D1317' }}>{profile?.display_name || 'You'} and {partnerName}</span>
          </div>
        </div>
        <p className="text-xs text-center" style={{ color: '#6A5A60' }}>
          Your likes and dislikes are shared with {partnerName} by default. You can make any memory private in Memories.
        </p>
      </div>

      <ShareExistingBanner partnerName={partnerName} onChanged={onChanged} />

      {/* My shared memories */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#1D1317' }}>Memories you're sharing</h2>
        {mySharedMemories.length === 0 ? (
          <div className="glass-panel-soft rounded-2xl p-4">
            <p className="text-sm text-center py-2" style={{ color: '#6A5A60' }}>You haven't shared any memories yet. Visit your Memories library to share.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mySharedMemories.map((m) => (
              <div key={m.id} className="glass-panel-soft rounded-2xl p-3 flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: '#C8183F' }}>{CATEGORY_EMOJIS[m.category]}</span>
                    <span className="text-xs font-medium" style={{ color: '#C8183F' }}>{CATEGORY_LABELS[m.category]}</span>
                  </div>
                  <p className="text-sm" style={{ color: '#1D1317' }}>{m.content}</p>
                </div>
                <button onClick={() => onRevokeShare(m)} className="text-xs transition-colors shrink-0" style={{ color: '#6A5A60' }}>
                  <Lock className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Partner's shared memories */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#1D1317' }}>Memories {partnerName} shared with you</h2>
        {sharedMemories.length === 0 ? (
          <div className="glass-panel-soft rounded-2xl p-4">
            <p className="text-sm text-center py-2" style={{ color: '#6A5A60' }}>{partnerName} hasn't shared any memories with you yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sharedMemories.map((m) => (
              <div key={m.id} className="glass-panel-soft rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ color: '#C8183F' }}>{CATEGORY_EMOJIS[m.category]}</span>
                  <span className="text-xs font-medium" style={{ color: '#C8183F' }}>{CATEGORY_LABELS[m.category]}</span>
                </div>
                <p className="text-sm" style={{ color: '#1D1317' }}>{m.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="pt-4 border-t" style={{ borderColor: 'rgba(200,24,63,0.08)' }}>
        <button onClick={onDisconnect}
          className="flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: '#9B1C1C' }}>
          <Unlink className="w-4 h-4" />
          Unlink partner
        </button>
      </div>
    </div>
  )
}

// === CREATE INVITE MODAL ===
function CreateInviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const [step, setStep] = useState<'form' | 'creating' | 'result'>('form')
  const [inviteUrl, setInviteUrl] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  useEffect(() => {
    if (open) {
      setStep('form')
      setInviteUrl('')
      setPairingCode('')
      setCopiedUrl(false)
      setCopiedCode(false)
    }
  }, [open])

  const handleCreate = async () => {
    setStep('creating')
    const { data, error } = await inviteAction('create', {})
    if (error || !data) {
      toast(error || 'Failed to create invitation', 'error')
      setStep('form')
      return
    }
    setInviteUrl(data.inviteUrl || '')
    setPairingCode(data.pairingCode || '')
    setStep('result')
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(`You're invited to connect on Elara! Use this code: ${pairingCode} and open this link: ${inviteUrl}`)
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  const handleTelegram = () => {
    const msg = encodeURIComponent(`You're invited to connect on Elara! Use this code: ${pairingCode} and open this link: ${inviteUrl}`)
    window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${msg}`, '_blank')
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Connect on Elara',
          text: `You're invited to connect on Elara! Use this code: ${pairingCode}`,
          url: inviteUrl,
        })
      } catch {
        // user cancelled
      }
    } else {
      handleCopyUrl()
    }
  }

  if (step === 'result') {
    return (
      <Modal open={open} onClose={onClose} title="Your invitation is ready" size="md">
        <div className="space-y-5">
          {/* Pairing code */}
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: '#6A5A60' }}>Pairing code</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 glass-input rounded-xl px-4 py-3 text-center">
                <span className="text-xl font-mono tracking-[0.4em] font-semibold" style={{ color: '#1D1317' }}>{pairingCode}</span>
              </div>
              <button onClick={handleCopyCode}
                className="glass-button-secondary rounded-xl px-3 py-3 transition-all"
                aria-label="Copy code">
                {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Invitation link */}
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: '#6A5A60' }}>Invitation link</p>
            <div className="flex items-center gap-2">
              <input type="text" value={inviteUrl} readOnly
                className="flex-1 glass-input rounded-xl px-3 py-2.5 text-xs" style={{ color: '#1D1317' }}
                onClick={(e) => (e.target as HTMLInputElement).select()} />
              <button onClick={handleCopyUrl}
                className="glass-button-secondary rounded-xl px-3 py-2.5 transition-all"
                aria-label="Copy link">
                {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Share buttons */}
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: '#6A5A60' }}>Share via</p>
            <div className="flex gap-2">
              <ShareButton onClick={handleWhatsApp} icon={<MessageCircle className="w-4 h-4" />} label="WhatsApp" />
              <ShareButton onClick={handleTelegram} icon={<Send className="w-4 h-4" />} label="Telegram" />
              <ShareButton onClick={handleNativeShare} icon={<Share2 className="w-4 h-4" />} label="Share" />
            </div>
          </div>

          <p className="text-xs leading-relaxed" style={{ color: '#6A5A60' }}>
            Expires in 7 days. Your partner will need to sign in or create an account and enter the pairing code to connect.
          </p>

          <button onClick={onClose}
            className="glass-button-primary w-full rounded-xl py-3 text-sm font-medium transition-all">
            Done
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite your partner" description="Create a secure, single-use invitation." size="md">
    {step === 'creating' ? (
        <div className="py-8 text-center">
          <div className="w-8 h-8 mx-auto border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin" style={{ borderTopColor: '#C8183F' }} />
          <p className="text-sm mt-4" style={{ color: '#6A5A60' }}>Creating your invitation…</p>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed" style={{ color: '#6A5A60' }}>
            We'll generate a unique pairing code and invitation link. Share them with your partner through any messaging app. No email required.
          </p>

          <div className="flex items-center gap-2 text-xs px-4 py-3 rounded-xl" style={{ background: 'rgba(200,24,63,0.06)', color: '#6A5A60' }}>
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Connecting requires both people to have accounts and to consent. Private conversations stay private.</span>
          </div>

          <button onClick={handleCreate}
            className="glass-button-primary w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all">
            <UserPlus className="w-4 h-4" />
            Create invitation
          </button>
        </div>
      )}
    </Modal>
  )
}

// === ENTER CODE MODAL ===
function EnterCodeModal({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: () => void }) {
  const { toast } = useToast()
  const [code, setCode] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [step, setStep] = useState<'token' | 'code' | 'validating' | 'confirm' | 'connecting' | 'done'>('token')
  const [error, setError] = useState('')
  const [inviterName, setInviterName] = useState('')
  const [inviterEmoji, setInviterEmoji] = useState('🌿')

  useEffect(() => {
    if (open) {
      setCode('')
      setInviteToken('')
      setStep('token')
      setError('')
    }
  }, [open])

  const normalizeToken = (val: string) => val.toLowerCase().replace(/[^a-z0-9]/g, '')

  const handleCheckToken = async () => {
    if (!inviteToken.trim()) { setError('Please enter the invitation token or open the link your partner sent'); return }
    setStep('validating')
    setError('')

    const { data, error } = await checkInvite(inviteToken.trim())

    if (error || !data) {
      setError('Could not verify this invitation')
      setStep('token')
      return
    }

    if (!data.valid) {
      const reason = data.reason === 'expired' ? 'This invitation has expired' : data.reason === 'accepted' ? 'This invitation was already used' : 'This invitation is no longer valid'
      setError(reason)
      setStep('token')
      return
    }

    setInviterName(data.inviterName || 'Someone')
    setInviterEmoji(data.inviterEmoji || '🌿')
    setStep('code')
  }

  const normalizeCode = (val: string) => val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)

  const handleValidateCode = async () => {
    if (code.length !== 6) { setError('Enter the 6-character pairing code'); return }
    setStep('confirm')
    setError('')
  }

  const handleConfirm = async () => {
    setStep('connecting')
    const { data, error } = await inviteAction('accept', { token: inviteToken.trim(), pairingCode: code })
    if (error || !data?.success) {
      setError(error || data?.error || 'Failed to connect')
      setStep('code')
      return
    }
    setStep('done')
    toast('Connected successfully!', 'success')
    setTimeout(() => onConnected(), 1500)
  }

  return (
    <Modal open={open} onClose={onClose} title="Enter your invitation" size="md">
      {step === 'token' && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: '#6A5A60' }}>
            Paste the invitation link or token that your partner shared with you.
          </p>
          <input
            type="text"
            value={inviteToken}
            onChange={(e) => { setInviteToken(e.target.value); setError('') }}
            placeholder="Paste link or token…"
            className="glass-input w-full rounded-xl px-4 py-3 text-sm"
            style={{ color: '#1D1317' }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCheckToken() }}
          />
          {error && <p className="text-sm" style={{ color: '#9B1C1C' }}>{error}</p>}
          <button onClick={handleCheckToken}
            className="glass-button-primary w-full rounded-xl py-3 text-sm font-medium transition-all">
            Continue
          </button>
        </div>
      )}

      {step === 'validating' && (
        <div className="py-8 text-center">
          <div className="w-8 h-8 mx-auto border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin" style={{ borderTopColor: '#C8183F' }} />
          <p className="text-sm mt-4" style={{ color: '#6A5A60' }}>Checking invitation…</p>
        </div>
      )}

      {step === 'code' && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full glass-panel-soft flex items-center justify-center text-xl" style={{ border: '1px solid rgba(200,24,63,0.12)' }}>{inviterEmoji}</div>
            <span className="text-sm font-medium" style={{ color: '#1D1317' }}>{inviterName}</span>
          </div>
          <p className="text-sm leading-relaxed text-center" style={{ color: '#6A5A60' }}>
            Enter the 6-character pairing code {inviterName} shared with you.
          </p>
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(normalizeCode(e.target.value)); setError('') }}
            placeholder="ABC123"
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="glass-input w-full rounded-xl px-4 py-3 text-center text-xl font-mono tracking-[0.4em]"
            style={{ color: '#1D1317' }}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) handleValidateCode() }}
          />
          {error && <p className="text-sm" style={{ color: '#9B1C1C' }}>{error}</p>}
          <button onClick={handleValidateCode} disabled={code.length !== 6}
            className="glass-button-primary w-full rounded-xl py-3 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            Continue
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-5">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full glass-panel-soft flex items-center justify-center text-xl" style={{ border: '1px solid rgba(200,24,63,0.12)' }}>{inviterEmoji}</div>
            <svg width="28" height="16" viewBox="0 0 28 16" fill="none"><path d="M2 8 Q14 2 26 8" stroke="#C8183F" strokeWidth="1.5" opacity="0.3" fill="none" /></svg>
            <div className="w-12 h-12 rounded-full glass-panel-soft flex items-center justify-center text-xl" style={{ border: '1px solid rgba(200,24,63,0.12)' }}>🌿</div>
          </div>
          <h3 className="text-base font-semibold text-center" style={{ color: '#1D1317' }}>Ready to connect?</h3>
          <p className="text-sm leading-relaxed text-center" style={{ color: '#6A5A60' }}>
            Connecting lets you and {inviterName} share approved memories. Your private conversations stay private.
          </p>
<p className="text-xs text-center leading-relaxed" style={{ color: '#6A5A60' }}>Once you link, your likes and dislikes are shared with each other by default. You can make any of them private at any time.</p>
          <button onClick={handleConfirm}
            className="glass-button-primary w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all">
            <Check className="w-4 h-4" />
            Confirm connection
          </button>
          <button onClick={() => setStep('code')}
            className="w-full text-center text-sm py-2 transition-colors" style={{ color: '#6A5A60' }}>
            Not now
          </button>
        </div>
      )}

      {step === 'connecting' && (
        <div className="py-8 text-center">
          <div className="w-8 h-8 mx-auto border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin" style={{ borderTopColor: '#C8183F' }} />
          <p className="text-sm mt-4" style={{ color: '#6A5A60' }}>Connecting…</p>
        </div>
      )}

      {step === 'done' && (
        <div className="py-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(34,197,94,0.1)' }}>
            <Check className="w-7 h-7" style={{ color: '#22C55E' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#1D1317' }}>You're connected!</p>
        </div>
      )}
    </Modal>
  )
}

function ShareButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className="glass-button-secondary flex-1 flex flex-col items-center gap-1 rounded-xl py-3 transition-all"
      aria-label={`Share via ${label}`}>
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  )
}

function ShareExistingBanner({ partnerName, onChanged }: { partnerName: string; onChanged: () => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [count, setCount] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!user) return
    supabase.from('memories').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_private', true).in('category', DEFAULT_SHARED_CATEGORIES)
      .then(({ count }) => setCount(count || 0))
  }, [user])
  if (count === 0) return null
  const share = async () => {
    if (!user) return
    setBusy(true)
    const { error } = await supabase.from('memories').update({ is_private: false }).eq('user_id', user.id).eq('is_private', true).in('category', DEFAULT_SHARED_CATEGORIES)
    setBusy(false)
    if (error) { toast('Could not share your memories', 'error'); return }
    toast(`Shared ${count} with ${partnerName}`, 'success')
    setCount(0)
    onChanged()
  }
  return (
    <div className="material rounded-2xl p-4 mb-6">
      <p className="text-sm font-medium text-ink mb-1">Share your existing likes and dislikes?</p>
      <p className="text-xs text-ink-secondary mb-3">You have {count} saved from before you linked. Share them with {partnerName}, or keep them private. You can change any of them later in Memories.</p>
      <button onClick={share} disabled={busy} className="btn-gloss bg-burgundy text-white text-sm font-medium px-5 min-h-[44px] rounded-full disabled:opacity-60">
        {busy ? 'Sharing…' : `Share ${count}`}
      </button>
    </div>
  )
}
