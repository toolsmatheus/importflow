import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatBytes, formatNumber } from '@/lib/utils'
import { OPTIONAL_IMPORT_META } from '@/lib/optionalImportMeta'
import { useImportWizard } from '@/hooks/useImportWizard'
import {
  optionalService,
  type OptionalJobSnapshot,
} from '@/services/optionalService'
import type { OptionalImportKind } from '@/types'

interface OptionalImportPanelProps {
  kind: OptionalImportKind
  onBack: () => void
  onBackToThemes?: () => void
  themeLabel?: string
  icon?: ReactNode
}

function isCsvFile(file: File) {
  return file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
}

function errorDetail(err: OptionalJobSnapshot['errors'][number]): string {
  return err.codigoadicional || err.codigofornecedor || err.codigo || '-'
}

export function OptionalImportPanel({
  kind,
  onBack,
  onBackToThemes,
  themeLabel = 'Produtos',
  icon,
}: OptionalImportPanelProps) {
  const meta = OPTIONAL_IMPORT_META[kind]
  const { tmsBaseUrl } = useImportWizard()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [job, setJob] = useState<OptionalJobSnapshot | null>(null)

  const headerLine = meta.columns.join(';')
  const importReady = kind === 'barcodes' || kind === 'supplierRefs'
  const templateUrl =
    kind === 'barcodes'
      ? optionalService.barcodeTemplateUrl
      : kind === 'supplierRefs'
        ? optionalService.supplierTemplateUrl
        : null
  const active = job?.status === 'queued' || job?.status === 'running'
  const finished =
    job &&
    (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')

  useEffect(() => {
    setSelectedFile(null)
    setJob(null)
  }, [kind])

  useEffect(() => {
    if (!job || !['running', 'queued'].includes(job.status)) return
    const timer = setInterval(async () => {
      try {
        const next =
          kind === 'supplierRefs'
            ? await optionalService.getSupplierJob(job.id)
            : await optionalService.getBarcodeJob(job.id)
        setJob(next)
      } catch {
        /* ignore poll errors */
      }
    }, 400)
    return () => clearInterval(timer)
  }, [job?.id, job?.status, kind])

  const acceptFile = useCallback((file: File | undefined) => {
    if (!file) return
    if (!isCsvFile(file)) {
      toast.error('Envie apenas arquivos .csv')
      return
    }
    setSelectedFile(file)
    setJob(null)
  }, [])

  const copyHeader = async () => {
    try {
      await navigator.clipboard.writeText(headerLine)
      toast.success('Cabeçalho copiado')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  const handleImport = async (mode: 'live' | 'simulate' = 'live') => {
    if (!selectedFile) {
      toast.error('Selecione um CSV antes de importar')
      return
    }

    if (!importReady) {
      toast.message('Backend ainda não conectado', {
        description: `${meta.shortLabel}: a tela está pronta; o envio será ligado em seguida.`,
      })
      return
    }

    setIsSubmitting(true)
    try {
      const snapshot =
        kind === 'supplierRefs'
          ? await optionalService.startSupplierSend(selectedFile, { tmsBaseUrl, mode })
          : await optionalService.startBarcodeSend(selectedFile, { tmsBaseUrl, mode })
      setJob(snapshot)
      toast.success(
        mode === 'simulate'
          ? 'Simulação iniciada'
          : kind === 'supplierRefs'
            ? 'Importação de códigos de fornecedor iniciada'
            : 'Importação de códigos de barras iniciada'
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao iniciar importação')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={onBackToThemes ?? onBack}
          className="rounded-md px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
        >
          Opcionais
        </button>
        <span aria-hidden>/</span>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
        >
          {themeLabel}
        </button>
        <span aria-hidden>/</span>
        <span className="font-medium text-foreground">{meta.shortLabel}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <Card className="order-2 lg:order-1">
          <CardHeader className="space-y-3">
            <div className="flex items-start gap-3">
              {icon ? (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg leading-snug">{meta.title}</CardTitle>
                <CardDescription>{meta.description}</CardDescription>
              </div>
            </div>
            <p className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {meta.whenToUse}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Modelo do CSV</p>
              <div className="flex flex-wrap gap-2">
                {templateUrl ? (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={templateUrl} download>
                      <Download className="h-3.5 w-3.5" />
                      Baixar modelo
                    </a>
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={() => void copyHeader()}>
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  Copiar cabeçalho
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    {meta.columns.map((col) => (
                      <TableHead key={col} className="font-mono text-xs">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    {meta.sampleRow.map((value, i) => (
                      <TableCell
                        key={`${meta.columns[i]}-${i}`}
                        className="font-mono text-xs text-muted-foreground"
                      >
                        {value}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <p className="text-sm text-muted-foreground">{meta.sourceHint}</p>
            <p className="font-mono text-xs text-muted-foreground">
              Ex.: {meta.exampleFileName} · delimitador ;
            </p>
          </CardContent>
        </Card>

        <Card className="order-1 lg:order-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Arquivo</CardTitle>
              <Badge variant={selectedFile ? 'default' : 'secondary'}>
                {selectedFile ? 'Pronto' : 'Aguardando CSV'}
              </Badge>
            </div>
            <CardDescription>Arraste o arquivo ou selecione no computador.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                acceptFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />

            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  inputRef.current?.click()
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                acceptFile(e.dataTransfer.files[0])
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all outline-none',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isDragging && 'scale-[1.01] border-primary bg-accent/60 shadow-sm',
                !isDragging &&
                  !selectedFile &&
                  'border-border bg-muted/20 hover:border-primary/50 hover:bg-accent/30',
                selectedFile && !isDragging && 'border-primary/40 bg-accent/20'
              )}
            >
              {selectedFile ? (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p className="flex items-center gap-2 font-medium">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    {selectedFile.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatBytes(selectedFile.size)}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-4"
                    disabled={Boolean(active)}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFile(null)
                      setJob(null)
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                    Remover
                  </Button>
                </>
              ) : (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="font-medium">Solte o CSV aqui</p>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    ou clique para escolher · apenas .csv
                  </p>
                </>
              )}
            </div>

            {job ? (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {job.mode === 'simulate' ? 'Simulação' : 'Envio'} · {job.status}
                  </span>
                  <span className="text-muted-foreground">{job.percent}%</span>
                </div>
                <Progress value={job.percent} />
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-muted-foreground">Ok</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatNumber(job.successCount)}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-muted-foreground">Ignorados</p>
                    <p className="font-semibold">{formatNumber(job.skippedCount)}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-muted-foreground">Falhas</p>
                    <p className="font-semibold text-destructive">
                      {formatNumber(job.errorCount)}
                    </p>
                  </div>
                </div>
                {job.errors.length > 0 ? (
                  <div className="max-h-40 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Linha</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Mensagem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {job.errors.map((err) => (
                          <TableRow key={`${err.index}-${errorDetail(err)}`}>
                            <TableCell>{err.index >= 0 ? err.index + 2 : '-'}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {errorDetail(err)}
                            </TableCell>
                            <TableCell className="text-destructive text-xs">
                              {err.message}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
                {finished && job.mode === 'simulate' ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Simulação concluída — nada foi gravado no banco.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={onBack} disabled={Boolean(active)}>
                Voltar
              </Button>
              {importReady ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isSubmitting || !selectedFile || Boolean(active)}
                  onClick={() => void handleImport('simulate')}
                >
                  <Sparkles className="h-4 w-4" />
                  Simular
                </Button>
              ) : null}
              <Button
                type="button"
                className="ml-auto"
                onClick={() => void handleImport('live')}
                disabled={isSubmitting || !selectedFile || Boolean(active)}
              >
                {isSubmitting || active ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Importar {meta.shortLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
