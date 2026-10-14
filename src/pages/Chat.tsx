import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, RotateCcw, BookHeart, Check, X, Sparkles, Square } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { streamChatMessage, extractMemories, type ProposedMemoryFromAI } from '@/lib/api'
import { cn, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/Card'
import type { Message, Memory, Conversation, MemoryCategory } from '@/types'
import { CATEGORY_LABELS } from '@/types'

export function Chat() {
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [memories, setMemories] = useState<Memory[]>([])
  const [proposedMemories, setProposedMemories] = useState<Record<string, ProposedMemoryFromAI[]>>({})
  const [savingProposal, setSavingProposal] = useState(false)
  const [sharedMemories, setSharedMemories] = useState<Memory[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamingTextRef = useRef('')
  const messagesRef = useRef<Message[]>([])
  const memoriesRef = useRef<Memory[]>([])

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { memoriesRef.current = memories }, [memories])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, streamingText, scrollToBottom])

  useEffect(() => {
    if (user) loadInitialData()
  }, [user])

  const loadInitialData = async () => {
    if (!user) return
    const { data: existingConv } = await supabase
      .from('conversations').select('*').eq('user_id', user.id)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle()

    let conv = existingConv as Conversation | null
    if (!conv) {
      const { data: newConv } = await supabase
        .from('conversations').insert({ user_id: user.id }).select('*').maybeSingle()
      conv = newConv as Conversation
    }
    setConversation(conv)

    const { data: msgs } = await supabase
      .from('messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: true })
    setMessages((msgs as Message[]) || [])

    const { data: mems } = await supabase
      .from('memories').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
    setMemories((mems as Memory[]) || [])

    const { data: conn } = await supabase
      .from('couple_connections').select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .eq('invitation_status', 'accepted').maybeSingle()

    if (conn) {
      const { data: shared } = await supabase.from('memories').select('*').neq('user_id', user.id)
      setSharedMemories((shared as Memory[]) || [])
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading || !user || !conversation) return
    const userMessage = input.trim()
    setInput('')
    setLoading(true)
    setStreaming(true)
    setStreamingText('')
    streamingTextRef.current = ''

    const { data: userMsg } = await supabase
      .from('messages').insert({ conversation_id: conversation.id, user_id: user.id, role: 'user', content: userMessage })
      .select('*').maybeSingle()
    if (userMsg) setMessages((prev) => [...prev, userMsg as Message])

    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversation.id)

    const history = messagesRef.current.slice(-6).map((m) => ({ role: m.role, content: m.content }))
    const memoryContext = memoriesRef.current.slice(0, 10).map((m) => ({ category: m.category, content: m.content }))
    const partnerMemoryContext = sharedMemories.slice(0, 5).map((m) => ({ category: m.category, content: m.content }))

    let streamError: string | null = null

    const handle = await streamChatMessage(
      userMessage, history, memoryContext, partnerMemoryContext,
      profile?.display_name, profile?.partner_name || undefined,
      {
        onText: (text) => {
          streamingTextRef.current += text
          setStreamingText(streamingTextRef.current)
        },
        onError: (error) => {
          streamError = error
        },
        onDone: () => {
          setStreaming(false)
        },
      }
    )

    abortControllerRef.current = handle.controller

    // Wait for the stream to fully complete
    await handle.done

    const finalText = streamingTextRef.current.trim()
    setStreamingText('')

    if (streamError || !finalText) {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(), conversation_id: conversation.id, user_id: user.id, role: 'assistant',
        content: streamError || 'Something went wrong. Please try again.',
        proposed_memories: null, memories_reviewed: true, is_demo: false, created_at: new Date().toISOString(),
      }])
      setLoading(false)
      setStreaming(false)
      return
    }

    const { data: aiMsg } = await supabase
      .from('messages').insert({
        conversation_id: conversation.id, user_id: user.id, role: 'assistant', content: finalText,
        proposed_memories: null, memories_reviewed: true, is_demo: false,
      })
      .select('*').maybeSingle()

    if (aiMsg) {
      setMessages((prev) => [...prev, aiMsg as Message])
      setLoading(false)

      // Fire memory extraction in the background — non-blocking
      extractMemoriesInBackground(userMessage, finalText, aiMsg.id)
    } else {
      setLoading(false)
    }
  }

  const extractMemoriesInBackground = async (userMessage: string, assistantResponse: string, messageId: string) => {
    try {
      const { data: extractData } = await extractMemories(
        userMessage, assistantResponse,
        memoriesRef.current.map((m) => m.content)
      )
      if (extractData?.memories?.length) {
        const extracted = extractData.memories
        await supabase.from('messages').update({
          proposed_memories: extracted,
          memories_reviewed: false,
        }).eq('id', messageId)
        setProposedMemories((prev) => ({ ...prev, [messageId]: extracted }))
      }
    } catch (err) {
      // Silent fail — memory extraction is non-critical
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setStreaming(false)
    const finalText = streamingTextRef.current.trim()
    setStreamingText('')

    if (finalText && conversation && user) {
      supabase
        .from('messages').insert({
          conversation_id: conversation.id, user_id: user.id, role: 'assistant', content: finalText,
          proposed_memories: null, memories_reviewed: true, is_demo: false,
        })
        .select('*').maybeSingle()
        .then(({ data: aiMsg }) => {
          if (aiMsg) {
            setMessages((prev) => [...prev, aiMsg as Message])
            extractMemoriesInBackground('', finalText, aiMsg.id)
          }
        })
    }
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleSaveMemory = async (messageId: string, proposal: ProposedMemoryFromAI) => {
    if (!user) return
    setSavingProposal(true)
    const { error } = await supabase.from('memories').insert({
      user_id: user.id, category: proposal.category as MemoryCategory,
      content: proposal.content, context: proposal.context, confidence: proposal.confidence,
      source_message_id: messageId, is_private: true,
    })
    if (error) { toast('Failed to save memory', 'error') }
    else {
      toast('Memory saved to your library', 'success')
      await supabase.from('messages').update({ memories_reviewed: true }).eq('id', messageId)
      setProposedMemories((prev) => { const u = { ...prev }; delete u[messageId]; return u })
      const { data: mems } = await supabase.from('memories').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
      setMemories((mems as Memory[]) || [])
    }
    setSavingProposal(false)
  }

  const handleDismissProposal = async (messageId: string) => {
    await supabase.from('messages').update({ memories_reviewed: true }).eq('id', messageId)
    setProposedMemories((prev) => { const u = { ...prev }; delete u[messageId]; return u })
    toast('Memory proposal dismissed', 'info')
  }

  const handleRetry = (messageId: string) => {
    const idx = messages.findIndex((m) => m.id === messageId)
    if (idx < 1) return
    const userMsg = messages[idx - 1]
    if (userMsg.role !== 'user') return
    supabase.from('messages').delete().eq('id', messageId)
    supabase.from('messages').delete().eq('id', userMsg.id)
    setMessages((prev) => prev.filter((m) => m.id !== messageId && m.id !== userMsg.id))
    setInput(userMsg.content)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-8 py-3 border-b border-warm-grey-100 bg-white/60 backdrop-blur-sm animate-fade-in">
        <div className="flex items-center gap-2 max-w-2xl mx-auto w-full">
          <div className="w-8 h-8 rounded-full bg-burgundy-50 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-burgundy" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Elara</p>
            <p className="text-xs text-ink-tertiary">{memories.length} memories remembered</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        {messages.length === 0 && !loading ? (
          <div className="h-full flex items-center justify-center animate-fade-in">
            <EmptyState icon={<Sparkles className="w-7 h-7" />} title="Start a conversation with Elara"
              description="Share what's on your mind. Elara listens with warmth and remembers what matters." />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={msg.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(i * 30, 150)}ms` }}>
                <MessageBubble message={msg} onRetry={() => handleRetry(msg.id)} />
                {msg.role === 'assistant' && proposedMemories[msg.id]?.length > 0 && (
                  <div className="mt-3 ml-2 md:ml-12">
                    {proposedMemories[msg.id].map((p, i) => (
                      <MemoryProposalCard key={i} proposal={p}
                        onSave={() => handleSaveMemory(msg.id, p)}
                        onDismiss={() => handleDismissProposal(msg.id)}
                        saving={savingProposal} />
                    ))}
                  </div>
                )}
                {msg.role === 'assistant' && msg.is_demo && (
                  <div className="mt-2 ml-2 md:ml-12"><Badge variant="warning">Demo mode — AI service not configured</Badge></div>
                )}
              </div>
            ))}
            {streaming && (
              <StreamingBubble text={streamingText} onCancel={handleCancel} />
            )}
            {loading && !streaming && (
              <div className="flex items-center gap-2 ml-2 md:ml-12 text-ink-tertiary animate-fade-in">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-burgundy/40 animate-pulse-soft" />
                  <div className="w-2 h-2 rounded-full bg-burgundy/40 animate-pulse-soft" style={{ animationDelay: '200ms' }} />
                  <div className="w-2 h-2 rounded-full bg-burgundy/40 animate-pulse-soft" style={{ animationDelay: '400ms' }} />
                </div>
                <span className="text-sm">Elara is thinking…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="glass rounded-3xl mx-3 md:mx-8 mb-3 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2">
            <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown} placeholder="Share what's on your mind…" rows={1}
              className="flex-1 resize-none rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-burgundy/20 focus:border-burgundy transition-all max-h-32 min-h-[44px]"
              onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 128) + 'px' }}
              disabled={loading} />
            {streaming ? (
              <button onClick={handleCancel}
                className="w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0 bg-warm-grey-200 text-ink hover:bg-warm-grey-300"
                aria-label="Stop generating">
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button onClick={handleSend} disabled={!input.trim() || loading}
                className={cn('w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0',
                  input.trim() && !loading ? 'bg-burgundy text-white hover:bg-burgundy-dark shadow-sm hover:shadow-burgundy' : 'bg-warm-grey-100 text-ink-tertiary')}
                aria-label="Send message">
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-ink-tertiary mt-2 text-center hidden md:block">Enter to send, Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}

function StreamingBubble({ text, onCancel }: { text: string; onCancel: () => void }) {
  const showTyping = text.length === 0

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="max-w-[80%] md:max-w-[70%]">
        <div className="rounded-2xl rounded-bl-md material text-ink px-4 py-3">
          {showTyping ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-burgundy/40 animate-pulse-soft" />
                <div className="w-2 h-2 rounded-full bg-burgundy/40 animate-pulse-soft" style={{ animationDelay: '200ms' }} />
                <div className="w-2 h-2 rounded-full bg-burgundy/40 animate-pulse-soft" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {text}
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-burgundy/60 rounded-sm align-text-bottom animate-pulse-soft" />
            </p>
          )}
        </div>
        {showTyping && (
          <button onClick={onCancel} className="mt-1.5 inline-flex items-center gap-1 text-xs text-ink-tertiary hover:text-ink transition-colors">
            <Square className="w-3 h-3 fill-current" /> Stop
          </button>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ message, onRetry }: { message: Message; onRetry: () => void }) {
  const isUser = message.role === 'user'
  const isError = !isUser && (message.content.includes('Something went wrong') || message.content.includes('error'))

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[80%] md:max-w-[70%]')}>
        <div className={cn('rounded-2xl px-4 py-3 text-sm leading-relaxed transition-all',
          isUser ? 'bg-burgundy btn-gloss text-white rounded-br-md' : isError
            ? 'bg-error-light text-error border border-error/10 rounded-bl-md'
            : 'material text-ink rounded-bl-md')}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className={cn('flex items-center gap-2 mt-1', isUser ? 'justify-end' : 'justify-start')}>
          <span className="text-xs text-ink-tertiary">{formatTime(message.created_at)}</span>
          {isError && <button onClick={onRetry} className="inline-flex items-center gap-1 text-xs text-burgundy hover:text-burgundy-dark transition-colors"><RotateCcw className="w-3 h-3" />Retry</button>}
        </div>
      </div>
    </div>
  )
}

function MemoryProposalCard({ proposal, onSave, onDismiss, saving }: {
  proposal: ProposedMemoryFromAI; onSave: () => void; onDismiss: () => void; saving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(proposal.content)
  const [category, setCategory] = useState<MemoryCategory>(proposal.category as MemoryCategory)

  return (
    <div className="bg-burgundy-50/50 border border-burgundy-100 rounded-xl p-4 animate-slide-up">
      <div className="flex items-start gap-2 mb-2">
        <BookHeart className="w-4 h-4 text-burgundy shrink-0 mt-0.5" />
        <p className="text-xs font-medium text-burgundy">Elara noticed something worth remembering</p>
      </div>
      {editing ? (
        <div className="space-y-2 mb-3">
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-lg border border-warm-grey-200 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-burgundy/20 resize-none" rows={2} />
          <select value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)}
            className="w-full rounded-lg border border-warm-grey-200 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-burgundy/20">
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      ) : <p className="text-sm text-ink mb-1">{content}</p>}
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="burgundy">{CATEGORY_LABELS[category]}</Badge>
        {proposal.confidence < 0.6 && <Badge variant="warning">Uncertain</Badge>}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSave} loading={saving}><Check className="w-3.5 h-3.5" />Save memory</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}><X className="w-3.5 h-3.5" />Dismiss</Button>
      </div>
    </div>
  )
}
