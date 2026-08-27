import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Search } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatNumber } from '@/lib/utils'
import type { SendJobSnapshot, ValidationCheckSummaryItem, ValidationIssue } from '@/types'

interface InconsistencyChecksPanelProps {
  checks: ValidationCheckSummaryItem[]
  issues?: ValidationIssue[]
  title?: string
  description?: string
  truncated?: boolean
  onDownloadCsv?: () => void
}

function groupIssuesByCheck(issues: ValidationIssue[]): Map<string, ValidationIssue[]> {
  const map = new Map<string, ValidationIssue[]>()
  for (const issue of issues) {
    const id = issue.checkId ?? 'other'
    const list = map.get(id) ?? []
    list.push(issue)
    map.set(id, list)
  }
  return map
}

export function InconsistencyChecksPanel({
  checks,
  issues = [],
  title = 'Checagens de inconsistência',
  description = 'O que o sistema pesquisou e validou — inclusive quando não encontrou nada.',
  truncated,
  onDownloadCsv,
}: InconsistencyChecksPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const issuesByCheck = useMemo(() => groupIssuesByCheck(issues), [issues])

  if (!checks.length) return null

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-muted-foreground" />
              {title}
            </CardTitle>
            <CardDescription>
              {description}
              {truncated
                ? ' Clique na seta para ver até 200 ocorrências por checagem; exporte o CSV para mais.'
                : issues.length > 0
                  ? ' Clique na seta de cada checagem para ver os detalhes.'
                  : ''}
            </CardDescription>
          </div>
          {onDownloadCsv && issues.length > 0 && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={onDownloadCsv}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border rounded-lg border">
          {checks.map((check) => {
            const ok = check.count === 0
            const isOpen = expanded.has(check.id)
            const checkIssues = issuesByCheck.get(check.id) ?? []
            const canExpand = !ok

            return (
              <li key={check.id}>
                <div
                  className={cn(
                    'flex items-start justify-between gap-3 px-3 py-2.5 text-sm',
                    canExpand && 'cursor-pointer hover:bg-muted/40'
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
                          'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
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
                            ? 'mt-0.5 h-4 w-4 shrink-0 text-destructive'
                            : 'mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400'
                        }
                      />
                    )}
                    <span className="text-foreground">{check.label}</span>
                  </div>
                  <span
                    className={
                      ok
                        ? 'shrink-0 font-medium text-emerald-700 dark:text-emerald-300'
                        : check.severity === 'error'
                          ? 'shrink-0 font-medium text-destructive'
                          : 'shrink-0 font-medium text-amber-700 dark:text-amber-300'
                    }
                  >
                    {ok ? 'nenhum' : formatNumber(check.count)}
                  </span>
                </div>

                {canExpand && isOpen && checkIssues.length > 0 && (
                  <div className="border-t border-border bg-muted/20 px-3 pb-3 pt-2">
                    {checkIssues.length < check.count && (
                      <p className="mb-2 text-xs text-muted-foreground">
                        Mostrando {formatNumber(checkIssues.length)} de{' '}
                        {formatNumber(check.count)} ocorrência(s). Use &quot;Exportar CSV&quot; para
                        baixar o que couber na exportação.
                      </p>
                    )}
                    <div className="max-h-72 overflow-auto rounded-md border bg-card">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky top-0 z-10 w-16 bg-card">Linha</TableHead>
                            <TableHead className="sticky top-0 z-10 w-20 bg-card">Tipo</TableHead>
                            <TableHead className="sticky top-0 z-10 bg-card">Campo</TableHead>
                            <TableHead className="sticky top-0 z-10 bg-card">Valor</TableHead>
                            <TableHead className="sticky top-0 z-10 bg-card">Mensagem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {checkIssues.map((issue, index) => (
                            <TableRow key={`${issue.row}-${issue.field}-${index}`}>
                              <TableCell>{issue.row || '-'}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={issue.severity === 'error' ? 'destructive' : 'warning'}
                                >
                                  {issue.severity === 'error' ? 'Erro' : 'Alerta'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{issue.field || '-'}</TableCell>
                              <TableCell className="max-w-[120px] truncate font-mono text-xs">
                                {issue.value || '-'}
                              </TableCell>
                              <TableCell
                                className={
                                  issue.severity === 'error'
                                    ? 'text-destructive'
                                    : 'text-amber-700 dark:text-amber-300'
                                }
                              >
                                {issue.message}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {canExpand && isOpen && checkIssues.length === 0 && (
                  <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    Há {formatNumber(check.count)} ocorrência(s), mas nenhum detalhe foi carregado.
                    Revalide ou use Exportar CSV.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

/** Checagens do envio (duplicados no banco, avisos DCB, falhas). */
export function buildSendCheckSummary(
  job: SendJobSnapshot
): ValidationCheckSummaryItem[] {
  const skipped = job.skipped ?? []
  const barcodeSkips = skipped.filter((s) => s.reason === 'codigo_barras').length
  const migracaoSkips = skipped.filter((s) => s.reason === 'codigo_migracao').length
  const dcbWarnings = (job.errors ?? []).filter((e) =>
    e.message.trim().toLowerCase().startsWith('aviso:')
  ).length
  const realFailures = Math.max(0, (job.errorCount ?? 0) - dcbWarnings)

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
      label: 'Avisos de DCB no insert (produto gravado sem vínculo)',
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
