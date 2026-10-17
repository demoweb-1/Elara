import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'

export function GuessMeEntry() {
  return (
    <div className="material mb-6 flex items-center gap-4 rounded-2xl p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-burgundy-50">
        <Heart className="h-5 w-5 text-burgundy" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Guess Me</p>
        <p className="text-xs text-ink-secondary">Guess each other's answers and see what you discovered.</p>
      </div>
      <Link to="/guess" className="btn-gloss inline-flex min-h-[40px] shrink-0 items-center rounded-full bg-burgundy px-4 text-sm font-medium text-white">
        Play
      </Link>
    </div>
  )
}
