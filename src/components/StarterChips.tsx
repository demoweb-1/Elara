import { STARTER_PROMPTS } from '@/lib/sharing'

export function StarterChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="px-3 md:px-8 pb-2">
      <p className="text-xs text-ink-secondary mb-1.5 px-1">Tell Elara about you:</p>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Conversation starters">
        {STARTER_PROMPTS.map((p) => (
          <button key={p.label} onClick={() => onPick(p.text)}
            className="glass-pill shrink-0 rounded-full px-4 min-h-[36px] text-sm font-medium text-burgundy-700 whitespace-nowrap">
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
