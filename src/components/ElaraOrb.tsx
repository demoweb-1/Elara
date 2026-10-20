import { cn } from '@/lib/utils'

// Elara's mascot. It shows what Elara is doing:
// idle = breathing, thinking = a slow ring, listening = a halo, speaking = a steady pulse.
export type OrbState = 'idle' | 'thinking' | 'listening' | 'speaking'

export function ElaraOrb({ state, size = 40 }: { state: OrbState; size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <div className={cn('elara-orb-mini', `is-${state}`)} style={{ width: size * 0.78, height: size * 0.78 }} />
    </div>
  )
}
