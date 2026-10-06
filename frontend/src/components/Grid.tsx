import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from './cn'

/**
 * Grid de dados (tabela de relatório). Tipografia de dados (Roboto) e bordas padronizadas.
 * As linhas usam as classes de grid.css (grid-row, grid-subtotal, grid-detail, grid-group, grid-day);
 * células e cabeçalhos usam GridCell e GridTh.
 */
export function Grid({ className, ...props }: ComponentProps<'table'>) {
  return <table className={cn('w-full border-collapse font-data text-sm', className)} {...props} />
}

const thVariants = cva(
  'border-b border-line bg-surface-muted px-3 py-2 text-xs font-semibold uppercase tracking-label text-fg-muted',
  {
    variants: { align: { left: 'text-left', center: 'text-center', right: 'text-right' } },
    defaultVariants: { align: 'left' },
  },
)

export function GridTh({ align, className, ...props }: ComponentProps<'th'> & VariantProps<typeof thVariants>) {
  return <th className={cn(thVariants({ align }), className)} {...props} />
}

const cellVariants = cva('border-b border-line px-3 py-2', {
  variants: {
    align: { left: 'text-left', center: 'text-center', right: 'text-right tabular-nums' },
    tone: { default: '', subtle: 'text-fg-subtle', faint: 'text-fg-faint' },
  },
  defaultVariants: { align: 'left', tone: 'default' },
})

/** Célula com borda inferior; valores à direita usam algarismos tabulares. */
export function GridCell({ align, tone, className, ...props }: ComponentProps<'td'> & VariantProps<typeof cellVariants>) {
  return <td className={cn(cellVariants({ align, tone }), className)} {...props} />
}
