import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-burgundy text-white hover:bg-burgundy-dark active:bg-burgundy-900 btn-gloss',
  secondary: 'glass-pill text-burgundy-700',
  ghost: 'text-ink-secondary hover:text-ink hover:bg-white/60',
  danger: 'glass-pill text-error',
  outline: 'glass-pill text-burgundy-700',
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-sm px-4 py-1.5 min-h-[36px] rounded-full gap-1.5',
  md: 'text-sm px-5 py-2.5 min-h-[44px] rounded-full gap-2',
  lg: 'text-base px-7 py-3 min-h-[48px] rounded-full gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}
