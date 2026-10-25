import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { getSuggestions } from '@/lib/api'
import { getConnectionId } from '@/lib/guessMe'
import { loadMoment, saveMoment, weekKey, weekStartLabel, type Moment, type MomentIdea } from '@/lib/moments'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SuggestionsSkeleton } from '@/components/ui/Skeletons'
import type { Memory } from '@/types'

// Shows this week's three ideas for your partner. Only visible once you are linked.
export function MomentsCard({ memories, sharedMemories }: { memories: Memory[]; sharedMemories: Memory[] }) {
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const [connected, setConnected] = useState<boolean | null>(null)
  const [moment, setMoment] = useState<Moment | null>(null)
  const [loading, setLoading] = useState(false)
  const [planning, setPlanning] = useState<string | null>(null)
  const attempted = useRef(false)

  const partnerName = profile?.partner_name || 'your partner'
  const enough = memories.length + sharedMemories.length >= 2

  useEffect(() => {
    if (!user) return
    getConnectionId(user.id).then((id) => setConnected(!!id))
    setMoment(loadMoment(user.id))
  }, [user])

  // Make this week's Moment once per visit. The flag stops repeated attempts after a failure.
  useEffect(() => {
    if (!user || !connected || !enough || moment || attempted.current) return
    attempted.current = true
    setLoading(true)
    const mc = memories.map((m) => ({ category: m.category, content: m.content }))
    const pc = sharedMemories.map((m) => ({ category: m.category, content: m.content }))
    getSuggestions('general', mc, pc, profile?.partner_name || undefined).then(({ data, error }) => {
      setLoading(false)
      if (error) { toast(error, 'error'); return }
      const ideas: MomentIdea[] = (data?.suggestions ?? []).slice(0, 3)
      if (ideas.length === 0) return
      const m: Moment = { week: weekKey(), ideas, dismissed: [], planned: [] }
      saveMoment(user.id, m)
      setMoment(m)
    })
  }, [user, connected, enough, moment, memories, sharedMemories, profile, toast])

  const addToPlan = async (idea: MomentIdea, when: 'tonight' | 'soon') => {
    if (!user || !moment) return
    const due = new Date()
    if (when === 'tonight') due.setHours(19, 0, 0, 0)
    else { due.setDate(due.getDate() + 3); due.setHours(18, 0, 0, 0) }
    if (due.getTime() < Date.now()) due.setDate(due.getDate() + 1)
    const { error } = await supabase.from('reminders').insert({
      user_id: user.id,
      title: idea.title,
      description: idea.description,
      reminder_type: 'general',
      due_at: due.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      advance_notice_days: 0,
    })
    if (error) { toast('Could not add this to your plan', 'error'); return }
    const next: Moment = { ...moment, planned: [...moment.planned, idea.title] }
    saveMoment(user.id, next)
    setMoment(next)
    setPlanning(null)
    toast(`Added to Reminders for ${due.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`, 'success')
  }

  const dismiss = (title: string) => {
    if (!user || !moment) return
    const next: Moment = { ...moment, dismissed: [...moment.dismissed, title] }
    saveMoment(user.id, next)
    setMoment(next)
  }

  if (connected !== true) return null

  const visible = moment ? moment.ideas.filter((i) => !moment.dismissed.includes(i.title)) : []

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">This week&apos;s Moment</p>
        <span className="text-xs text-ink-tertiary">Week of {weekStartLabel()}</span>
      </div>
      <p className="text-xs text-ink-tertiary mt-1 mb-3">Three small ideas for {partnerName}, based on what you both shared.</p>

      {!enough && (
        <p className="text-sm text-ink-secondary">Chat with Elara and save a few memories, and your Moment will appear here.</p>
      )}
      {enough && loading && <SuggestionsSkeleton />}
      {enough && !loading && moment && visible.length === 0 && (
        <p className="text-sm text-ink-secondary">You have seen this week&apos;s ideas. A new Moment arrives next week.</p>
      )}

      {visible.map((idea) => (
        <div key={idea.title} className="border-t border-warm-grey-100 pt-4 mt-4 first:border-0 first:pt-0 first:mt-0">
          <p className="text-sm font-medium text-ink">{idea.title}</p>
          <p className="text-sm text-ink-secondary mt-1">{idea.description}</p>
          {idea.basedOn && idea.basedOn.length > 0 && (
            <p className="text-xs text-ink-tertiary mt-1">Based on: {idea.basedOn.join(', ')}</p>
          )}
          {moment?.planned.includes(idea.title) ? (
            <p className="text-xs text-success mt-2">Added to your plan</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-3">
              {planning === idea.title ? (
                <>
                  <Button size="sm" onClick={() => addToPlan(idea, 'tonight')}>Tonight</Button>
                  <Button size="sm" variant="secondary" onClick={() => addToPlan(idea, 'soon')}>In 3 days</Button>
                </>
              ) : (
                <Button size="sm" onClick={() => setPlanning(idea.title)}>Add to my plan</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => dismiss(idea.title)}>Not this one</Button>
            </div>
          )}
        </div>
      ))}
    </Card>
  )
}
