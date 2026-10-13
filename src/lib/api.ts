import { supabase, getSupabaseUrl, getAnonKey } from './supabase'

async function callEdgeFunction<T>(
  name: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null; status: number }> {
  const url = `${getSupabaseUrl()}/functions/v1/${name}`
  const { data: { session } } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: getAnonKey(),
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok) {
      return { data: null, error: data.error || `Request failed (${response.status})`, status: response.status }
    }
    return { data: data as T, error: null, status: response.status }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Network error', status: 0 }
  }
}

export interface ChatResponse {
  response: string
  demo?: boolean
  error?: string
}

export interface ProposedMemoryFromAI {
  category: string
  content: string
  context: string | null
  confidence: number
}

export interface ExtractResponse {
  memories: ProposedMemoryFromAI[]
  demo?: boolean
  error?: string
}

export interface SuggestionItem {
  title: string
  description: string
  basedOn: string[]
}

export interface SuggestionResponse {
  suggestions: SuggestionItem[]
  hasData: boolean
  question?: string
  demo?: boolean
  error?: string
}

export interface InviteResponse {
  connection?: unknown
  inviteUrl?: string
  token?: string
  pairingCode?: string
  success?: boolean
  valid?: boolean
  status?: string
  reason?: string
  expired?: boolean
  inviterName?: string
  inviterEmoji?: string
  pending?: { id: string; expires_at: string; created_at: string } | null
  partnerName?: string | null
  partnerEmoji?: string | null
  error?: string
}

export async function sendChatMessage(
  message: string,
  conversationHistory: { role: string; content: string }[],
  memories: { category: string; content: string }[],
  partnerMemories: { category: string; content: string }[],
  userName?: string,
  partnerName?: string
): Promise<{ data: ChatResponse | null; error: string | null }> {
  const result = await callEdgeFunction<ChatResponse>('elara-chat', {
    message, conversationHistory, memories, partnerMemories, userName, partnerName,
  })
  return { data: result.data, error: result.error }
}

export interface StreamChatCallbacks {
  onText: (text: string) => void
  onError: (error: string) => void
  onDone: () => void
}

export interface StreamChatHandle {
  controller: AbortController
  done: Promise<void>
}

export async function streamChatMessage(
  message: string,
  conversationHistory: { role: string; content: string }[],
  memories: { category: string; content: string }[],
  partnerMemories: { category: string; content: string }[],
  userName: string | undefined,
  partnerName: string | undefined,
  callbacks: StreamChatCallbacks
): Promise<StreamChatHandle> {
  const url = `${getSupabaseUrl()}/functions/v1/elara-chat`
  const { data: { session } } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: getAnonKey(),
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const controller = new AbortController()

  let resolveDone: (() => void) | null = null
  const done = new Promise<void>((resolve) => { resolveDone = resolve })
  const finish = () => { resolveDone?.() }

  ;(async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message, conversationHistory, memories, partnerMemories, userName, partnerName }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Request failed (${response.status})` }))
        callbacks.onError(errorData.error || `Request failed (${response.status})`)
        finish()
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        callbacks.onError('Stream not available')
        finish()
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done: readerDone, value } = await reader.read()
        if (readerDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const parsed = JSON.parse(jsonStr)
            if (parsed.text) {
              callbacks.onText(parsed.text)
            }
            if (parsed.error) {
              callbacks.onError(parsed.error)
              finish()
              return
            }
            if (parsed.done) {
              callbacks.onDone()
              finish()
              return
            }
          } catch {
            // partial JSON, skip
          }
        }
      }

      callbacks.onDone()
      finish()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        callbacks.onDone()
      } else {
        callbacks.onError(err instanceof Error ? err.message : 'Network error')
      }
      finish()
    }
  })()

  return { controller, done }
}

export async function extractMemories(
  message: string,
  assistantResponse: string,
  existingMemories: string[]
): Promise<{ data: ExtractResponse | null; error: string | null }> {
  const result = await callEdgeFunction<ExtractResponse>('elara-extract', {
    message, assistantResponse, existingMemories,
  })
  return { data: result.data, error: result.error }
}

export async function getSuggestions(
  type: 'gift' | 'date' | 'gesture' | 'general',
  memories: { category: string; content: string }[],
  partnerMemories: { category: string; content: string }[],
  partnerName?: string
): Promise<{ data: SuggestionResponse | null; error: string | null }> {
  const result = await callEdgeFunction<SuggestionResponse>('elara-suggest', {
    type, memories, partnerMemories, partnerName,
  })
  return { data: result.data, error: result.error }
}

export async function inviteAction(
  action: string,
  params: Record<string, unknown>
): Promise<{ data: InviteResponse | null; error: string | null }> {
  const url = `${getSupabaseUrl()}/functions/v1/elara-invite`
  const { data: { session } } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: getAnonKey(),
    'X-App-Url': window.location.origin,
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...params }),
    })
    const data = await response.json()
    if (!response.ok) {
      return { data: null, error: data.error || `Request failed (${response.status})` }
    }
    return { data: data as InviteResponse, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export async function checkInvite(token: string): Promise<{ data: InviteResponse | null; error: string | null }> {
  const url = `${getSupabaseUrl()}/functions/v1/elara-invite`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: getAnonKey(),
    'X-App-Url': window.location.origin,
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'check_invite', token }),
    })
    const data = await response.json()
    if (!response.ok) {
      return { data: null, error: data.error || `Request failed (${response.status})` }
    }
    return { data: data as InviteResponse, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export async function exportData(): Promise<{ data: unknown; error: string | null }> {
  const url = `${getSupabaseUrl()}/functions/v1/elara-export`
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: getAnonKey() }
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
  try {
    const response = await fetch(url, { method: 'POST', headers })
    const data = await response.json()
    if (!response.ok) return { data: null, error: data.error || 'Export failed' }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export async function deleteAccount(): Promise<{ error: string | null }> {
  const url = `${getSupabaseUrl()}/functions/v1/elara-delete`
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: getAnonKey() }
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
  try {
    const response = await fetch(url, { method: 'POST', headers })
    if (!response.ok) { const data = await response.json(); return { error: data.error || 'Deletion failed' } }
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' }
  }
}
