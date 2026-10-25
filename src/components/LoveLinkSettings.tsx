import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { enableLoveLink, disableLoveLink, lovelinkConfigured, lovelinkSupported, needsHomeScreenOnIOS } from '@/lib/lovelink'
import { cn } from '@/lib/utils'

type Settings = { enabled: boolean; quiet_start: number; quiet_end: number }
const DEFAULTS: Settings = { enabled: false, quiet_start: 22, quiet_end: 8 }
const hours = Array.from({ length: 24 }, (_, h) => h)
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'AM' : 'PM'}`

export function LoveLinkSettings() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [s, setS] = useState<Settings>(DEFAULTS)
  const [busy, setBusy] = useState(false)
  const [testResult, setTestResult] = useState('')

  useEffect(() => {
    if (!user) return
    supabase.from('lovelink_settings')
      .select('enabled, quiet_start, quiet_end')
      .eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setS(data as Settings) })
  }, [user])

  const save = async (next: Settings) => {
    if (!user) return false
    const { error } = await supabase.from('lovelink_settings').upsert({
      user_id: user.id,
      ...next,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      updated_at: new Date().toISOString(),
    })
    if (error) { toast('Could not save your LoveLink settings', 'error'); return false }
    setS(next)
    return true
  }

  const toggle = async () => {
    if (!user || busy) return
    setBusy(true)
    try {
      if (s.enabled) {
        await disableLoveLink(user.id)
        if (await save({ ...s, enabled: false })) toast('LoveLink is off', 'success')
      } else {
        await enableLoveLink(user.id)
        if (await save({ ...s, enabled: true })) toast('LoveLink is on', 'success')
      }
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const updateQuiet = (patch: Partial<Settings>) => {
    const next = { ...s, ...patch }
    if (s.enabled) save(next)
    else setS(next)
  }

  const sendTest = async () => {
    setTestResult('Sending…')
    const { data, error } = await supabase.functions.invoke('lovelink-test')
    if (error) { setTestResult(`Could not send. ${error.message}`); return }
    const results: string[] = data?.results ?? []
    if (results.length === 0) setTestResult('No device is registered. Turn LoveLink off and on again.')
    else if (results.every((r) => r === 'sent')) setTestResult('Sent. If nothing appears, check that notifications are allowed for this app in your device settings.')
    else setTestResult(`Problem: ${results.filter((r) => r !== 'sent').join(' | ')}`)
  }

  const select = 'min-h-[40px] rounded-xl border border-warm-grey-200 bg-white px-3 text-[15px] text-ink'

  return (
    <section aria-labelledby="lovelink-title" className="material mb-8 rounded-3xl px-5 py-6 md:px-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="lovelink-title" className="text-[20px] font-semibold tracking-tight text-ink">LoveLink</h2>
          <p className="mt-1 max-w-[52ch] text-[15px] leading-relaxed text-ink-secondary">
            A short note when your partner shares something with you or answers a question for you two. Never more than three a day, never during quiet hours, and nothing private on your lock screen.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={s.enabled}
          aria-label="Send me LoveLinks"
          disabled={busy || !lovelinkSupported() || !lovelinkConfigured()}
          onClick={toggle}
          className={cn(
            'relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40',
            s.enabled ? 'bg-burgundy' : 'bg-warm-grey-200',
          )}
        >
          <span className={cn(
            'absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
            s.enabled && 'translate-x-5',
          )} />
        </button>
      </div>

      {!lovelinkConfigured() && (
        <p className="mt-4 text-[13px] text-ink-tertiary">LoveLink is not set up on this site yet.</p>
      )}
      {!lovelinkSupported() && (
        <p className="mt-4 text-[13px] text-ink-tertiary">This browser cannot send notifications. Try Chrome or Safari.</p>
      )}
      {lovelinkSupported() && needsHomeScreenOnIOS() && (
        <p className="mt-4 text-[13px] leading-relaxed text-ink-secondary">
          On iPhone, first add Elara to your Home Screen (Share, then Add to Home Screen). Then open it from there to turn LoveLink on.
        </p>
      )}

      {s.enabled && (
        <div className="mt-6 border-t border-warm-grey-100 pt-6">
          <button
            onClick={sendTest}
            className="min-h-[40px] rounded-full border border-burgundy px-4 text-[13px] font-medium text-burgundy transition-transform active:scale-[0.98]"
          >
            Send a test now
          </button>
          {testResult && <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">{testResult}</p>}
        </div>
      )}

      <div className="mt-6 grid gap-4 border-t border-warm-grey-100 pt-6 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-secondary">
          Quiet from
          <select className={select} value={s.quiet_start} onChange={(e) => updateQuiet({ quiet_start: Number(e.target.value) })}>
            {hours.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-secondary">
          Quiet until
          <select className={select} value={s.quiet_end} onChange={(e) => updateQuiet({ quiet_end: Number(e.target.value) })}>
            {hours.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </label>
      </div>
    </section>
  )
}
