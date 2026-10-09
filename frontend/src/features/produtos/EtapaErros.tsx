import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  Percent,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { PainelChecagensInconsistencia } from '@/features/produtos/PainelChecagensInconsistencia'
import { PainelSugestaoControlado } from '@/features/produtos/PainelSugestaoControlado'
import { PainelRevisaoAliquotaUf } from '@/features/produtos/PainelRevisaoAliquotaUf'
import { findAliquotaMismatches } from '@/lib/icmsByUf'
import { filterRowsWithoutErrors } from '@/lib/linhasEnvio'
import { cn, formatNumber } from '@/lib/utils'
import type {
  AuxiliaryEntity,
  ProductValidationResult,
  ValidationIssue,
} from '@/types'
import type { AliquotaMismatch } from '@/lib/icmsByUf'
import { Button } from '@/components'
interface EtapaErrosProps {
  result: ProductValidationResult | null
  clientUf?: string
  auxiliary?: Partial<Record<AuxiliaryEntity, string>>
  onApplyControlados?: (rows: Record<string, string>[]) => void | Promise<void>
  onBack: () => void
  onFixFile: () => void
  onFixAuxiliary: () => void
  onRevalidate: () => void
  onApplyAliquotaUf?: (mismatches: AliquotaMismatch[]) => void
  onContinue: () => void
  /** Continua para envio excluindo linhas com erro. */
  onContinueSkipErrors: (validRows: Record<string, string>[], skippedCount: number) => void
  isRevalidating?: boolean
}

function barcodeByCsvRow(
  rows: Record<string, string>[] | undefined,
  csvRow: number
): string {
  if (!rows || csvRow < 2) return ''
  return String(rows[csvRow - 2]?.codigobarras ?? '').trim()
}

function downloadIssuesCsv(
  issues: ValidationIssue[],
  fileName: string,
  rows?: Record<string, string>[]
) {
  const header = 'linha;codigobarras;campo;valor;mensagem'
  const lines = issues.map((issue) =>
    [
      issue.row,
      barcodeByCsvRow(rows, issue.row),
      issue.field,
      `"${issue.value.replace(/"/g, '""')}"`,
      `"${issue.message.replace(/"/g, '""')}"`,
    ].join(';')
  )
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function CollapsibleBlock({
  title,
  count,
  tone,
  defaultOpen = false,
  actions,
  children,
}: {
  title: string
  count?: number
  tone: 'error' | 'warning' | 'success' | 'neutral'
  defaultOpen?: boolean
  actions?: ReactNode
  children?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const expandable = children != null

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => expandable && setOpen((v) => !v)}
          disabled={!expandable}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 text-left text-sm',
            !expandable && 'cursor-default'
          )}
          aria-expanded={expandable ? open : undefined}
        >
          {expandable ? (
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-fg-muted transition-transform',
                !open && '-rotate-90'
              )}
            />
          ) : (
            <span className="inline-block h-4 w-4 shrink-0" />
          )}
          {tone === 'error' ? (
            <XCircle className="h-4 w-4 shrink-0 text-danger" />
          ) : tone === 'warning' ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : tone === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-fg-muted" />
          )}
          <span className="font-medium text-fg-strong">{title}</span>
          {count !== undefined ? (
            <span
              className={cn(
                'tabular-nums text-fg-muted',
                tone === 'error' && count > 0 && 'text-danger',
                tone === 'warning' && count > 0 && 'text-amber-700 dark:text-amber-300',
                tone === 'success' && 'text-emerald-700 dark:text-emerald-300'
              )}
            >
              {formatNumber(count)}
            </span>
          ) : null}
        </button>
        {actions}
      </div>
      {expandable && open ? (
        <div className="border-t border-line px-3 py-3">{children}</div>
      ) : null}
    </div>
  )
}

function SoftExpand({
  label,
  icon,
  hint,
  children,
}: {
  label: string
  icon: ReactNode
  hint?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg-strong"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', !open && '-rotate-90')}
        />
        {icon}
        <span>{label}</span>
        {hint ? <span className="text-fg-muted/80">· {hint}</span> : null}
      </button>
      {open ? children : null}
    </div>
  )
}

export function EtapaErros({
  result,
  clientUf,
  auxiliary = {},
  onApplyControlados,
  onBack,
  onFixFile,
  onFixAuxiliary,
  onRevalidate,
  onApplyAliquotaUf,
  onContinue,
  onContinueSkipErrors,
  isRevalidating,
}: EtapaErrosProps) {
  const errorIssues = useMemo(() => {
    if (!result) return []
    return result.issues.filter((i) => i.severity === 'error')
  }, [result])

  const errorChecks = useMemo(() => {
    if (!result?.checkSummary) return []
    return result.checkSummary.filter((c) => c.severity === 'error' && c.count > 0)
  }, [result])

  const verifiedErrorChecks = useMemo(() => {
    if (!result?.checkSummary) return []
    return result.checkSummary.filter((c) => c.severity === 'error')
  }, [result])

  const warningChecks = useMemo(() => {
    if (!result?.checkSummary) return []
    return result.checkSummary.filter((c) => c.severity === 'warning' && c.count > 0)
  }, [result])

  const aliquotaReview = useMemo(() => {
    if (!result || !clientUf || !onApplyAliquotaUf) return null
    return findAliquotaMismatches(result.rows, clientUf)
  }, [result, clientUf, onApplyAliquotaUf])

  const skipErrorsPlan = useMemo(() => {
    if (!result) return null
    const { validRows, skippedCount } = filterRowsWithoutErrors(result.rows, result)
    const fileLevelErrors = result.issues.filter(
      (i) => i.severity === 'error' && i.row === 0
    )
    const canSkip =
      result.errorCount > 0 &&
      result.missingRequiredHeaders.length === 0 &&
      fileLevelErrors.length === 0 &&
      validRows.length > 0 &&
      skippedCount > 0
    return { validRows, skippedCount, canSkip }
  }, [result])

  if (!result) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">Nenhuma validação foi executada ainda.</p>
        <Button variant="secondary" onClick={onBack}>
          Voltar
        </Button>
      </div>
    )
  }

  const canContinue = result.canProceed
  const rows = result.rows
  const showAtualizaEstoque =
    Boolean(result.atualizaEstoqueSummary) &&
    result.atualizaEstoqueSummary!.n > result.atualizaEstoqueSummary!.s
  const showAliquota =
    Boolean(aliquotaReview && aliquotaReview.mismatches.length > 0 && onApplyAliquotaUf)

  return (
    <div className="space-y-4">
      {!canContinue && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <p className="min-w-0 flex-1 text-danger">
            Corrija os erros antes de continuar
            {skipErrorsPlan?.canSkip
              ? `, ou envie só os ${formatNumber(skipErrorsPlan.validRows.length)} produto(s) sem erro.`
              : '.'}
          </p>
          <Button size="sm" variant="secondary" onClick={onFixFile}>
            Trocar CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={onFixAuxiliary}>
            Auxiliares
          </Button>
          <Button size="sm" onClick={onRevalidate} disabled={isRevalidating}>
            Revalidar
          </Button>
          {skipErrorsPlan?.canSkip ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                onContinueSkipErrors(
                  skipErrorsPlan.validRows,
                  skipErrorsPlan.skippedCount
                )
              }
            >
              Enviar só os válidos ({formatNumber(skipErrorsPlan.validRows.length)})
            </Button>
          ) : null}
        </div>
      )}

      {showAtualizaEstoque && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Mais produtos com <span className="font-mono">atualizaestoque=N</span> (
          {formatNumber(result.atualizaEstoqueSummary!.n)}) do que com{' '}
          <span className="font-mono">=S</span> (
          {formatNumber(result.atualizaEstoqueSummary!.s)}).
        </p>
      )}

      {canContinue ? (
        <CollapsibleBlock title="Sem erros bloqueantes" tone="success" defaultOpen={false}>
          {verifiedErrorChecks.length > 0 ? (
            <PainelChecagensInconsistencia
              checks={verifiedErrorChecks}
              issues={result.issues}
              rows={result.rows}
              truncated={result.truncated}
              defaultExpandWithIssues={false}
              embedded
            />
          ) : (
            <p className="text-sm text-fg-muted">Nenhuma checagem de erro registrada.</p>
          )}
        </CollapsibleBlock>
      ) : null}

      {errorChecks.length > 0 && (
        <CollapsibleBlock
          title="Erros"
          count={result.errorCount}
          tone="error"
          defaultOpen={!canContinue}
          actions={
            errorIssues.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  downloadIssuesCsv(errorIssues, 'erros-validacao.csv', result.rows)
                }}
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            ) : null
          }
        >
          <PainelChecagensInconsistencia
            checks={errorChecks}
            issues={result.issues}
            rows={result.rows}
            truncated={result.truncated}
            defaultExpandWithIssues={false}
            embedded
          />
        </CollapsibleBlock>
      )}

      {warningChecks.length > 0 && (
        <CollapsibleBlock
          title="Alertas"
          count={result.warningCount}
          tone="warning"
          defaultOpen={false}
        >
          <PainelChecagensInconsistencia
            checks={warningChecks}
            issues={result.issues}
            rows={result.rows}
            truncated={result.truncated}
            defaultExpandWithIssues={false}
            embedded
          />
        </CollapsibleBlock>
      )}

      {(result.missingRequiredHeaders.length > 0 || result.unknownHeaders.length > 0) && (
        <CollapsibleBlock
          title="Colunas"
          count={result.missingRequiredHeaders.length + result.unknownHeaders.length}
          tone={result.missingRequiredHeaders.length > 0 ? 'error' : 'neutral'}
          defaultOpen={result.missingRequiredHeaders.length > 0}
        >
          <div className="space-y-2 text-sm">
            {result.missingRequiredHeaders.length > 0 && (
              <p className="text-danger">
                Obrigatórias ausentes:{' '}
                <span className="font-mono">{result.missingRequiredHeaders.join(', ')}</span>
              </p>
            )}
            {result.unknownHeaders.length > 0 && (
              <p className="text-fg-muted">
                Ignoradas:{' '}
                <span className="font-mono text-fg-strong">
                  {result.unknownHeaders.join(', ')}
                </span>
              </p>
            )}
          </div>
        </CollapsibleBlock>
      )}

      {(showAliquota || onApplyControlados) && (
        <div className="space-y-1 border-t border-line pt-3">
          {showAliquota && clientUf && onApplyAliquotaUf && (
            <SoftExpand
              label="Alíquota × UF"
              hint={`${formatNumber(aliquotaReview!.mismatches.length)} diferenciada(s)`}
              icon={<Percent className="h-3.5 w-3.5" />}
            >
              <PainelRevisaoAliquotaUf
                rows={rows}
                clientUf={clientUf}
                truncatedIssues={result.truncated}
                onApplyUfStandard={onApplyAliquotaUf}
              />
            </SoftExpand>
          )}

          {onApplyControlados && (
            <SoftExpand
              label="Sugestão de controlados"
              hint="CMED + Portaria 344"
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
            >
              <PainelSugestaoControlado
                rows={rows}
                auxiliary={auxiliary}
                isApplying={isRevalidating}
                onApply={onApplyControlados}
              />
            </SoftExpand>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2 pt-1">
        <Button variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <div className="flex flex-wrap gap-2">
          {skipErrorsPlan?.canSkip ? (
            <Button
              variant="secondary"
              onClick={() =>
                onContinueSkipErrors(
                  skipErrorsPlan.validRows,
                  skipErrorsPlan.skippedCount
                )
              }
            >
              Enviar só os válidos ({formatNumber(skipErrorsPlan.validRows.length)})
            </Button>
          ) : null}
          <Button onClick={onContinue} disabled={!canContinue}>
            Continuar para envio
          </Button>
        </div>
      </div>
    </div>
  )
}
