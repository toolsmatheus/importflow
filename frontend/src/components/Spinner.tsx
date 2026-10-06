import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from './cn'

const spinnerVariants = cva('inline-block animate-spin rounded-full border-action-soft border-t-action', {
  variants: { size: { sm: 'h-3 w-3 border-2', lg: 'h-9 w-9 border-[3px]' } },
  defaultVariants: { size: 'sm' },
})

export function Spinner({ size, className, ...props }: ComponentProps<'span'> & VariantProps<typeof spinnerVariants>) {
  return <span aria-hidden="true" className={cn(spinnerVariants({ size }), className)} {...props} />
}
