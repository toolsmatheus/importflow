import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBytes, formatNumber } from '@/lib/utils'
import type { CsvAnalysis } from '@/types'

interface FileInfoProps {
  analysis: CsvAnalysis
  onChange?: () => void
  /** Origem do arquivo (ex.: coleta de pasta). */
  sourceHint?: string
}

export function FileInfo({ analysis, onChange, sourceHint }: FileInfoProps) {
  const delimiterLabel =
    analysis.delimiter === ';' ? 'ponto e vírgula' : analysis.delimiter

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{analysis.fileName}</p>
          <p className="text-xs text-muted-foreground">
            {formatNumber(analysis.recordCount)} registros · {formatBytes(analysis.fileSize)} ·{' '}
            {analysis.columnCount} colunas · {analysis.encoding} · {delimiterLabel}
            {sourceHint ? ` · ${sourceHint}` : ''}
          </p>
        </div>
      </div>
      {onChange ? (
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onChange}>
          Trocar arquivo
        </Button>
      ) : null}
    </div>
  )
}
