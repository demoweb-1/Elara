import { cn } from '@/lib/utils'

// Elara's mascot. Breathes while idle and shows a slow ring while she is thinking.
export type OrbState = 'idle' | 'thinking'

export function ElaraOrb({ state, size = 40 }: { state: OrbState; size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <div className={cn('elara-orb-mini', `is-${state}`)} style={{ width: size * 0.78, height: size * 0.78 }} />
    </div>
  )
}
