import type { ComponentProps } from 'react'
import { cn } from './cn'

/** Grupo segmentado de opções (alternância de modo ou de agrupamento). */
export function ToggleGroup({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('inline-flex flex-wrap gap-0.5 rounded-full border border-line bg-surface-muted p-1', className)} {...props} />
}

interface ToggleButtonProps extends ComponentProps<'button'> {
  ativo?: boolean
}

export function ToggleButton({ ativo = false, type = 'button', className, ...props }: ToggleButtonProps) {
  return (
    <button
      type={type}
      data-state={ativo ? 'active' : undefined}
      className={cn(
        'min-h-7 cursor-pointer whitespace-nowrap rounded-full px-3 text-sm font-medium text-fg-muted transition-colors ' +
          'enabled:hover:text-fg data-[state=active]:bg-surface data-[state=active]:text-action data-[state=active]:shadow-sm ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}
