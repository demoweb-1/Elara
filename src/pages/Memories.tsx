import { PageSkeleton } from '@/components/ui/Skeletons'
import { useState, useEffect, useMemo } from 'react'
import { Search, Plus, Trash2, Edit2, Check, Lock, Share2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { cn, relativeTime } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, Spinner } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import type { Memory, MemoryCategory, CoupleConnection, MemoryShare } from '@/types'
import { CATEGORY_LABELS, CATEGORY_EMOJIS } from '@/types'

export function Memories() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [privacyFilter, setPrivacyFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('recent')
  const [editing, setEditing] = useState<Memory | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Memory | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [shareTarget, setShareTarget] = useState<Memory | null>(null)

  useEffect(() => { if (user) loadMemories() }, [user])

  const loadMemories = async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase.from('memories').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
    if (error) toast('Failed to load memories', 'error')
    else setMemories((data as Memory[]) || [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    let r = memories
    if (search) { const q = search.toLowerCase(); r = r.filter((m) => m.content.toLowerCase().includes(q)) }
    if (categoryFilter !== 'all') r = r.filter((m) => m.category === categoryFilter)
    if (privacyFilter === 'private') r = r.filter((m) => m.is_private)
    else if (privacyFilter === 'shared') r = r.filter((m) => !m.is_private)
    if (sortFilter === 'recent') r = [...r].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    else if (sortFilter === 'created') r = [...r].sort((a, b) => b.created_at.localeCompare(a.created_at))
    else if (sortFilter === 'category') r = [...r].sort((a, b) => a.category.localeCompare(b.category))
    return r
  }, [memories, search, categoryFilter, privacyFilter, sortFilter])

  const handleSave = async (data: Partial<Memory>) => {
    if (!user) return
    if (editing) {
      const { error } = await supabase.from('memories').update({
        category: data.category, content: data.content, context: data.context, is_private: data.is_private,
      }).eq('id', editing.id)
      if (error) toast('Failed to update memory', 'error')
      else { toast('Memory updated', 'success'); setEditing(null); loadMemories() }
    } else {
      const { error } = await supabase.from('memories').insert({
        user_id: user.id, category: data.category, content: data.content, context: data.context,
        is_private: data.is_private ?? true, confidence: 1.0,
      })
      if (error) toast('Failed to create memory', 'error')
      else { toast('Memory created', 'success'); setCreating(false); loadMemories() }
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('memories').delete().eq('id', deleteTarget.id)
    if (error) toast('Failed to delete memory', 'error')
    else { toast('Memory deleted', 'success'); setDeleteTarget(null); setConfirmOpen(false); loadMemories() }
  }

  const handleConfirm = async (m: Memory) => {
    const { error } = await supabase.from('memories').update({ last_confirmed_at: new Date().toISOString() }).eq('id', m.id)
    if (error) toast('Failed to confirm', 'error')
    else { toast('Memory confirmed as still accurate', 'success'); loadMemories() }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 md:px-8 py-4 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-ink">Memories</h1>
            <p className="text-sm text-ink-tertiary">{memories.length} saved memories</p>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4" />Add memory</Button>
        </div>

        <div className="space-y-3 mb-4">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your memories…"
              className="w-full rounded-xl border border-warm-grey-200 bg-white pl-9 pr-4 py-2.5 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-burgundy/20 focus:border-burgundy" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-warm-grey-200 bg-white px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-burgundy/20">
              <option value="all">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={privacyFilter} onChange={(e) => setPrivacyFilter(e.target.value)} className="rounded-lg border border-warm-grey-200 bg-white px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-burgundy/20">
              <option value="all">All privacy</option><option value="private">Private</option><option value="shared">Shared</option>
            </select>
            <select value={sortFilter} onChange={(e) => setSortFilter(e.target.value)} className="rounded-lg border border-warm-grey-200 bg-white px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-burgundy/20">
              <option value="recent">Recently updated</option><option value="created">Recently created</option><option value="category">By category</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Search className="w-7 h-7" />} title={memories.length === 0 ? "No memories yet" : "No matching memories"}
            description={memories.length === 0 ? "Chat with Elara to start building your memory library, or add one manually." : "Try adjusting your search or filters."}
            action={memories.length === 0 ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4" />Add memory</Button> : undefined} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((m) => (
              <Card key={m.id} className="p-4 group">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base text-burgundy">{CATEGORY_EMOJIS[m.category]}</span>
                    <Badge variant="burgundy">{CATEGORY_LABELS[m.category]}</Badge>
                  </div>
                  {m.is_private ? <Lock className="w-3.5 h-3.5 text-ink-tertiary" /> : <Share2 className="w-3.5 h-3.5 text-success" />}
                </div>
                <p className="text-sm text-ink leading-relaxed mb-2">{m.content}</p>
                {m.context && <p className="text-xs text-ink-tertiary italic mb-2">Context: {m.context}</p>}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-ink-tertiary">Updated {relativeTime(m.updated_at)}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleConfirm(m)} className="p-1.5 rounded-lg hover:bg-warm-grey-50 text-ink-tertiary hover:text-success" title="Confirm"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditing(m)} className="p-1.5 rounded-lg hover:bg-warm-grey-50 text-ink-tertiary hover:text-burgundy" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setShareTarget(m)} className="p-1.5 rounded-lg hover:bg-warm-grey-50 text-ink-tertiary hover:text-burgundy" title="Share"><Share2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setDeleteTarget(m); setConfirmOpen(true) }} className="p-1.5 rounded-lg hover:bg-warm-grey-50 text-ink-tertiary hover:text-error" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {m.last_confirmed_at && <p className="text-xs text-success mt-1">Confirmed {relativeTime(m.last_confirmed_at)}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>

      {(editing || creating) && <MemoryEditor memory={editing} onClose={() => { setEditing(null); setCreating(false) }} onSave={handleSave} />}

      <ConfirmDialog open={confirmOpen} onClose={() => { setConfirmOpen(false); setDeleteTarget(null) }} onConfirm={handleDelete}
        title="Delete this memory?" message="This will permanently remove this memory and revoke any active shares. This cannot be undone."
        confirmLabel="Delete memory" danger />

      {shareTarget && <ShareModal memory={shareTarget} onClose={() => setShareTarget(null)} onShared={loadMemories} />}
    </div>
  )
}

function MemoryEditor({ memory, onClose, onSave }: { memory: Memory | null; onClose: () => void; onSave: (d: Partial<Memory>) => void }) {
  const [category, setCategory] = useState<MemoryCategory>(memory?.category || 'preferences')
  const [content, setContent] = useState(memory?.content || '')
  const [context, setContext] = useState(memory?.context || '')
  const [isPrivate, setIsPrivate] = useState(memory?.is_private ?? true)

  return (
    <Modal open onClose={onClose} title={memory ? "Edit memory" : "New memory"} description={memory ? "Update the details of this memory." : "Add a memory to your private library."}>
      <div className="space-y-4">
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)}>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Textarea label="Memory" value={content} onChange={(e) => setContent(e.target.value)} placeholder="What should Elara remember?" rows={3} />
        <Textarea label="Context (optional)" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Any additional context…" rows={2} />
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="w-4 h-4 rounded border-warm-grey-300 text-burgundy focus:ring-burgundy/20" />
          <span className="text-sm text-ink">Keep this memory private</span>
        </label>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ category, content, context: context || null, is_private: isPrivate })} disabled={!content.trim()}>{memory ? 'Save changes' : 'Create memory'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ShareModal({ memory, onClose, onShared }: { memory: Memory; onClose: () => void; onShared: () => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [connection, setConnection] = useState<CoupleConnection | null>(null)
  const [partnerName, setPartnerName] = useState('')
  const [existingShares, setExistingShares] = useState<MemoryShare[]>([])
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)

  useEffect(() => { checkConnection() }, [])

  const checkConnection = async () => {
    if (!user) return
    const { data: conn } = await supabase.from('couple_connections').select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`).eq('invitation_status', 'accepted').maybeSingle()
    if (conn) {
      setConnection(conn as CoupleConnection)
      const partnerId = conn.user_a === user.id ? conn.user_b : conn.user_a
      if (partnerId) {
        const { data: pp } = await supabase.from('profiles').select('display_name').eq('id', partnerId).maybeSingle()
        if (pp) setPartnerName((pp as any).display_name)
        const { data: shares } = await supabase.from('memory_shares').select('*').eq('memory_id', memory.id).eq('recipient_id', partnerId)
        setExistingShares((shares as MemoryShare[]) || [])
      }
    }
    setLoading(false)
  }

  const handleShare = async () => {
    if (!user || !connection) return
    setSharing(true)
    const partnerId = connection.user_a === user.id ? connection.user_b : connection.user_a
    const { error } = await supabase.from('memory_shares').insert({
      memory_id: memory.id, owner_id: user.id, recipient_id: partnerId, connection_id: connection.id, status: 'active',
    })
    if (error) { toast('Failed to share memory', 'error') }
    else {
      await supabase.from('memories').update({ is_private: false }).eq('id', memory.id)
      toast(`Memory shared with ${partnerName || 'your partner'}`, 'success')
      onShared(); onClose()
    }
    setSharing(false)
  }

  if (loading) return <Modal open onClose={onClose} title="Share memory"><Spinner /></Modal>
  const hasActiveShare = existingShares.some((s) => s.status === 'active')

  return (
    <Modal open onClose={onClose} title="Share memory with partner" size="sm">
      {!connection ? (
        <div><p className="text-sm text-ink-secondary mb-4">You need to connect with a partner first.</p><Button variant="secondary" onClick={onClose}>Close</Button></div>
      ) : hasActiveShare ? (
        <div><p className="text-sm text-ink-secondary mb-4">This memory is already shared with {partnerName}.</p><Button variant="secondary" onClick={onClose}>Close</Button></div>
      ) : (
        <div>
          <div className="bg-warm-grey-50 rounded-xl p-3 mb-4"><p className="text-sm text-ink">{memory.content}</p></div>
          <p className="text-sm text-ink-secondary mb-4">Share this memory with {partnerName}? They will see it in your shared space. You can revoke this at any time.</p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleShare} loading={sharing}><Share2 className="w-4 h-4" />Share memory</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
