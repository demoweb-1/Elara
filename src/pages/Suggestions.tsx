import { useState, useEffect } from 'react'
import { Sparkles, Gift, Calendar, HandHeart, Lightbulb } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { getSuggestions, type SuggestionResponse } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, Spinner } from '@/components/ui/Card'
import type { Memory } from '@/types'

type SuggestionType = 'gift' | 'date' | 'gesture' | 'general'

const types: { type: SuggestionType; label: string; icon: typeof Gift; desc: string }[] = [
  { type: 'gift', label: 'Gift Ideas', icon: Gift, desc: 'Thoughtful gifts based on preferences' },
  { type: 'date', label: 'Date Ideas', icon: Calendar, desc: 'Meaningful activities grounded in memories' },
  { type: 'gesture', label: 'Thoughtful Gestures', icon: HandHeart, desc: 'Small acts of care and kindness' },
  { type: 'general', label: 'All Suggestions', icon: Lightbulb, desc: 'General thoughtful ideas' },
]

export function Suggestions() {
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const [selectedType, setSelectedType] = useState<SuggestionType | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SuggestionResponse | null>(null)
  const [memories, setMemories] = useState<Memory[]>([])
  const [sharedMemories, setSharedMemories] = useState<Memory[]>([])

  useEffect(() => { if (user) loadData() }, [user])

  const loadData = async () => {
    if (!user) return
    const { data: mems } = await supabase.from('memories').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
    setMemories((mems as Memory[]) || [])
    const { data: shared } = await supabase.from('memories').select('*').neq('user_id', user.id)
    setSharedMemories((shared as Memory[]) || [])
  }

  const handleGenerate = async (type: SuggestionType) => {
    setLoading(true); setSelectedType(type); setResult(null)
    const mc = memories.map((m) => ({ category: m.category, content: m.content }))
    const pc = sharedMemories.map((m) => ({ category: m.category, content: m.content }))
    const { data, error } = await getSuggestions(type, mc, pc, profile?.partner_name || undefined)
    if (error) toast(error, 'error')
    else if (data) { setResult(data); if (data.demo) toast('AI service not configured — showing limited suggestions', 'info') }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 md:px-8 py-4 max-w-3xl mx-auto w-full">
        <h1 className="text-xl font-semibold text-ink mb-1">Thoughtful Suggestions</h1>
        <p className="text-sm text-ink-tertiary mb-6">Grounded in what Elara remembers</p>

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {types.map((st) => (
            <Card key={st.type} className="p-4 hoverable" onClick={() => handleGenerate(st.type)}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-burgundy-50 flex items-center justify-center shrink-0"><st.icon className="w-5 h-5 text-burgundy" /></div>
                <div className="flex-1"><p className="font-medium text-ink text-sm">{st.label}</p><p className="text-xs text-ink-tertiary mt-0.5">{st.desc}</p></div>
              </div>
            </Card>
          ))}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner size="lg" /><p className="text-sm text-ink-tertiary mt-4">Elara is thinking of suggestions…</p>
          </div>
        )}

        {!loading && result && (
          <div className="animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-ink">Suggestions</h2>
              <Badge variant="burgundy">{memories.length + sharedMemories.length} memories used</Badge>
            </div>
            {result.hasData && result.suggestions.length > 0 ? (
              <div className="space-y-3">
                {result.suggestions.map((s, i) => (
                  <Card key={i} className="p-4">
                    <p className="font-medium text-ink mb-1">{s.title}</p>
                    <p className="text-sm text-ink-secondary leading-relaxed mb-3">{s.description}</p>
                    {s.basedOn?.length > 0 && <div className="flex flex-wrap gap-1.5">{s.basedOn.map((b, j) => <Badge key={j} variant="default">{b}</Badge>)}</div>}
                  </Card>
                ))}
              </div>
            ) : result.question ? (
              <Card className="p-6">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-burgundy shrink-0 mt-0.5" />
                  <div><p className="text-sm text-ink mb-2">Elara needs to learn more:</p><p className="text-sm text-ink-secondary italic">{result.question}</p>
                    <Button size="sm" variant="secondary" className="mt-3" onClick={() => window.location.href = import.meta.env.BASE_URL + 'chat'}>Chat with Elara</Button></div>
                </div>
              </Card>
            ) : (
              <EmptyState icon={<Sparkles className="w-7 h-7" />} title="Not enough memories yet"
                description="Chat with Elara and save memories first — she'll use them to ground her suggestions." />
            )}
          </div>
        )}

        {!loading && !result && memories.length === 0 && sharedMemories.length === 0 && (
          <Card className="p-6"><EmptyState icon={<Sparkles className="w-7 h-7" />} title="No memories to draw from yet"
            description="Elara bases her suggestions on the memories you've saved. Start chatting to build your library." /></Card>
        )}
      </div>
    </div>
  )
}
