import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from './cn'

export const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      positive: 'bg-positive-subtle text-positive',
      negative: 'bg-danger-subtle text-danger',
      neutral: 'bg-surface-sunken text-fg-muted',
    },
  },
  defaultVariants: { variant: 'neutral' },
})

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>

export function Badge({ variant, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
