import { useState, useEffect } from 'react'
import { Shield, Download, Trash2, Eye, AlertTriangle, Check } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { exportData, deleteAccount } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Modal'

export function Privacy() {
  const { user, profile, signOut } = useAuth()
  const { toast } = useToast()
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [prefs, setPrefs] = useState<any>(null)

  useEffect(() => { if (user) loadPrefs() }, [user])

  const loadPrefs = async () => {
    if (!user) return
    const { data } = await supabase.from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle()
    if (data) setPrefs(data)
  }

  const handleExport = async () => {
    setExporting(true)
    const { data, error } = await exportData()
    if (error) toast(error, 'error')
    else if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `elara-export-${new Date().toISOString().slice(0, 10)}.json`; a.click()
      URL.revokeObjectURL(url)
      toast('Your data has been exported', 'success')
    }
    setExporting(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await deleteAccount()
    if (error) { toast(error, 'error'); setDeleting(false); setDeleteOpen(false) }
    else { toast('Account deleted', 'success'); await signOut(); window.location.href = import.meta.env.BASE_URL }
  }

  const handleUpdatePref = async (key: string, value: boolean) => {
    if (!user || !prefs) return
    const updated = { ...prefs, [key]: value }; setPrefs(updated)
    const { error } = await supabase.from('notification_preferences').update({ [key]: value }).eq('user_id', user.id)
    if (error) { toast('Failed to update preference', 'error'); setPrefs(prefs) }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 md:px-8 py-4 max-w-2xl mx-auto w-full">
        <h1 className="text-xl font-semibold text-ink mb-1">Privacy & Data</h1>
        <p className="text-sm text-ink-tertiary mb-6">Control your data and privacy settings</p>

        <Card className="p-5 mb-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-burgundy-50 flex items-center justify-center shrink-0"><Shield className="w-5 h-5 text-burgundy" /></div>
            <div>
              <h2 className="font-semibold text-ink mb-1">AI Processing</h2>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Conversations with Elara are processed by Google Gemini, an external AI provider.
                The free-tier terms may permit use of submitted data to improve Google's services.
                Your content is not end-to-end encrypted.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            {profile?.ai_consent ? (
              <><Badge variant="success"><Check className="w-3 h-3" />Consent given</Badge>
              <span className="text-xs text-ink-tertiary">You can withdraw consent by deleting your account</span></>
            ) : <Badge variant="warning">Consent not recorded</Badge>}
          </div>
        </Card>

        <Card className="p-5 mb-4">
          <h2 className="font-semibold text-ink mb-3">Notification preferences</h2>
          {prefs ? (
            <div className="space-y-3">
              <ToggleRow label="In-app notifications" desc="See notifications within Elara" checked={prefs.in_app_enabled} onChange={(v) => handleUpdatePref('in_app_enabled', v)} />
              <ToggleRow label="Reminder notifications" desc="Get notified about upcoming reminders" checked={prefs.reminder_notifications} onChange={(v) => handleUpdatePref('reminder_notifications', v)} />
              <ToggleRow label="Memory suggestions" desc="Suggestions for memories to save" checked={prefs.memory_suggestions} onChange={(v) => handleUpdatePref('memory_suggestions', v)} />
              <ToggleRow label="Partner updates" desc="When your partner shares or revokes memories" checked={prefs.partner_updates} onChange={(v) => handleUpdatePref('partner_updates', v)} />
            </div>
          ) : <p className="text-sm text-ink-tertiary">Loading preferences…</p>}
          <div className="mt-4 pt-4 border-t border-warm-grey-100">
            <p className="text-xs text-ink-tertiary leading-relaxed">Push notifications and email delivery are not currently configured. Reminders are visible within the app only.</p>
          </div>
        </Card>

        <Card className="p-5 mb-4">
          <h2 className="font-semibold text-ink mb-3">Your data</h2>
          <div className="space-y-2">
            <button onClick={handleExport} disabled={exporting} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-warm-grey-50 hover:bg-warm-grey-100 transition-all text-left disabled:opacity-50">
              <div className="flex items-center gap-3"><Download className="w-4 h-4 text-burgundy" />
                <div><p className="text-sm font-medium text-ink">Export your data</p><p className="text-xs text-ink-tertiary">Download all your Elara data as JSON</p></div></div>
            </button>
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-warm-grey-50">
              <div className="flex items-center gap-3"><Eye className="w-4 h-4 text-burgundy" />
                <div><p className="text-sm font-medium text-ink">Privacy overview</p><p className="text-xs text-ink-tertiary">Your conversations are private and encrypted at rest</p></div></div>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-error/20">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-ink mb-1">Danger zone</h2>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Deleting your account permanently removes all your data — conversations, memories, reminders, and shares.
                Any active shares with your partner will be revoked. Already-viewed information cannot be erased from
                another person's memory. This action cannot be undone.
              </p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="w-4 h-4" />Delete my account</Button>
        </Card>

        <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete}
          title="Delete your account permanently?" message="This will permanently delete all your conversations, memories, reminders, and profile. Any shared memories will be revoked. This cannot be undone."
          confirmLabel="Delete everything" danger loading={deleting} />
      </div>
    </div>
  )
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div><p className="text-sm font-medium text-ink">{label}</p><p className="text-xs text-ink-tertiary">{desc}</p></div>
      <button onClick={() => onChange(!checked)} className={`relative w-11 h-6 rounded-full transition-all ${checked ? 'bg-burgundy' : 'bg-warm-grey-200'}`} role="switch" aria-checked={checked}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  )
}
