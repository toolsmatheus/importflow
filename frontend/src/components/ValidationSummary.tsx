import { CheckCircle2, AlertTriangle, XCircle, KeyRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber } from '@/lib/utils'
import type { ValidationResult } from '@/types'

interface ValidationSummaryProps {
  result: ValidationResult
}

export function ValidationSummary({ result }: ValidationSummaryProps) {
  return (
    <div className="space-y-4">
      {result.missingRequiredColumns.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
          <CardContent className="flex items-start gap-3 p-4">
            <KeyRound className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">Colunas obrigatórias não mapeadas</p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                A importação não pode ser executada enquanto estas colunas não receberem um valor:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.missingRequiredColumns.map((column) => (
                  <Badge key={column} variant="destructive" className="font-mono">
                    {column}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-2xl font-bold text-green-800 dark:text-green-200">{formatNumber(result.validCount)}</p>
              <p className="text-sm text-green-700 dark:text-green-300">registros válidos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">{formatNumber(result.warningCount)}</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">registros com alertas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-2xl font-bold text-red-800 dark:text-red-200">{formatNumber(result.invalidCount)}</p>
              <p className="text-sm text-red-700 dark:text-red-300">registros inválidos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {result.duplicateKeyColumns.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
          <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-200">
            Valores duplicados encontrados no arquivo para:{' '}
            <span className="font-mono font-medium">{result.duplicateKeyColumns.join(', ')}</span>
          </CardContent>
        </Card>
      )}

      {result.errors.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Problemas encontrados</CardTitle>
            {result.truncatedErrors && (
              <p className="text-sm text-muted-foreground">
                Exibindo as primeiras {formatNumber(result.errors.length)} ocorrências.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Linha</TableHead>
                  <TableHead className="w-28">Tipo</TableHead>
                  <TableHead>Campo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.errors.map((issue, index) => (
                  <TableRow key={`${issue.row}-${issue.field}-${index}`}>
                    <TableCell>{issue.row}</TableCell>
                    <TableCell>
                      <Badge variant={issue.severity === 'error' ? 'destructive' : 'warning'}>
                        {issue.severity === 'error' ? 'Erro' : 'Alerta'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{issue.field}</TableCell>
                    <TableCell className="font-mono">{issue.value || '—'}</TableCell>
                    <TableCell
                      className={issue.severity === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-300'}
                    >
                      {issue.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
