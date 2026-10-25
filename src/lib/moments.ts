// Moments: one small set of ideas per week, stored on this device.
// Ideas are built from your own memories and the ones your partner shared with you. Nothing else is used.

export type MomentIdea = { title: string; description: string; basedOn?: string[] }

export type Moment = {
  week: string            // ISO week, e.g. 2026-W43
  ideas: MomentIdea[]
  dismissed: string[]     // titles the user chose "Not this one" for
  planned: string[]       // titles added to Reminders
}

export function weekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// The Monday that starts the current week, for display.
export function weekStartLabel(d = new Date()): string {
  const monday = new Date(d)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const storageKey = (userId: string) => `elara.moment.${userId}`

// Returns this week's Moment only. Last week's is ignored, so a new one is made each Monday.
export function loadMoment(userId: string): Moment | null {
  try {
    const m = JSON.parse(localStorage.getItem(storageKey(userId)) || 'null') as Moment | null
    return m && m.week === weekKey() ? m : null
  } catch {
    return null
  }
}

export function saveMoment(userId: string, m: Moment) {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(m)) } catch { /* storage unavailable */ }
}
