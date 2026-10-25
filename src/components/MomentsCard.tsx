import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { getSuggestions } from '@/lib/api'
import { getConnectionId } from '@/lib/guessMe'
import { loadMoment, saveMoment, weekKey, type Moment, type MomentIdea } from '@/lib/moments'
import { Shimmer } from '@/components/ui/Skeletons'
import { cn } from '@/lib/utils'
import type { Memory } from '@/types'

// This week's Moment: three ideas for your partner. Shown only once you are linked.
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

  // Make this week's Moment once. The flag stops repeated attempts after a failure.
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
    toast(`Added to Reminders, ${due.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`, 'success')
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
    <section aria-labelledby="moment-title" className="material mb-8 rounded-3xl px-5 py-6 md:px-7">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-burgundy">This week</p>
      <h2 id="moment-title" className="mt-1.5 text-[22px] font-semibold tracking-tight text-ink">
        A Moment for {partnerName}
      </h2>

      {!enough && (
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-ink-secondary">
          Save a few memories in chat, and your Moment will appear here.
        </p>
      )}

      {enough && loading && (
        <div className="mt-5 space-y-6" aria-busy="true" aria-label="Preparing this week's ideas">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2.5">
              <Shimmer className="h-5 w-2/5" />
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      )}

      {enough && !loading && moment && visible.length === 0 && (
        <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">
          You have seen this week&apos;s ideas. A new Moment arrives next week.
        </p>
      )}

      {visible.length > 0 && (
        <>
          <p className="mt-1 text-[15px] text-ink-secondary">Three small ideas, built from what you both shared.</p>
          <ul className="mt-5 divide-y divide-warm-grey-100">
            {visible.map((idea) => {
              const isPlanned = moment?.planned.includes(idea.title)
              const isPlanning = planning === idea.title
              return (
                <li key={idea.title} className="py-5 first:pt-0 last:pb-0">
                  <h3 className="text-[17px] font-semibold tracking-tight text-ink">{idea.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink-secondary">{idea.description}</p>
                  {idea.basedOn && idea.basedOn.length > 0 && (
                    <p className="mt-2 text-[13px] leading-snug text-ink-tertiary">From {idea.basedOn.join(', ')}</p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {isPlanned ? (
                      <p className="text-[13px] font-medium text-success">Added to your plan</p>
                    ) : isPlanning ? (
                      <>
                        <div role="group" aria-label="When" className="inline-flex rounded-full bg-warm-grey-100 p-1">
                          <SegmentButton onClick={() => addToPlan(idea, 'tonight')}>Tonight</SegmentButton>
                          <SegmentButton onClick={() => addToPlan(idea, 'soon')}>In 3 days</SegmentButton>
                        </div>
                        <button onClick={() => setPlanning(null)} className="text-[13px] text-ink-tertiary transition-colors hover:text-ink">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setPlanning(idea.title)}
                          className="min-h-[36px] rounded-full bg-burgundy px-4 text-[13px] font-semibold text-white transition-transform active:scale-[0.98]"
                        >
                          Add to plan
                        </button>
                        <button onClick={() => dismiss(idea.title)} className="text-[13px] text-ink-tertiary transition-colors hover:text-ink">
                          Not this one
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function SegmentButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'min-h-[32px] rounded-full px-3.5 text-[13px] font-medium text-ink transition-all active:scale-[0.98]',
        'hover:bg-white hover:shadow-sm',
      )}
    >
      {children}
    </button>
  )
}
