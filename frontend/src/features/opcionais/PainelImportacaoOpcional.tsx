import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ClipboardCopy,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  Loader2,
  Upload,
} from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import {
  OPTIONAL_IMPORT_META,
  OPTIONAL_IMPORT_READY,
} from '@/lib/optionalImportMeta'
import { useAssistenteImportacao } from '@/features/produtos/useAssistenteImportacao'
import { ZonaSoltarArquivo } from '@/features/produtos/ZonaSoltarArquivo'
import { DEFAULT_FOLDER_PATH } from '@/features/produtos/PainelColetaPasta'
import {
  opcionalServico,
  type OptionalJobSnapshot,
} from '@/api/opcional'
import type { FileInputMode, OptionalImportKind } from '@/types'
import {
  Button,
  Badge,
  Input,
  Progress,
  GridTh,
  GridCell,
  buttonVariants,
} from '@/components'

interface PainelImportacaoOpcionalProps {
  kind: OptionalImportKind
  onBack: () => void
}

const FOLDER_PATH_KEY = 'toolsdataweb.collectFolderPath'

function errorDetail(err: OptionalJobSnapshot['errors'][number]): string {
  return err.codigofornecedor || err.codigo || '-'
}

function skippedDetail(
  skip: NonNullable<OptionalJobSnapshot['skipped']>[number]
): string {
  return skip.codigofornecedor || skip.codigo || '-'
}

function readStoredFolder(): string {
  try {
    return localStorage.getItem(FOLDER_PATH_KEY)?.trim() || DEFAULT_FOLDER_PATH
  } catch {
    return DEFAULT_FOLDER_PATH
  }
}

export function PainelImportacaoOpcional({ kind, onBack }: PainelImportacaoOpcionalProps) {
  const meta = OPTIONAL_IMPORT_META[kind]
  const ready = OPTIONAL_IMPORT_READY[kind]
  const { tmsBaseUrl } = useAssistenteImportacao()
  const [inputMode, setInputMode] = useState<FileInputMode>('manual')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [folderPath, setFolderPath] = useState(DEFAULT_FOLDER_PATH)
  const [collecting, setCollecting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [job, setJob] = useState<OptionalJobSnapshot | null>(null)
  const [showSkipped, setShowSkipped] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const headerLine = meta.columns.join(';')
  const templateUrl =
    kind === 'supplierRefs'
      ? opcionalServico.supplierTemplateUrl
      : kind === 'validity'
        ? opcionalServico.validityTemplateUrl
        : kind === 'stock'
          ? opcionalServico.stockTemplateUrl
          : kind === 'lots'
            ? opcionalServico.lotsTemplateUrl
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
    setInputMode('manual')
    setFolderPath(readStoredFolder())
  }, [kind])

  useEffect(() => {
    const trimmed = folderPath.trim()
    if (!trimmed) return
    try {
      localStorage.setItem(FOLDER_PATH_KEY, trimmed)
    } catch {
      /* ignore */
    }
  }, [folderPath])

  useEffect(() => {
    if (!job || !['running', 'queued'].includes(job.status)) return
    const timer = setInterval(async () => {
      try {
        const next = await opcionalServico.getJob(kind, job.id)
        setJob(next)
      } catch {
        /* ignore poll errors */
      }
    }, 400)
    return () => clearInterval(timer)
  }, [job?.id, job?.status, kind])

  const acceptFile = useCallback((file: File) => {
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

  const handleCollect = async () => {
    const path = folderPath.trim() || DEFAULT_FOLDER_PATH
    if (!folderPath.trim()) setFolderPath(DEFAULT_FOLDER_PATH)
    setCollecting(true)
    try {
      const result = await opcionalServico.collectFolder(path)
      const match = result.files.find((f) => f.kind === kind)
      if (!match) {
        toast.error(`Arquivo de ${meta.shortLabel} não encontrado na pasta`, {
          description: `Esperado: ${meta.exampleFileName}`,
        })
        return
      }
      const file = new File([match.content], match.fileName, { type: 'text/csv' })
      acceptFile(file)
      toast.success(`Coletado: ${match.fileName}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao coletar pasta')
    } finally {
      setCollecting(false)
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Selecione um CSV antes de importar')
      return
    }
    if (!ready) {
      toast.message('Em breve', {
        description: `${meta.title}: envio ainda não disponível.`,
      })
      return
    }

    setIsSubmitting(true)
    try {
      const snapshot = await opcionalServico.startSend(kind, selectedFile, {
        tmsBaseUrl,
        mode: 'live',
      })
      setJob(snapshot)
      toast.success('Importação iniciada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao iniciar importação')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <nav aria-label="Navegação" className="flex flex-wrap items-center gap-1.5 text-sm text-fg-muted">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md px-1.5 py-0.5 hover:bg-surface-muted hover:text-fg-strong"
          >
            Etapa 2
          </button>
          <span aria-hidden>/</span>
          <span className="font-medium text-fg-strong">{meta.title}</span>
        </nav>
        <p className="text-sm text-fg-muted">{meta.description}</p>
      </div>

      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">CSV · {headerLine}</p>
          <div className="flex flex-wrap gap-2">
            {templateUrl ? (
              <a
                href={templateUrl}
                download
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                <Download className="h-3.5 w-3.5" />
                Modelo
              </a>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={() => void copyHeader()}>
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copiar
            </Button>
          </div>
        </div>
        <p className="mt-2 font-mono text-xs text-fg-muted">Ex.: {meta.sampleRow.join(';')}</p>
        <p className="mt-1.5 text-xs text-fg-muted">{meta.sourceHint}</p>
      </div>

      {!ready ? (
        <div className="rounded-lg border border-line bg-surface-muted/30 px-4 py-6 text-center text-sm text-fg-muted">
          Envio em breve para este item.
        </div>
      ) : (
        <>
          <div className="inline-flex rounded-md border border-line p-0.5">
            <Button
              size="sm"
              variant={inputMode === 'manual' ? 'secondary' : 'ghost'}
              className="h-8"
              disabled={Boolean(active)}
              onClick={() => setInputMode('manual')}
            >
              Manual
            </Button>
            <Button
              size="sm"
              variant={inputMode === 'folder' ? 'secondary' : 'ghost'}
              className="h-8"
              disabled={Boolean(active)}
              onClick={() => setInputMode('folder')}
            >
              Pasta
            </Button>
          </div>

          {inputMode === 'manual' ? (
            <ZonaSoltarArquivo
              onFileSelect={acceptFile}
              selectedFile={selectedFile}
              isLoading={isSubmitting || Boolean(active)}
              title="Selecione o arquivo"
              description={`Envie o CSV de ${meta.shortLabel.toLowerCase()} (delimitador ;).`}
              inputLabel={`Selecionar CSV de ${meta.shortLabel}`}
            />
          ) : (
            <div className="space-y-2 rounded-lg border border-line bg-surface px-3 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FolderOpen className="h-4 w-4 text-fg-muted" />
                Coletar pasta
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  onBlur={() => {
                    if (!folderPath.trim()) setFolderPath(DEFAULT_FOLDER_PATH)
                  }}
                  placeholder={DEFAULT_FOLDER_PATH}
                  className="font-mono text-sm"
                  disabled={collecting || Boolean(active)}
                />
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  disabled={collecting || Boolean(active)}
                  onClick={() => void handleCollect()}
                >
                  {collecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                  Coletar
                </Button>
              </div>
              {selectedFile ? (
                <p className="text-xs text-fg-muted">
                  Arquivo: <span className="font-mono">{selectedFile.name}</span>
                </p>
              ) : (
                <p className="text-xs text-fg-subtle">Esperado: {meta.exampleFileName}</p>
              )}
            </div>
          )}

          {job ? (
            <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">Envio · {job.status}</span>
                <span className="text-fg-muted">{job.percent}%</span>
              </div>
              <Progress value={job.percent} />
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral" className="gap-1 font-normal">
                  Ok {formatNumber(job.successCount)}
                </Badge>
                <Badge variant="neutral" className="gap-1 font-normal">
                  Ignorados {formatNumber(job.skippedCount)}
                </Badge>
                <Badge
                  variant={job.errorCount > 0 ? 'negative' : 'neutral'}
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
                      <table className="w-full border-collapse font-data text-sm">
                        <thead>
                          <tr>
                            <GridTh>Linha</GridTh>
                            <GridTh>Código</GridTh>
                            <GridTh>Motivo</GridTh>
                          </tr>
                        </thead>
                        <tbody>
                          {job.skipped!.map((skip) => (
                            <tr key={`skip-${skip.index}-${skippedDetail(skip)}`}>
                              <GridCell>{skip.index >= 0 ? skip.index + 2 : '-'}</GridCell>
                              <GridCell className="font-mono text-xs">
                                {skippedDetail(skip)}
                              </GridCell>
                              <GridCell className="text-xs text-fg-muted">
                                {skip.message}
                              </GridCell>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                      <table className="w-full border-collapse font-data text-sm">
                        <thead>
                          <tr>
                            <GridTh>Linha</GridTh>
                            <GridTh>Código</GridTh>
                            <GridTh>Mensagem</GridTh>
                          </tr>
                        </thead>
                        <tbody>
                          {job.errors.map((err) => (
                            <tr key={`${err.index}-${errorDetail(err)}`}>
                              <GridCell>{err.index >= 0 ? err.index + 2 : '-'}</GridCell>
                              <GridCell className="font-mono text-xs">
                                {errorDetail(err)}
                              </GridCell>
                              <GridCell className="text-danger text-xs">
                                {err.message}
                              </GridCell>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {finished ? (
                <p className="text-xs text-fg-muted">
                  Concluído · ok {formatNumber(job.successCount)} · falhas{' '}
                  {formatNumber(job.errorCount)}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <div className="flex justify-between pt-1">
        <Button type="button" variant="secondary" onClick={onBack} disabled={Boolean(active)}>
          Voltar
        </Button>
        {ready ? (
          <Button
            type="button"
            onClick={() => void handleImport()}
            disabled={isSubmitting || !selectedFile || Boolean(active)}
          >
            {isSubmitting || active ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Importar
          </Button>
        ) : null}
      </div>
    </div>
  )
}
