import type { ComponentProps } from 'react'
import { cn } from './cn'

export type CheckboxProps = Omit<ComponentProps<'input'>, 'type'> & {
  /** Compatível com a API antiga do Radix Checkbox. */
  onCheckedChange?: (checked: boolean) => void
}

/** Checkbox nativo com cores do design system. */
export function Checkbox({ className, onCheckedChange, onChange, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-action accent-action',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      onChange={(e) => {
        onChange?.(e)
        onCheckedChange?.(e.target.checked)
      }}
      {...props}
    />
  )
}
