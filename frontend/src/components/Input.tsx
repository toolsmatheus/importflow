import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from './cn'

/** Aparência única de campos de entrada (input, select, caixa composta). */
export const controlVariants = cva(
  'min-h-control rounded-md border border-line bg-surface px-3 py-1 text-sm text-fg transition-colors ' +
    'enabled:hover:border-line-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-50',
  {
    variants: {
      // "composto": caixa que contém o input e mensagens ao lado; o foco vem do input interno.
      composto: {
        false: 'focus-visible:border-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        true: 'flex cursor-text items-center gap-3 hover:border-line-strong focus-within:border-action focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
      },
    },
    defaultVariants: { composto: false },
  },
)

export type InputProps = ComponentProps<'input'> & VariantProps<typeof controlVariants>

export function Input({ className, composto, ...props }: InputProps) {
  return <input className={cn(controlVariants({ composto }), className)} {...props} />
}
