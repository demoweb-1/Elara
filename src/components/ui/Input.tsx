import { type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full rounded-2xl field border px-4 py-2.5 text-sm text-ink',
          'placeholder:text-ink-tertiary transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-burgundy/20 focus:border-burgundy',
          error ? 'border-error' : 'border-warm-grey-200',
          className
        )}
        {...props}
      />
      {hint && !error && <p className="text-xs text-ink-tertiary">{hint}</p>}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  children?: ReactNode
}

export function Textarea({ label, error, hint, className, id, children, ...props }: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={cn(
          'w-full rounded-2xl field border px-4 py-2.5 text-sm text-ink',
          'placeholder:text-ink-tertiary transition-all duration-200 resize-none',
          'focus:outline-none focus:ring-2 focus:ring-burgundy/20 focus:border-burgundy',
          error ? 'border-error' : 'border-warm-grey-200',
          className
        )}
        {...props}
      >
        {children}
      </textarea>
      {hint && !error && <p className="text-xs text-ink-tertiary">{hint}</p>}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  children: ReactNode
}

export function Select({ label, error, className, id, children, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'w-full rounded-2xl field border px-4 py-2.5 text-sm text-ink',
          'transition-all duration-200 cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-burgundy/20 focus:border-burgundy',
          error ? 'border-error' : 'border-warm-grey-200',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}
