import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import type { SendJobSnapshot } from '@/types'

export function SoftExpand({
  label,
  count,
  tone = 'neutral',
  children,
  defaultOpen = false,
  actions,
}: {
  label: string
  count?: number
  tone?: 'neutral' | 'warning' | 'error' | 'success'
  children: ReactNode
  defaultOpen?: boolean
  actions?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background/60">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              !open && '-rotate-90'
            )}
          />
          <span className="font-medium text-foreground">{label}</span>
          {count !== undefined ? (
            <span
              className={cn(
                'tabular-nums text-muted-foreground',
                tone === 'warning' && count > 0 && 'text-amber-700 dark:text-amber-300',
                tone === 'error' && count > 0 && 'text-destructive',
                tone === 'success' && 'text-emerald-700 dark:text-emerald-300'
              )}
            >
              {formatNumber(count)}
            </span>
          ) : null}
        </button>
        {actions}
      </div>
      {open ? <div className="border-t border-border px-3 py-3">{children}</div> : null}
    </div>
  )
}

export function skipReasonLabel(reason: string): string {
  if (reason === 'codigo_barras') return 'Código de barras já existe'
  if (reason === 'codigo_migracao') return 'Código de migração já existe'
  return reason
}

export function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function phaseLabel(job: SendJobSnapshot): string {
  switch (job.phase) {
    case 'auxiliaries': {
      const done = (job.auxInserted ?? 0) + (job.auxFailed ?? 0) + (job.auxSkipped ?? 0)
      const total = job.auxTotal ?? 0
      return `Inserindo auxiliares (${formatNumber(done)}/${formatNumber(total)})…`
    }
    case 'catalogs':
      return 'Carregando catálogos do banco…'
    case 'products':
      return `Enviando produtos — lote ${job.currentBatch}/${job.totalBatches}`
    case 'done':
      return job.status === 'completed'
        ? 'Concluído'
        : job.status === 'cancelled'
          ? 'Cancelado'
          : job.status === 'failed'
            ? 'Falhou'
            : 'Finalizado'
    default:
      if (job.status === 'paused') return 'Pausado'
      if (job.status === 'queued') return 'Na fila…'
      return `Status: ${job.status}`
  }
}
