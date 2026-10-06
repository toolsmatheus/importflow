import { X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { cn } from './cn'

type DialogContextValue = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = createContext<DialogContextValue | null>(null)

function useDialog() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('Dialog components must be used within <Dialog>')
  return ctx
}

export type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
}

export function DialogContent({ className, children, ...props }: ComponentProps<'div'>) {
  const { open, onOpenChange } = useDialog()
  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/50"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 grid w-full max-w-lg gap-4 rounded-lg border border-line bg-surface p-6 shadow-sm',
          className,
        )}
        {...props}
      >
        {children}
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 rounded-sm text-fg-muted opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </button>
      </div>
    </div>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-lg font-semibold leading-none text-fg-strong', className)} {...props} />
}

export function DialogDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-fg-muted', className)} {...props} />
}
