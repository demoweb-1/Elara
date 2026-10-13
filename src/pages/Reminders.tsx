import { useState, useEffect } from 'react'
import { Bell, Plus, Trash2, Edit2, Check, Calendar } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { getUserTimezone, daysUntil, formatDate, toDatetimeLocal, fromDatetimeLocal, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, Spinner } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import type { Reminder } from '@/types'

const reminderTypes: { value: Reminder['reminder_type']; label: string }[] = [
  { value: 'birthday', label: 'Birthday' }, { value: 'anniversary', label: 'Anniversary' },
  { value: 'occasion', label: 'Special Occasion' }, { value: 'plan', label: 'Personal Plan' },
  { value: 'general', label: 'General' },
]

export function Reminders() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Reminder | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => { if (user) loadReminders() }, [user])

  const loadReminders = async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase.from('reminders').select('*').eq('user_id', user.id).order('due_at', { ascending: true })
    if (error) toast('Failed to load reminders', 'error')
    else setReminders((data as Reminder[]) || [])
    setLoading(false)
  }

  const handleSave = async (d: Partial<Reminder>) => {
    if (!user) return
    if (editing) {
      const { error } = await supabase.from('reminders').update({
        title: d.title, description: d.description, reminder_type: d.reminder_type, due_at: d.due_at, advance_notice_days: d.advance_notice_days,
      }).eq('id', editing.id)
      if (error) toast('Failed to update reminder', 'error')
      else { toast('Reminder updated', 'success'); setEditing(null); loadReminders() }
    } else {
      const { error } = await supabase.from('reminders').insert({
        user_id: user.id, title: d.title, description: d.description, reminder_type: d.reminder_type,
        due_at: d.due_at, timezone: getUserTimezone(), advance_notice_days: d.advance_notice_days || 7,
      })
      if (error) toast('Failed to create reminder', 'error')
      else { toast('Reminder created', 'success'); setCreating(false); loadReminders() }
    }
  }

  const handleToggle = async (r: Reminder) => {
    const completed = !r.completed
    const { error } = await supabase.from('reminders').update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', r.id)
    if (error) toast('Failed to update', 'error')
    else loadReminders()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('reminders').delete().eq('id', deleteTarget.id)
    if (error) toast('Failed to delete', 'error')
    else { toast('Reminder deleted', 'success'); setDeleteTarget(null); setConfirmOpen(false); loadReminders() }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>

  const upcoming = reminders.filter((r) => !r.completed)
  const completed = reminders.filter((r) => r.completed)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 md:px-8 py-4 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <div><h1 className="text-xl font-semibold text-ink">Reminders</h1><p className="text-sm text-ink-tertiary">Birthdays, anniversaries, meaningful dates</p></div>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4" />Add reminder</Button>
        </div>

        <div className="bg-accent-light/50 border border-accent/20 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs text-ink-secondary leading-relaxed">Reminders are stored in the app. Push notifications and email delivery are not currently configured — check back regularly for upcoming dates.</p>
        </div>

        {reminders.length === 0 ? (
          <EmptyState icon={<Bell className="w-7 h-7" />} title="No reminders yet"
            description="Add birthdays, anniversaries, and important dates so you never miss what matters."
            action={<Button size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4" />Add reminder</Button>} />
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="mb-6">
                <h2 className="text-sm font-semibold text-ink mb-3">Upcoming ({upcoming.length})</h2>
                <div className="space-y-2">
                  {upcoming.map((r) => <ReminderCard key={r.id} r={r} onEdit={() => setEditing(r)} onDelete={() => { setDeleteTarget(r); setConfirmOpen(true) }} onToggle={() => handleToggle(r)} />)}
                </div>
              </section>
            )}
            {completed.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-ink-tertiary mb-3">Completed ({completed.length})</h2>
                <div className="space-y-2">
                  {completed.map((r) => <ReminderCard key={r.id} r={r} onEdit={() => setEditing(r)} onDelete={() => { setDeleteTarget(r); setConfirmOpen(true) }} onToggle={() => handleToggle(r)} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {(editing || creating) && <ReminderEditor r={editing} onClose={() => { setEditing(null); setCreating(false) }} onSave={handleSave} />}

      <ConfirmDialog open={confirmOpen} onClose={() => { setConfirmOpen(false); setDeleteTarget(null) }} onConfirm={handleDelete}
        title="Delete this reminder?" message="This will permanently remove this reminder." confirmLabel="Delete" danger />
    </div>
  )
}

function ReminderCard({ r, onEdit, onDelete, onToggle }: { r: Reminder; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const days = daysUntil(r.due_at)
  const overdue = days < 0 && !r.completed
  const soon = days >= 0 && days <= r.advance_notice_days

  return (
    <Card className={cn('p-4 group', r.completed && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <button onClick={onToggle} className={cn('w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all',
          r.completed ? 'bg-success border-success text-white' : 'border-warm-grey-300 hover:border-burgundy')}>
          {r.completed && <Check className="w-3 h-3" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className={cn('text-sm font-medium text-ink', r.completed && 'line-through')}>{r.title}</p>
            <Badge variant={r.reminder_type === 'birthday' ? 'accent' : r.reminder_type === 'anniversary' ? 'burgundy' : 'default'}>
              {reminderTypes.find((t) => t.value === r.reminder_type)?.label || r.reminder_type}
            </Badge>
          </div>
          {r.description && <p className="text-xs text-ink-secondary mb-1">{r.description}</p>}
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-tertiary flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(r.due_at)}</span>
            {!r.completed && (overdue ? <span className="text-xs text-error">{Math.abs(days)} days ago</span>
              : days === 0 ? <span className="text-xs text-warning">Today</span>
              : soon ? <span className="text-xs text-warning">In {days} day{days !== 1 ? 's' : ''}</span>
              : <span className="text-xs text-ink-tertiary">In {days} days</span>)}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-warm-grey-50 text-ink-tertiary hover:text-burgundy"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-warm-grey-50 text-ink-tertiary hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </Card>
  )
}

function ReminderEditor({ r, onClose, onSave }: { r: Reminder | null; onClose: () => void; onSave: (d: Partial<Reminder>) => void }) {
  const [title, setTitle] = useState(r?.title || '')
  const [description, setDescription] = useState(r?.description || '')
  const [type, setType] = useState<Reminder['reminder_type']>(r?.reminder_type || 'general')
  const [dueAt, setDueAt] = useState(r ? toDatetimeLocal(r.due_at) : '')
  const [advance, setAdvance] = useState(r?.advance_notice_days || 7)

  return (
    <Modal open onClose={onClose} title={r ? "Edit reminder" : "New reminder"}>
      <div className="space-y-4">
        <Input label="Title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Birthday, anniversary…" />
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as Reminder['reminder_type'])}>
          {reminderTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Input label="Date & time" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        <Textarea label="Notes (optional)" value={description || ''} onChange={(e) => setDescription(e.target.value)} placeholder="Additional details…" rows={2} />
        <Input label="Advance notice (days)" type="number" value={advance} onChange={(e) => setAdvance(parseInt(e.target.value) || 0)} min={0} hint="Elara highlights reminders this many days before." />
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ title, description: description || null, reminder_type: type, due_at: fromDatetimeLocal(dueAt), advance_notice_days: advance })} disabled={!title.trim() || !dueAt}>{r ? 'Save' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  )
}
