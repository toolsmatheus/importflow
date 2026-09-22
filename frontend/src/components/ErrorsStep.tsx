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
import { Button } from '@/components/ui/button'
import { InconsistencyChecksPanel } from '@/components/InconsistencyChecksPanel'
import { ControladoSuggestPanel } from '@/components/ControladoSuggestPanel'
import { AliquotaUfReviewPanel } from '@/components/AliquotaUfReviewPanel'
import { findAliquotaMismatches } from '@/lib/icmsByUf'
import { cn, formatNumber } from '@/lib/utils'
import type {
  AuxiliaryEntity,
  ProductValidationResult,
  ValidationIssue,
} from '@/types'
import type { AliquotaMismatch } from '@/lib/icmsByUf'

interface ErrorsStepProps {
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
  isRevalidating?: boolean
}

function downloadIssuesCsv(issues: ValidationIssue[], fileName: string) {
  const header = 'linha;tipo;campo;valor;mensagem'
  const lines = issues.map((issue) =>
    [
      issue.row,
      issue.severity,
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
    <div className="overflow-hidden rounded-lg border border-border">
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
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                !open && '-rotate-90'
              )}
            />
          ) : (
            <span className="inline-block h-4 w-4 shrink-0" />
          )}
          {tone === 'error' ? (
            <XCircle className="h-4 w-4 shrink-0 text-destructive" />
          ) : tone === 'warning' ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : tone === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="font-medium text-foreground">{title}</span>
          {count !== undefined ? (
            <span
              className={cn(
                'tabular-nums text-muted-foreground',
                tone === 'error' && count > 0 && 'text-destructive',
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
        <div className="border-t border-border px-3 py-3">{children}</div>
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
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', !open && '-rotate-90')}
        />
        {icon}
        <span>{label}</span>
        {hint ? <span className="text-muted-foreground/80">· {hint}</span> : null}
      </button>
      {open ? children : null}
    </div>
  )
}

export function ErrorsStep({
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
  isRevalidating,
}: ErrorsStepProps) {
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

  if (!result) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Nenhuma validação foi executada ainda.</p>
        <Button variant="outline" onClick={onBack}>
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
          <p className="min-w-0 flex-1 text-destructive">
            Corrija os erros antes de continuar.
          </p>
          <Button size="sm" variant="outline" onClick={onFixFile}>
            Trocar CSV
          </Button>
          <Button size="sm" variant="outline" onClick={onFixAuxiliary}>
            Auxiliares
          </Button>
          <Button size="sm" onClick={onRevalidate} disabled={isRevalidating}>
            Revalidar
          </Button>
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
            <InconsistencyChecksPanel
              checks={verifiedErrorChecks}
              issues={result.issues}
              truncated={result.truncated}
              defaultExpandWithIssues={false}
              embedded
            />
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma checagem de erro registrada.</p>
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
                  downloadIssuesCsv(errorIssues, 'erros-validacao.csv')
                }}
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            ) : null
          }
        >
          <InconsistencyChecksPanel
            checks={errorChecks}
            issues={result.issues}
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
          <InconsistencyChecksPanel
            checks={warningChecks}
            issues={result.issues}
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
              <p className="text-destructive">
                Obrigatórias ausentes:{' '}
                <span className="font-mono">{result.missingRequiredHeaders.join(', ')}</span>
              </p>
            )}
            {result.unknownHeaders.length > 0 && (
              <p className="text-muted-foreground">
                Ignoradas:{' '}
                <span className="font-mono text-foreground">
                  {result.unknownHeaders.join(', ')}
                </span>
              </p>
            )}
          </div>
        </CollapsibleBlock>
      )}

      {(showAliquota || onApplyControlados) && (
        <div className="space-y-1 border-t border-border pt-3">
          {showAliquota && clientUf && onApplyAliquotaUf && (
            <SoftExpand
              label="Alíquota × UF"
              hint={`${formatNumber(aliquotaReview!.mismatches.length)} diferenciada(s)`}
              icon={<Percent className="h-3.5 w-3.5" />}
            >
              <AliquotaUfReviewPanel
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
              <ControladoSuggestPanel
                rows={rows}
                auxiliary={auxiliary}
                isApplying={isRevalidating}
                onApply={onApplyControlados}
              />
            </SoftExpand>
          )}
        </div>
      )}

      <div className="flex justify-between pt-1">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={onContinue} disabled={!canContinue}>
          Continuar para envio
        </Button>
      </div>
    </div>
  )
}
