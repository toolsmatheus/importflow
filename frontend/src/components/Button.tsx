import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from './cn'

export const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium transition-colors ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40',
  {
    variants: {
      variant: {
        primary: 'border-action bg-action text-white enabled:hover:border-action-hover enabled:hover:bg-action-hover',
        secondary: 'border-line bg-surface text-fg enabled:hover:border-line-strong',
        danger: 'border-danger bg-surface text-danger enabled:hover:bg-danger-subtle',
        ghost: 'border-transparent bg-transparent text-fg-muted enabled:hover:bg-surface-muted enabled:hover:text-fg',
      },
      size: {
        sm: 'min-h-control-sm px-3 has-[>svg]:px-2.5 has-[>[aria-hidden=true]]:px-2.5',
        md: 'min-h-control px-4 has-[>svg]:px-3 has-[>[aria-hidden=true]]:px-3',
        icon: 'min-h-control min-w-control px-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>

export function Button({ variant, size, type = 'button', className, ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
