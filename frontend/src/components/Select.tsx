import type { ComponentProps } from 'react'
import { cn } from './cn'
import { controlVariants } from './Input'

/** Select nativo com a seta desenhada próxima ao texto (a seta nativa fica colada na borda direita). */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select {...props} className={cn(controlVariants(), 'w-full appearance-none truncate pr-8', className)}>
        {children}
      </select>
      <svg
        className="pointer-events-none absolute top-1/2 right-2.5 h-3 w-3 -translate-y-1/2 text-fg-muted"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" />
      </svg>
    </div>
  )
}
