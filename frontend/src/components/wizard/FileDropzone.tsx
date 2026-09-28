import { useCallback, useState } from 'react'
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatBytes, formatNumber } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { UploadAnalyzeProgress } from '@/services/csvService'

interface FileDropzoneProps {
  onFileSelect: (file: File) => void
  isLoading?: boolean
  progress?: UploadAnalyzeProgress | null
  selectedFile?: File | null
}

function isCsvFile(file: File) {
  return file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
}

function formatEta(seconds: number | null | undefined): string | null {
  if (seconds == null) return null
  if (seconds <= 0) return 'quase pronto'
  if (seconds < 60) return `~${seconds}s restantes`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `~${mins}m ${secs.toString().padStart(2, '0')}s restantes`
}

export function FileDropzone({
  onFileSelect,
  isLoading,
  progress,
  selectedFile,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const acceptFile = useCallback(
    (file: File | undefined) => {
      if (!file) return
      if (!isCsvFile(file)) {
        toast.error('Envie apenas arquivos .csv')
        return
      }
      onFileSelect(file)
    },
    [onFileSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      acceptFile(e.dataTransfer.files[0])
    },
    [acceptFile]
  )

  const etaLabel = formatEta(progress?.etaSeconds)
  const percent = Math.round(progress?.percent ?? 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selecione o arquivo</CardTitle>
        <CardDescription>
          Envie o CSV de produtos preenchido a partir do modelo (delimitador ;).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors',
            isDragging
              ? 'border-primary bg-accent/50'
              : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-accent/20',
            isLoading && 'pointer-events-none opacity-90'
          )}
        >
          {isLoading ? (
            <div className="flex w-full max-w-md flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">
                {progress?.label ?? 'Analisando arquivo…'}
              </p>
              <Progress value={percent} className="h-2.5 w-full" />
              <div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{percent}%</span>
                <span>
                  {progress?.total != null && progress.total > 0 && progress.loaded != null
                    ? `${formatBytes(progress.loaded)} / ${formatBytes(progress.total)}`
                    : progress?.records != null
                      ? `${formatNumber(progress.records)} linha(s)`
                      : '—'}
                </span>
              </div>
              <div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {progress?.records != null && progress.phase === 'analyze'
                    ? `${formatNumber(progress.records)} registro(s) lidos`
                    : progress?.phase === 'upload'
                      ? 'Upload'
                      : progress?.phase === 'saving'
                        ? 'Gravação'
                        : 'Análise'}
                </span>
                <span>{etaLabel ?? 'estimando tempo…'}</span>
              </div>
            </div>
          ) : selectedFile ? (
            <>
              <FileSpreadsheet className="h-12 w-12 text-primary" />
              <p className="mt-4 font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">Clique ou arraste outro arquivo para trocar</p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 font-medium">Arraste seu arquivo CSV aqui</p>
              <p className="text-sm text-muted-foreground">ou clique para procurar</p>
            </>
          )}
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Selecionar arquivo CSV de produtos"
            onChange={(e) => {
              acceptFile(e.target.files?.[0])
              e.target.value = ''
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={isLoading}
          />
        </div>
      </CardContent>
    </Card>
  )
}
