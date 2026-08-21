import { useState } from 'react'
import { Columns, FileSpreadsheet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBytes, formatNumber } from '@/lib/utils'
import type { CsvAnalysis } from '@/types'

interface FileInfoProps {
  analysis: CsvAnalysis
}

export function FileInfo({ analysis }: FileInfoProps) {
  const [showAllColumns, setShowAllColumns] = useState(false)
  const visibleColumns = showAllColumns ? analysis.columns : analysis.columns.slice(0, 12)
  const hiddenCount = analysis.columns.length - visibleColumns.length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {analysis.fileName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Tamanho</p>
              <p className="font-semibold">{formatBytes(analysis.fileSize)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Registros</p>
              <p className="font-semibold">{formatNumber(analysis.recordCount)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Colunas</p>
              <p className="font-semibold">{analysis.columnCount}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Codificação</p>
              <p className="font-semibold">{analysis.encoding}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Delimitador</p>
              <p className="font-semibold">
                {analysis.delimiter === ';' ? 'ponto e vírgula (;)' : analysis.delimiter}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Columns className="h-5 w-5 text-primary" />
            Colunas detectadas
          </CardTitle>
          {analysis.columns.length > 12 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllColumns((v) => !v)}
            >
              {showAllColumns ? 'Mostrar menos' : `Ver todas (${analysis.columns.length})`}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {visibleColumns.map((col) => (
              <Badge key={col} variant="secondary" className="font-mono font-normal">
                {col}
              </Badge>
            ))}
            {!showAllColumns && hiddenCount > 0 && (
              <Badge variant="outline">+{hiddenCount}</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
