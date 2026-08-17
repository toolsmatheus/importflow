import { Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ImportError } from '@/types'

interface ErrorTableProps {
  errors: ImportError[]
  total?: number
  truncated?: boolean
  onDownloadReport?: () => void
}

export function ErrorTable({ errors, total, truncated, onDownloadReport }: ErrorTableProps) {
  const handleDownload = () => {
    if (onDownloadReport) {
      onDownloadReport()
      return
    }

    const header = 'Linha,Campo,Valor,Erro\n'
    const rows = errors.map((e) => `${e.row},"${e.field}","${e.value}","${e.message}"`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'importflow-erros.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Detalhes dos erros</CardTitle>
          {truncated && (
            <p className="mt-1 text-sm text-muted-foreground">
              Exibindo {errors.length} de {total} erros.
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4" />
          Baixar relatório CSV
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Linha</TableHead>
              <TableHead>Campo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errors.map((error, idx) => (
              <TableRow key={idx}>
                <TableCell>{error.row}</TableCell>
                <TableCell className="font-mono">{error.field || '—'}</TableCell>
                <TableCell className="font-mono">{error.value || '—'}</TableCell>
                <TableCell className="text-destructive">{error.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
