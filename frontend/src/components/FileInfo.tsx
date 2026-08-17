import { FileSpreadsheet, Columns, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBytes, formatNumber } from '@/lib/utils'
import type { CsvAnalysis } from '@/types'

interface FileInfoProps {
  analysis: CsvAnalysis
  delimiter: string
  encoding: string
  hasHeader: boolean
  onDelimiterChange: (value: string) => void
  onEncodingChange: (value: string) => void
  onHasHeaderChange: (value: boolean) => void
  onReanalyze?: () => void
  isReanalyzing?: boolean
}

export function FileInfo({
  analysis,
  delimiter,
  encoding,
  hasHeader,
  onDelimiterChange,
  onEncodingChange,
  onHasHeaderChange,
  onReanalyze,
  isReanalyzing = false,
}: FileInfoProps) {
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <p className="font-semibold">{analysis.delimiter}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configurações do CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Delimitador</Label>
              <Input value={delimiter} onChange={(e) => onDelimiterChange(e.target.value)} maxLength={1} />
            </div>
            <div className="space-y-2">
              <Label>Encoding</Label>
              <Input value={encoding} onChange={(e) => onEncodingChange(e.target.value)} />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox
                id="hasHeader"
                checked={hasHeader}
                onCheckedChange={(checked) => onHasHeaderChange(checked === true)}
              />
              <Label htmlFor="hasHeader" className="cursor-pointer">
                Possui cabeçalho
              </Label>
            </div>
          </div>
          {onReanalyze && (
            <Button type="button" variant="outline" size="sm" onClick={onReanalyze} disabled={isReanalyzing}>
              {isReanalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reanalisar arquivo
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Columns className="h-5 w-5 text-primary" />
            Colunas detectadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {analysis.columns.map((col) => (
              <Badge key={col} variant="secondary">
                {col}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
