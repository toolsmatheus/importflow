import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Columns3, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { productService } from '@/services/productService'
import { ControladoSuggestPanel } from '@/components/ControladoSuggestPanel'
import { cn, formatNumber } from '@/lib/utils'
import type { AuxiliaryEntity, ProductValidationResult, ValidationIssue } from '@/types'

const PRIORITY_COLUMNS = [
  'codigo',
  'nome',
  'codigogrupo',
  'custo',
  'markup',
  'venda',
  'codigobarras',
]

interface PreviewStepProps {
  columns: string[]
  rows: Record<string, string>[]
  onRowsChange: (rows: Record<string, string>[]) => void
  onColumnsChange?: (columns: string[]) => void
  auxiliary: Partial<Record<AuxiliaryEntity, string>>
  onBack: () => void
  onContinue: () => void
}

export function PreviewStep({
  columns,
  rows,
  onRowsChange,
  onColumnsChange,
  auxiliary,
  onBack,
  onContinue,
}: PreviewStepProps) {
  const [localRows, setLocalRows] = useState(rows)
  const [filter, setFilter] = useState('')
  const [onlyProblems, setOnlyProblems] = useState(false)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const ordered = [
      ...PRIORITY_COLUMNS.filter((c) => columns.includes(c)),
      ...columns.filter((c) => !PRIORITY_COLUMNS.includes(c)),
    ]
    return ordered.slice(0, 8)
  })
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [lastResult, setLastResult] = useState<ProductValidationResult | null>(null)

  useEffect(() => {
    setLocalRows(rows)
  }, [rows])

  const issueByRow = useMemo(() => {
    const map = new Map<number, ValidationIssue[]>()
    for (const issue of issues) {
      if (!issue.row) continue
      const list = map.get(issue.row) ?? []
      list.push(issue)
      map.set(issue.row, list)
    }
    return map
  }, [issues])

  const filteredIndexes = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return localRows
      .map((row, i) => ({ row, i, csvRow: i + 2 }))
      .filter(({ row, csvRow }) => {
        if (onlyProblems && !issueByRow.has(csvRow)) return false
        if (!q) return true
        return Object.values(row).some((v) => String(v).toLowerCase().includes(q))
      })
      .map(({ i }) => i)
  }, [filter, localRows, onlyProblems, issueByRow])

  const commitRows = (next: Record<string, string>[]) => {
    setLocalRows(next)
    onRowsChange(next)
  }

  const updateCell = (rowIndex: number, field: string, value: string) => {
    setLocalRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, [field]: value } : row)))
  }

  const commitCell = (rowIndex: number, field: string, value: string) => {
    const next = localRows.map((row, i) => (i === rowIndex ? { ...row, [field]: value } : row))
    commitRows(next)
  }

  const revalidateMutation = useMutation({
    mutationFn: () => productService.validateRows(localRows, auxiliary),
    onSuccess: (result) => {
      setLastResult(result)
      setIssues(result.issues)
      if (result.errorCount > 0) {
        toast.warning(
          `${formatNumber(result.errorCount)} erro(s) e ${formatNumber(result.warningCount)} alerta(s)`
        )
      } else {
        toast.success(
          result.warningCount > 0
            ? `Ok com ${formatNumber(result.warningCount)} alerta(s)`
            : 'Prévia revalidada sem problemas'
        )
      }
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao revalidar'),
  })

  const toggleColumn = (col: string) => {
    setVisibleColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    )
  }

  const proceed = () => {
    commitRows(localRows)
    if (!lastResult) {
      revalidateMutation.mutate(undefined, {
        onSuccess: (result) => {
          if (result.canProceed) onContinue()
          else toast.error('Corrija os erros antes de continuar')
        },
      })
      return
    }
    if (!lastResult.canProceed) {
      toast.error('Corrija os erros antes de continuar')
      return
    }
    onContinue()
  }

  return (
    <div className="space-y-6">
      <ControladoSuggestPanel
        rows={localRows}
        auxiliary={auxiliary}
        onApply={(next) => {
          commitRows(next)
          setLastResult(null)
          setIssues([])
          const nextColumns = [...columns]
          for (const col of ['listacontrole', 'dcb'] as const) {
            if (!nextColumns.includes(col)) nextColumns.push(col)
          }
          if (nextColumns.length !== columns.length) {
            onColumnsChange?.(nextColumns)
          }
          setVisibleColumns((prev) => {
            const ordered = [...prev]
            for (const col of ['listacontrole', 'dcb']) {
              if (!ordered.includes(col)) ordered.push(col)
            }
            return ordered
          })
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Prévia editável</CardTitle>
          <CardDescription>
            Edite células e saia do campo para gravar. Revalide antes de enviar.{' '}
            {formatNumber(localRows.length)} linha(s), {visibleColumns.length} coluna(s) visíveis
            {columns.length > visibleColumns.length
              ? ` (${columns.length - visibleColumns.length} ocultas)`
              : ''}
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Input
              placeholder="Filtrar por qualquer valor..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant={onlyProblems ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOnlyProblems((v) => !v)}
                disabled={issues.length === 0}
              >
                Só com problemas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowColumnPicker((v) => !v)}
              >
                <Columns3 className="h-4 w-4" />
                Colunas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  commitRows(localRows)
                  revalidateMutation.mutate()
                }}
                disabled={revalidateMutation.isPending || localRows.length === 0}
              >
                {revalidateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Revalidar
              </Button>
            </div>
          </div>

          {showColumnPicker && (
            <div className="flex flex-wrap gap-2 rounded-lg border border-border p-3">
              {columns.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => toggleColumn(col)}
                  className={cn(
                    'rounded-md border px-2 py-1 font-mono text-xs',
                    visibleColumns.includes(col)
                      ? 'border-primary bg-accent text-primary'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  {col}
                </button>
              ))}
            </div>
          )}

          {lastResult && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={lastResult.errorCount > 0 ? 'destructive' : 'secondary'}>
                {formatNumber(lastResult.errorCount)} erro(s)
              </Badge>
              <Badge variant="warning">{formatNumber(lastResult.warningCount)} alerta(s)</Badge>
            </div>
          )}

          <div className="max-h-[480px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 top-0 z-20 bg-card w-14">#</TableHead>
                  {visibleColumns.map((col) => (
                    <TableHead
                      key={col}
                      className="sticky top-0 z-10 min-w-[120px] whitespace-nowrap bg-card"
                    >
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIndexes.map((rowIndex) => {
                  const row = localRows[rowIndex]
                  const csvRowNumber = rowIndex + 2
                  const rowIssues = issueByRow.get(csvRowNumber) ?? []
                  const hasError = rowIssues.some((i) => i.severity === 'error')
                  const hasWarning = rowIssues.some((i) => i.severity === 'warning')

                  return (
                    <TableRow
                      key={rowIndex}
                      className={cn(
                        hasError && 'bg-red-500/10',
                        !hasError && hasWarning && 'bg-amber-500/10'
                      )}
                    >
                      <TableCell className="sticky left-0 z-10 bg-card font-mono text-xs text-muted-foreground">
                        {csvRowNumber}
                      </TableCell>
                      {visibleColumns.map((col) => (
                        <TableCell key={col} className="p-1 align-top">
                          <Input
                            value={row[col] ?? ''}
                            onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                            onBlur={(e) => commitCell(rowIndex, col, e.target.value)}
                            className="h-8 min-w-[110px] font-mono text-xs"
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
                {filteredIndexes.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumns.length + 1}
                      className="text-center text-muted-foreground"
                    >
                      Nenhuma linha neste filtro.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {issues.length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Problemas da última revalidação</p>
              <ul className="max-h-40 space-y-1 overflow-auto text-muted-foreground">
                {issues.slice(0, 30).map((issue, index) => (
                  <li key={`${issue.row}-${issue.field}-${index}`}>
                    <span className="font-mono">L{issue.row}</span> {issue.field}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={proceed} disabled={revalidateMutation.isPending || localRows.length === 0}>
          {revalidateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Continuar para envio
        </Button>
      </div>
    </div>
  )
}
