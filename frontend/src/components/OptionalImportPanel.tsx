import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  ClipboardCopy,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
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

function skippedDetail(
  skip: NonNullable<OptionalJobSnapshot['skipped']>[number]
): string {
  return skip.codigoadicional || skip.codigofornecedor || skip.codigo || '-'
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
  const [showSkipped, setShowSkipped] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const headerLine = meta.columns.join(';')
  const importReady =
    kind === 'barcodes' ||
    kind === 'supplierRefs' ||
    kind === 'validity' ||
    kind === 'stock' ||
    kind === 'lots'
  const templateUrl =
    kind === 'barcodes'
      ? optionalService.barcodeTemplateUrl
      : kind === 'supplierRefs'
        ? optionalService.supplierTemplateUrl
        : kind === 'validity'
          ? optionalService.validityTemplateUrl
          : kind === 'stock'
            ? optionalService.stockTemplateUrl
            : kind === 'lots'
              ? optionalService.lotsTemplateUrl
              : null
  const active = job?.status === 'queued' || job?.status === 'running'
  const finished =
    job &&
    (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')

  useEffect(() => {
    setSelectedFile(null)
    setJob(null)
    setShowSkipped(false)
    setShowErrors(false)
  }, [kind])

  useEffect(() => {
    if (!job || !['running', 'queued'].includes(job.status)) return
    const timer = setInterval(async () => {
      try {
        const next =
          kind === 'supplierRefs'
            ? await optionalService.getSupplierJob(job.id)
            : kind === 'validity'
              ? await optionalService.getValidityJob(job.id)
              : kind === 'stock'
                ? await optionalService.getStockJob(job.id)
                : kind === 'lots'
                  ? await optionalService.getLotJob(job.id)
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
    setShowSkipped(false)
    setShowErrors(false)
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
      toast.message('Em breve', {
        description: `${meta.shortLabel}: envio ainda não disponível.`,
      })
      return
    }

    setIsSubmitting(true)
    try {
      const snapshot =
        kind === 'supplierRefs'
          ? await optionalService.startSupplierSend(selectedFile, { tmsBaseUrl, mode })
          : kind === 'validity'
            ? await optionalService.startValiditySend(selectedFile, { tmsBaseUrl, mode })
            : kind === 'stock'
              ? await optionalService.startStockSend(selectedFile, { tmsBaseUrl, mode })
              : kind === 'lots'
                ? await optionalService.startLotSend(selectedFile, { tmsBaseUrl, mode })
                : await optionalService.startBarcodeSend(selectedFile, { tmsBaseUrl, mode })
      setJob(snapshot)
      toast.success(mode === 'simulate' ? 'Simulação iniciada' : 'Importação iniciada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao iniciar importação')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-3">
        <nav
          aria-label="Navegação"
          className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
        >
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
        </nav>

        <div className="flex items-start gap-3">
          {icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">{meta.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{meta.description}</p>
          </div>
        </div>
      </div>

      {/* Modelo compacto */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">CSV · {headerLine}</p>
          <div className="flex flex-wrap gap-2">
            {templateUrl ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={templateUrl} download>
                  <Download className="h-3.5 w-3.5" />
                  Modelo
                </a>
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => void copyHeader()}>
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copiar
            </Button>
          </div>
        </div>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Ex.: {meta.sampleRow.join(';')}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">{meta.sourceHint}</p>
      </div>

      {/* Upload */}
      <div className="rounded-xl border border-border bg-card p-4">
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
            'relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            isDragging && 'border-primary bg-accent/60',
            !isDragging &&
              !selectedFile &&
              'border-border bg-muted/20 hover:border-primary/50 hover:bg-accent/30',
            selectedFile && !isDragging && 'border-primary/40 bg-accent/20'
          )}
        >
          {selectedFile ? (
            <>
              <CheckCircle2 className="mb-2 h-7 w-7 text-primary" />
              <p className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                {selectedFile.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatBytes(selectedFile.size)}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3"
                disabled={Boolean(active)}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedFile(null)
                  setJob(null)
                  setShowSkipped(false)
                  setShowErrors(false)
                }}
              >
                <X className="h-3.5 w-3.5" />
                Remover
              </Button>
            </>
          ) : (
            <>
              <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Solte o CSV ou clique para escolher</p>
            </>
          )}
        </div>

        {job ? (
          <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                {job.mode === 'simulate' ? 'Simulação' : 'Envio'} · {job.status}
              </span>
              <span className="text-muted-foreground">{job.percent}%</span>
            </div>
            <Progress value={job.percent} />
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1 font-normal">
                Ok {formatNumber(job.successCount)}
              </Badge>
              <Badge variant="outline" className="gap-1 font-normal">
                Ignorados {formatNumber(job.skippedCount)}
              </Badge>
              <Badge
                variant={job.errorCount > 0 ? 'destructive' : 'outline'}
                className="gap-1 font-normal"
              >
                Falhas {formatNumber(job.errorCount)}
              </Badge>
            </div>

            {job.skippedCount > 0 ? (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setShowSkipped((v) => !v)}
                >
                  {showSkipped ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  {showSkipped ? 'Ocultar ignorados' : 'Ver ignorados'}
                </Button>
                {showSkipped && (job.skipped?.length ?? 0) > 0 ? (
                  <div className="max-h-44 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Linha</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {job.skipped!.map((skip) => (
                          <TableRow key={`skip-${skip.index}-${skippedDetail(skip)}`}>
                            <TableCell>{skip.index >= 0 ? skip.index + 2 : '-'}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {skippedDetail(skip)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {skip.message}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </div>
            ) : null}

            {job.errors.length > 0 ? (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setShowErrors((v) => !v)}
                >
                  {showErrors ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  {showErrors ? 'Ocultar falhas' : 'Ver falhas'}
                </Button>
                {showErrors ? (
                  <div className="max-h-44 overflow-auto rounded-md border">
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
              </div>
            ) : null}

            {finished && job.mode === 'simulate' ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Simulação — nada gravado no banco.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
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
            Importar
          </Button>
        </div>
      </div>
    </div>
  )
}
