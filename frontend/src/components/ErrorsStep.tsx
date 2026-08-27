import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InconsistencyChecksPanel } from '@/components/InconsistencyChecksPanel'
import { formatAliquotaCsv, getUfIcms } from '@/lib/icmsByUf'
import { formatNumber } from '@/lib/utils'
import type { ProductValidationResult } from '@/types'

interface ErrorsStepProps {
  result: ProductValidationResult | null
  clientUf?: string
  onBack: () => void
  onFixFile: () => void
  onFixAuxiliary: () => void
  onRevalidate: () => void
  onFixAliquotas?: () => void
  onContinue: () => void
  isRevalidating?: boolean
}

function isAliquotaUfWarning(issue: { field: string; message: string }) {
  return issue.field === 'aliquota' && issue.message.includes('padrão da UF')
}

function downloadIssuesCsv(result: ProductValidationResult) {
  const header = 'linha;tipo;campo;valor;mensagem'
  const lines = result.issues.map((issue) =>
    [issue.row, issue.severity, issue.field, `"${issue.value.replace(/"/g, '""')}"`, `"${issue.message.replace(/"/g, '""')}"`].join(';')
  )
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'erros-validacao.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function ErrorsStep({
  result,
  clientUf,
  onBack,
  onFixFile,
  onFixAuxiliary,
  onRevalidate,
  onFixAliquotas,
  onContinue,
  isRevalidating,
}: ErrorsStepProps) {
  const aliquotaUfWarnings = useMemo(() => {
    if (!result) return []
    return result.issues.filter(isAliquotaUfWarning)
  }, [result])

  const ufEntry = clientUf ? getUfIcms(clientUf) : null

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
              <p className="text-sm text-muted-foreground">alertas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="h-7 w-7 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{formatNumber(result.errorCount)}</p>
              <p className="text-sm text-muted-foreground">erros</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {aliquotaUfWarnings.length > 0 && ufEntry && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
          <CardContent className="space-y-3 p-4 text-sm text-amber-900 dark:text-amber-100">
            <p>
              <span className="font-medium">Alíquota × UF {clientUf}:</span> esperada{' '}
              <span className="font-mono font-medium">
                {formatAliquotaCsv(ufEntry.aliquota)}%
              </span>
              {ufEntry.note ? ` (${ufEntry.note})` : ''}. Há{' '}
              <span className="font-medium">{formatNumber(aliquotaUfWarnings.length)}</span>{' '}
              alerta(s) de divergência
              {result.truncated ? ' (lista pode estar truncada)' : ''}. Isso não bloqueia o envio.
            </p>
            {onFixAliquotas ? (
              <Button size="sm" variant="outline" onClick={onFixAliquotas}>
                Corrigir todas para {formatAliquotaCsv(ufEntry.aliquota)}%
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      {canContinue ? (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40">
          <CardContent className="p-4 text-sm text-emerald-800 dark:text-emerald-200">
            Sem erros bloqueantes.
            {result.warningCount > 0
              ? ' Há alertas — expanda as checagens abaixo para revisar.'
              : ' Pode seguir para a prévia (somente visualização).'}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
          <CardContent className="space-y-3 p-4 text-sm text-red-700 dark:text-red-300">
            <p>
              Corrija os erros antes de continuar. Expanda as checagens abaixo para ver os
              detalhes, ou ajuste o CSV / auxiliares e revalide.
            </p>
            <div className="flex flex-wrap gap-2">
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

      {(result.checkSummary?.length ?? 0) > 0 && (
        <InconsistencyChecksPanel
          checks={result.checkSummary!}
          issues={result.issues}
          truncated={result.truncated}
          onDownloadCsv={result.issues.length > 0 ? () => downloadIssuesCsv(result) : undefined}
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
        <Button onClick={onContinue} disabled={!canContinue}>
          Continuar para prévia
        </Button>
      </div>
    </div>
  )
}
