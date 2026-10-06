import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Search } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import type { EnvioJobSnapshot, ValidationCheckSummaryItem, ValidationIssue } from '@/types'
import { Button, Badge, Card, GridTh, GridCell } from '@/components'
interface PainelChecagensInconsistenciaProps {
  checks: ValidationCheckSummaryItem[]
  issues?: ValidationIssue[]
  title?: string
  description?: string
  truncated?: boolean
  onDownloadCsv?: () => void
  /** Abre automaticamente checagens que têm ocorrências. */
  defaultExpandWithIssues?: boolean
  /** Lista sem Card — para embutir em seções recolhíveis. */
  embedded?: boolean
}

function groupIssuesByCheck(issues: ValidationIssue[]): Map<string, ValidationIssue[]> {
  const map = new Map<string, ValidationIssue[]>()
  for (const issue of issues) {
    const id = issue.checkId ?? (issue.severity === 'warning' ? 'other_warning' : 'other_error')
    const list = map.get(id) ?? []
    list.push(issue)
    map.set(id, list)
    // Compatível com validações antigas que ainda usam checkId "other"
    if (id === 'other_error' || id === 'other_warning') {
      const legacy = map.get('other') ?? []
      legacy.push(issue)
      map.set('other', legacy)
    }
  }
  return map
}

export function PainelChecagensInconsistencia({
  checks,
  issues = [],
  title = 'Checagens de inconsistência',
  description = 'O que o sistema pesquisou e validou — inclusive quando não encontrou nada.',
  truncated,
  onDownloadCsv,
  defaultExpandWithIssues = false,
  embedded = false,
}: PainelChecagensInconsistenciaProps) {
  const issuesByCheck = useMemo(() => groupIssuesByCheck(issues), [issues])

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (!defaultExpandWithIssues) return new Set()
    return new Set(checks.filter((c) => c.count > 0).map((c) => c.id))
  })

  useEffect(() => {
    if (!defaultExpandWithIssues) return
    setExpanded(new Set(checks.filter((c) => c.count > 0).map((c) => c.id)))
  }, [checks, defaultExpandWithIssues])

  if (!checks.length) return null

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const resolveCheckIssues = (
    checkId: string,
    severity: ValidationCheckSummaryItem['severity']
  ): ValidationIssue[] => {
    const direct = issuesByCheck.get(checkId) ?? []
    if (direct.length > 0) {
      if (checkId === 'other_error' || checkId === 'other_warning' || checkId === 'other') {
        return direct.filter((i) => i.severity === severity)
      }
      return direct.filter((i) => i.severity === severity)
    }
    if (checkId === 'other_error' || checkId === 'other_warning' || checkId === 'other') {
      const legacy = issuesByCheck.get('other') ?? []
      return legacy.filter((i) => i.severity === severity)
    }
    return []
  }

  const list = (
    <ul className={cn('divide-y divide-line', !embedded && 'rounded-lg border')}>
      {checks.map((check) => {
        const ok = check.count === 0
        const isOpen = expanded.has(check.id)
        const checkIssues = resolveCheckIssues(check.id, check.severity)
        const canExpand = !ok
        const displayIssues =
          checkIssues.length > 0
            ? checkIssues
            : check.id === 'other'
              ? resolveCheckIssues('other_error', 'error').concat(
                  resolveCheckIssues('other_warning', 'warning')
                )
              : []

        return (
          <li key={check.id}>
            <div
              className={cn(
                'flex items-start justify-between gap-3 px-1 py-2 text-sm',
                !embedded && 'px-3 py-2.5',
                canExpand && 'cursor-pointer hover:bg-surface-muted/40'
              )}
              role={canExpand ? 'button' : undefined}
              tabIndex={canExpand ? 0 : undefined}
              onClick={canExpand ? () => toggle(check.id) : undefined}
              onKeyDown={
                canExpand
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggle(check.id)
                      }
                    }
                  : undefined
              }
            >
              <div className="flex min-w-0 items-start gap-2">
                {canExpand ? (
                  <ChevronDown
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0 text-fg-muted transition-transform',
                      !isOpen && '-rotate-90'
                    )}
                  />
                ) : (
                  <span className="mt-0.5 inline-block h-4 w-4 shrink-0" />
                )}
                {ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle
                    className={
                      check.severity === 'error'
                        ? 'mt-0.5 h-4 w-4 shrink-0 text-danger'
                        : 'mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400'
                    }
                  />
                )}
                <span className="text-fg-strong">{check.label}</span>
              </div>
              <span
                className={
                  ok
                    ? 'shrink-0 font-medium text-emerald-700 dark:text-emerald-300'
                    : check.severity === 'error'
                      ? 'shrink-0 font-medium text-danger'
                      : 'shrink-0 font-medium text-amber-700 dark:text-amber-300'
                }
              >
                {ok ? 'nenhum' : formatNumber(check.count)}
              </span>
            </div>

            {canExpand && isOpen && displayIssues.length > 0 && (
              <div
                className={cn(
                  'border-t border-line bg-surface-muted/20 pb-3 pt-2',
                  embedded ? 'px-1' : 'px-3'
                )}
              >
                {displayIssues.length < check.count && (
                  <p className="mb-2 text-xs text-fg-muted">
                    Mostrando {formatNumber(displayIssues.length)} de{' '}
                    {formatNumber(check.count)} ocorrência(s). Use &quot;Exportar CSV&quot; para
                    baixar o que couber na exportação.
                  </p>
                )}
                <div className="max-h-72 overflow-auto rounded-md border bg-surface">
                  <table className="w-full border-collapse font-data text-sm">
                    <thead>
                      <tr>
                        <GridTh className="sticky top-0 z-10 w-16 bg-surface">Linha</GridTh>
                        <GridTh className="sticky top-0 z-10 w-20 bg-surface">Tipo</GridTh>
                        <GridTh className="sticky top-0 z-10 bg-surface">Campo</GridTh>
                        <GridTh className="sticky top-0 z-10 bg-surface">Valor</GridTh>
                        <GridTh className="sticky top-0 z-10 bg-surface">Mensagem</GridTh>
                      </tr>
                    </thead>
                    <tbody>
                      {displayIssues.map((issue, index) => (
                        <tr key={`${issue.row}-${issue.field}-${index}`}>
                          <GridCell>{issue.row || '-'}</GridCell>
                          <GridCell>
                            <Badge
                              variant={issue.severity === 'error' ? 'negative' : 'neutral'}
                            >
                              {issue.severity === 'error' ? 'Erro' : 'Alerta'}
                            </Badge>
                          </GridCell>
                          <GridCell className="font-mono text-xs">{issue.field || '-'}</GridCell>
                          <GridCell className="max-w-[120px] truncate font-mono text-xs">
                            {issue.value || '-'}
                          </GridCell>
                          <GridCell
                            className={
                              issue.severity === 'error'
                                ? 'text-danger'
                                : 'text-amber-700 dark:text-amber-300'
                            }
                          >
                            {issue.message}
                          </GridCell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {canExpand && isOpen && displayIssues.length === 0 && (
              <p
                className={cn(
                  'border-t border-line py-2 text-xs text-fg-muted',
                  embedded ? 'px-1' : 'px-3'
                )}
              >
                Há {formatNumber(check.count)} ocorrência(s), mas nenhum detalhe foi carregado.
                Clique em Revalidar ou use Exportar CSV.
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )

  if (embedded) {
    return (
      <div className="space-y-2">
        {(onDownloadCsv || truncated) && (
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-fg-muted">
              {truncated
                ? 'Até 200 ocorrências por item; exporte o CSV para mais.'
                : 'Clique na seta para ver as ocorrências.'}
            </p>
            {onDownloadCsv && issues.length > 0 && (
              <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2" onClick={onDownloadCsv}>
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            )}
          </div>
        )}
        {list}
      </div>
    )
  }

  return (
    <Card variant="panel">
      <div className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-fg-strong flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-fg-muted" />
              {title}
            </h2>
            <p className="text-sm text-fg-muted">
              {description}
              {truncated
                ? ' Clique na seta para ver até 200 ocorrências por checagem; exporte o CSV para mais.'
                : issues.length > 0
                  ? ' Clique na seta de cada checagem para ver os detalhes.'
                  : ''}
            </p>
          </div>
          {onDownloadCsv && issues.length > 0 && (
            <Button size="sm" variant="secondary" className="shrink-0" onClick={onDownloadCsv}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          )}
        </div>
      </div>
      <div>{list}</div>
    </Card>
  )
}

/** Checagens do envio (duplicados no banco, avisos DCB, falhas). */
export function buildSendCheckSummary(
  job: EnvioJobSnapshot
): ValidationCheckSummaryItem[] {
  const skipped = job.skipped ?? []
  const barcodeSkips = skipped.filter((s) => s.reason === 'codigo_barras').length
  const migracaoSkips = skipped.filter((s) => s.reason === 'codigo_migracao').length
  const dcbWarnings = (job.errors ?? []).filter((e) =>
    e.message.trim().toLowerCase().startsWith('aviso:')
  ).length
  const realFailures = job.errorCount ?? 0

  return [
    {
      id: 'skip_barcode',
      label: 'Já existentes por código de barras (ignorados)',
      count: barcodeSkips,
      severity: 'warning',
    },
    {
      id: 'skip_migracao',
      label: 'Já existentes por código de migração (ignorados)',
      count: migracaoSkips,
      severity: 'warning',
    },
    {
      id: 'dcb_warning',
      label: 'Avisos de DCB (produto gravado sem vínculo)',
      count: dcbWarnings,
      severity: 'warning',
    },
    {
      id: 'insert_failures',
      label: 'Falhas reais de inserção',
      count: realFailures,
      severity: 'error',
    },
  ]
}
