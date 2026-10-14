import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Shimmer({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton', className)} />
}

function Live({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  )
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Live className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-8 py-8 space-y-4">
      <Shimmer className="h-8 w-48" />
      <Shimmer className="h-4 w-72 max-w-full" />
      <div className="space-y-3 pt-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="material rounded-2xl p-4 flex gap-3">
            <Shimmer className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-3/4" />
              <Shimmer className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </Live>
  )
}

export function ChatSkeleton() {
  const rows: [string, string][] = [['left', 'w-64'], ['right', 'w-40'], ['left', 'w-72'], ['right', 'w-52']]
  return (
    <Live className="space-y-5 max-w-2xl mx-auto">
      {rows.map(([side, w], i) => (
        <div key={i} className={cn('flex', side === 'right' ? 'justify-end' : 'justify-start')}>
          <Shimmer className={cn('h-12 rounded-2xl max-w-[80%]', w)} />
        </div>
      ))}
    </Live>
  )
}

export function TogetherSkeleton() {
  return (
    <Live className="max-w-lg mx-auto px-4 py-10 space-y-5">
      <Shimmer className="h-8 w-64 max-w-full" />
      <Shimmer className="h-4 w-full" />
      <div className="material rounded-3xl p-8 flex flex-col items-center gap-5">
        <div className="flex items-center">
          <Shimmer className="w-[76px] h-[76px] rounded-full" />
          <Shimmer className="w-[76px] h-[76px] rounded-full -ml-6" />
        </div>
        <Shimmer className="h-12 w-full rounded-2xl" />
        <Shimmer className="h-12 w-full rounded-2xl" />
      </div>
    </Live>
  )
}

export function SuggestionsSkeleton() {
  return (
    <Live className="space-y-3 py-4">
      <p className="text-sm text-ink-secondary text-center pb-1">Elara is thinking of suggestions…</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="material rounded-2xl p-5 space-y-3">
          <Shimmer className="h-5 w-2/3" />
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-5/6" />
        </div>
      ))}
    </Live>
  )
}
