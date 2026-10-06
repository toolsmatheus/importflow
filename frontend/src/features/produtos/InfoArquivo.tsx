import { FileSpreadsheet } from 'lucide-react'
import { formatBytes, formatNumber } from '@/lib/utils'
import type { CsvAnalysis } from '@/types'
import { Button } from '@/components'
interface InfoArquivoProps {
  analysis: CsvAnalysis
  onChange?: () => void
  /** Origem do arquivo (ex.: coleta de pasta). */
  sourceHint?: string
}

export function InfoArquivo({ analysis, onChange, sourceHint }: InfoArquivoProps) {
  const delimiterLabel =
    analysis.delimiter === ';' ? 'ponto e vírgula' : analysis.delimiter

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted/30 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-action/10">
          <FileSpreadsheet className="h-5 w-5 text-action" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{analysis.fileName}</p>
          <p className="text-xs text-fg-muted">
            {formatNumber(analysis.recordCount)} registros · {formatBytes(analysis.fileSize)} ·{' '}
            {analysis.columnCount} colunas · {analysis.encoding} · {delimiterLabel}
            {sourceHint ? ` · ${sourceHint}` : ''}
          </p>
        </div>
      </div>
      {onChange ? (
        <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={onChange}>
          Trocar arquivo
        </Button>
      ) : null}
    </div>
  )
}
