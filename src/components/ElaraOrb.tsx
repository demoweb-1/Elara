import { useEffect, useRef } from 'react'
import { getSpeechLevel } from '@/lib/elaraVoice'
import { cn } from '@/lib/utils'

// Elara's mascot. It shows what Elara is doing:
// idle = breathing, thinking = a slow ring, listening = a halo, speaking = moves with her voice.
export type OrbState = 'idle' | 'thinking' | 'listening' | 'speaking'

export function ElaraOrb({ state, size = 40 }: { state: OrbState; size?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (state !== 'speaking') { el.style.setProperty('--level', '0'); return }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let smooth = 0
    const tick = () => {
      smooth = smooth * 0.7 + getSpeechLevel() * 0.3
      el.style.setProperty('--level', smooth.toFixed(3))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state])

  return (
    <div className="flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <div
        ref={ref}
        className={cn('elara-orb-mini', `is-${state}`)}
        style={{ width: size * 0.78, height: size * 0.78 }}
      />
    </div>
  )
}
