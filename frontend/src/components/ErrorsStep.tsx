import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  ListChecks,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InconsistencyChecksPanel } from '@/components/InconsistencyChecksPanel'
import { ControladoSuggestPanel } from '@/components/ControladoSuggestPanel'
import { AliquotaUfReviewPanel } from '@/components/AliquotaUfReviewPanel'
import { formatNumber } from '@/lib/utils'
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
  /** Aplica linhas (controlados) e deve revalidar inconsistências. */
  onApplyControlados?: (rows: Record<string, string>[]) => void | Promise<void>
  onBack: () => void
  onFixFile: () => void
  onFixAuxiliary: () => void
  onRevalidate: () => void
  /** Aplica o padrão da UF nas divergências escolhidas (após confirmação na UI). */
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
  const [errorsOpen, setErrorsOpen] = useState(false)

  const errorIssues = useMemo(() => {
    if (!result) return []
    return result.issues.filter((i) => i.severity === 'error')
  }, [result])

  const errorChecks = useMemo(() => {
    if (!result?.checkSummary) return []
    return result.checkSummary.filter((c) => c.severity === 'error')
  }, [result])

  const warningChecks = useMemo(() => {
    if (!result?.checkSummary) return []
    return result.checkSummary.filter((c) => c.severity === 'warning')
  }, [result])

  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Validação</CardTitle>
          <CardDescription>Nenhuma validação foi executada ainda.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onBack}>
            Voltar
          </Button>
        </CardContent>
      </Card>
    )
  }

  const canContinue = result.canProceed
  const rows = result.rows

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-2xl font-bold">{formatNumber(result.totalRecords)}</p>
              <p className="text-sm text-muted-foreground">registros</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-2xl font-bold">{formatNumber(result.warningCount)}</p>
              <p className="text-sm text-muted-foreground">alertas (não bloqueiam)</p>
            </div>
          </CardContent>
        </Card>
        <Card className={result.errorCount > 0 ? 'border-destructive/40' : undefined}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-7 w-7 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{formatNumber(result.errorCount)}</p>
                <p className="text-sm text-muted-foreground">erros</p>
              </div>
            </div>
            {errorIssues.length > 0 && (
              <Button size="sm" variant="destructive" onClick={() => setErrorsOpen(true)}>
                <Eye className="h-4 w-4" />
                Ver erros
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {clientUf && onApplyAliquotaUf && rows.length > 0 && (
        <AliquotaUfReviewPanel
          rows={rows}
          clientUf={clientUf}
          truncatedIssues={result.truncated}
          onApplyUfStandard={onApplyAliquotaUf}
        />
      )}

      {canContinue ? (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40">
          <CardContent className="p-4 text-sm text-emerald-800 dark:text-emerald-200">
            Sem erros bloqueantes.
            {result.warningCount > 0
              ? ' Os alertas não impedem o envio — revise se quiser e siga para o envio.'
              : ' Pode seguir para o envio.'}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
          <CardContent className="space-y-3 p-4 text-sm text-red-700 dark:text-red-300">
            <p>
              Corrija os erros antes de continuar. Use <strong>Ver erros</strong> para a lista
              detalhada, ou ajuste o CSV / auxiliares e revalide.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="destructive" onClick={() => setErrorsOpen(true)}>
                <Eye className="h-4 w-4" />
                Ver erros ({formatNumber(errorIssues.length)})
              </Button>
              <Button size="sm" variant="outline" onClick={onFixFile}>
                Trocar CSV
              </Button>
              <Button size="sm" variant="outline" onClick={onFixAuxiliary}>
                Ajustar auxiliares
              </Button>
              <Button size="sm" onClick={onRevalidate} disabled={isRevalidating}>
                Revalidar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {errorChecks.length > 0 && (
        <InconsistencyChecksPanel
          checks={errorChecks}
          issues={result.issues}
          title="Erros que bloqueiam o envio"
          description="Somente inconsistências com severidade erro. Clique na seta para ver as ocorrências."
          truncated={result.truncated}
          onDownloadCsv={
            errorIssues.length > 0
              ? () => downloadIssuesCsv(errorIssues, 'erros-validacao.csv')
              : undefined
          }
          defaultExpandWithIssues
        />
      )}

      {warningChecks.length > 0 && (
        <InconsistencyChecksPanel
          checks={warningChecks}
          issues={result.issues}
          title="Alertas (não bloqueiam)"
          description="Avisos informativos — não impedem seguir para o envio. Clique na seta para ver as ocorrências."
          truncated={result.truncated}
          defaultExpandWithIssues
        />
      )}

      {onApplyControlados && (
        <ControladoSuggestPanel
          rows={rows}
          auxiliary={auxiliary}
          isApplying={isRevalidating}
          onApply={onApplyControlados}
        />
      )}

      {result.missingRequiredHeaders.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">
            Colunas obrigatórias ausentes:{' '}
            <span className="font-mono">{result.missingRequiredHeaders.join(', ')}</span>
          </CardContent>
        </Card>
      )}

      {result.unknownHeaders.length > 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Colunas não reconhecidas (serão ignoradas):{' '}
            <span className="font-mono text-foreground">{result.unknownHeaders.join(', ')}</span>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <div className="flex flex-wrap gap-2">
          {errorIssues.length > 0 && (
            <Button variant="outline" onClick={() => setErrorsOpen(true)}>
              <ListChecks className="h-4 w-4" />
              Ver erros
            </Button>
          )}
          <Button onClick={onContinue} disabled={!canContinue}>
            Continuar para envio
          </Button>
        </div>
      </div>

      <Dialog open={errorsOpen} onOpenChange={setErrorsOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Erros da validação
            </DialogTitle>
            <DialogDescription>
              {formatNumber(errorIssues.length)} erro(s) que impedem o envio. Alertas não
              aparecem nesta lista.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2 border-b px-6 py-3">
            <Badge variant="destructive">{formatNumber(errorIssues.length)} erro(s)</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadIssuesCsv(errorIssues, 'erros-validacao.csv')}
              disabled={errorIssues.length === 0}
            >
              Exportar CSV
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-2 pb-4">
            {errorIssues.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nenhum erro para exibir.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Linha</TableHead>
                    <TableHead className="w-32">Campo</TableHead>
                    <TableHead className="w-40">Valor</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorIssues.map((issue, idx) => (
                    <TableRow key={`${issue.row}-${issue.field}-${idx}`}>
                      <TableCell className="font-mono text-xs">{issue.row || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{issue.field || '—'}</TableCell>
                      <TableCell
                        className="max-w-[160px] truncate font-mono text-xs"
                        title={issue.value}
                      >
                        {issue.value || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-destructive">{issue.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
