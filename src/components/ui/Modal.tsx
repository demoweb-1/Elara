import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  if (!open) return null

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }[size]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
      <div
        className={cn(
          'relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full animate-slide-up',
          'max-h-[90vh] overflow-y-auto',
          sizeClass
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="px-6 pt-6 pb-4 border-b border-warm-grey-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
                {description && <p className="text-sm text-ink-secondary mt-1">{description}</p>}
              </div>
              <button
                onClick={onClose}
                className="text-ink-tertiary hover:text-ink transition-colors -mr-2 -mt-1 p-1"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-ink-secondary leading-relaxed mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2.5 text-sm font-medium text-ink-secondary hover:text-ink transition-colors rounded-xl hover:bg-warm-grey-50"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            'px-4 py-2.5 text-sm font-medium rounded-xl transition-all shadow-sm disabled:opacity-50',
            danger
              ? 'bg-error text-white hover:bg-error/90'
              : 'bg-burgundy text-white hover:bg-burgundy-dark'
          )}
        >
          {loading ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
