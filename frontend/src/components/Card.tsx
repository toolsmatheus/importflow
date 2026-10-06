import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from './cn'

export const cardVariants = cva('rounded-lg border border-line p-4', {
  variants: {
    // panel: seção de página; flat: cartão dentro de um painel (sem sombra); inset: mini-cartão de destaque.
    variant: {
      panel: 'bg-surface shadow-sm',
      flat: 'bg-surface',
      inset: 'bg-surface-muted p-3',
    },
  },
  defaultVariants: { variant: 'panel' },
})

export type CardProps = ComponentProps<'div'> & VariantProps<typeof cardVariants>

export function Card({ variant, className, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />
}
