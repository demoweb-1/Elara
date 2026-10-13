import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'burgundy' | 'success' | 'warning' | 'error' | 'accent'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-warm-grey-50 text-ink-secondary border-warm-grey-200',
  burgundy: 'bg-burgundy-50 text-burgundy border-burgundy-100',
  success: 'bg-success-light text-success border-success/20',
  warning: 'bg-warning-light text-warning border-warning/20',
  error: 'bg-error-light text-error border-error/20',
  accent: 'bg-accent-light text-accent border-accent/20',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
