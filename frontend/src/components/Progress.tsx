import type { ComponentProps } from 'react'
import { cn } from './cn'

export type ProgressProps = ComponentProps<'div'> & {
  value?: number | null
}

/** Barra de progresso simples (sem Radix). */
export function Progress({ value = 0, className, ...props }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value ?? 0))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn('relative h-3 w-full overflow-hidden rounded-full bg-surface-sunken', className)}
      {...props}
    >
      <div className="h-full bg-action transition-all duration-300 ease-in-out" style={{ width: `${pct}%` }} />
    </div>
  )
}
