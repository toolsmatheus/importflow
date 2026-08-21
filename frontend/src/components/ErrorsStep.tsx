import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber } from '@/lib/utils'
import type { IssueSeverity, ProductValidationResult } from '@/types'

type SeverityFilter = 'all' | IssueSeverity

interface ErrorsStepProps {
  result: ProductValidationResult | null
  onBack: () => void
  onFixFile: () => void
  onFixAuxiliary: () => void
  onRevalidate: () => void
  onContinue: () => void
  isRevalidating?: boolean
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
  onBack,
  onFixFile,
  onFixAuxiliary,
  onRevalidate,
  onContinue,
  isRevalidating,
}: ErrorsStepProps) {
  const [filter, setFilter] = useState<SeverityFilter>('all')

  const filteredIssues = useMemo(() => {
    if (!result) return []
    if (filter === 'all') return result.issues
    return result.issues.filter((i) => i.severity === filter)
  }, [filter, result])

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

      {canContinue ? (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40">
          <CardContent className="p-4 text-sm text-emerald-800 dark:text-emerald-200">
            Sem erros bloqueantes.
            {result.warningCount > 0
              ? ' Há alertas. Revise abaixo se quiser e continue para a prévia.'
              : ' Pode seguir para a prévia editável.'}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
          <CardContent className="space-y-3 p-4 text-sm text-red-700 dark:text-red-300">
            <p>Corrija os erros antes de continuar. Você pode ajustar o CSV, os auxiliares ou revalidar.</p>
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

      {result.issues.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Problemas encontrados</CardTitle>
                {result.truncated && (
                  <CardDescription>
                    Exibindo as primeiras {formatNumber(result.issues.length)} ocorrências.
                  </CardDescription>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['all', 'Todos'],
                    ['error', 'Erros'],
                    ['warning', 'Alertas'],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={filter === value ? 'default' : 'outline'}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => downloadIssuesCsv(result)}>
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 z-10 bg-card w-20">Linha</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card w-24">Tipo</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card">Campo</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card">Valor</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card">Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIssues.map((issue, index) => (
                    <TableRow key={`${issue.row}-${issue.field}-${index}`}>
                      <TableCell>{issue.row || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={issue.severity === 'error' ? 'destructive' : 'warning'}>
                          {issue.severity === 'error' ? 'Erro' : 'Alerta'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{issue.field || '-'}</TableCell>
                      <TableCell className="max-w-[140px] truncate font-mono text-xs">
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
                  {filteredIssues.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum item neste filtro.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
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
