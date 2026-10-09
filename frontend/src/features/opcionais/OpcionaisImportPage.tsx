import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FolderOpen,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { opcionalServico, type OptionalJobSnapshot } from '@/api/opcional'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Progress,
  cn,
} from '@/components'
import { formatNumber } from '@/lib/utils'
import { useAssistenteImportacao } from '@/features/produtos/useAssistenteImportacao'
import { DEFAULT_FOLDER_PATH } from '@/features/produtos/PainelColetaPasta'
import {
  OPTIONAL_IMPORT_KINDS,
  OPTIONAL_IMPORT_META,
  OPTIONAL_IMPORT_READY,
  OPTIONAL_IMPORT_READY_KINDS,
} from '@/lib/optionalImportMeta'
import type { OptionalImportKind } from '@/types'

const FOLDER_PATH_KEY = 'toolsdataweb.collectFolderPath'
const PREVIEW_PAGE_SIZE = 200

function pageSlice<T>(items: T[], page: number, pageSize = PREVIEW_PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

function totalPages(count: number, pageSize = PREVIEW_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(count / pageSize))
}

type SlotState = {
  file: File | null
  /** Resultado da verificação (sempre mode=simulate — não grava). */
  preview: OptionalJobSnapshot | null
  /** Resultado do envio real (mode=live). */
  job: OptionalJobSnapshot | null
  error?: string
  collecting?: boolean
  previewing?: boolean
  importing?: boolean
}

type Slots = Record<OptionalImportKind, SlotState>

function emptySlots(): Slots {
  return {
    barcodeExtras: { file: null, preview: null, job: null },
    supplierRefs: { file: null, preview: null, job: null },
    stock: { file: null, preview: null, job: null },
    lots: { file: null, preview: null, job: null },
    priceUpdate: { file: null, preview: null, job: null },
    paymentDiscount: { file: null, preview: null, job: null },
    validity: { file: null, preview: null, job: null },
  }
}

function readStoredFolder(): string {
  try {
    return localStorage.getItem(FOLDER_PATH_KEY)?.trim() || DEFAULT_FOLDER_PATH
  } catch {
    return DEFAULT_FOLDER_PATH
  }
}

function jobActive(job: OptionalJobSnapshot | null): boolean {
  return job?.status === 'queued' || job?.status === 'running'
}

function jobFinished(job: OptionalJobSnapshot | null): boolean {
  return Boolean(
    job &&
      (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')
  )
}

function slotBusy(slot: SlotState): boolean {
  return Boolean(
    slot.collecting ||
      slot.previewing ||
      slot.importing ||
      jobActive(slot.preview) ||
      jobActive(slot.job)
  )
}

export function OpcionaisImportPage() {
  const { tmsBaseUrl } = useAssistenteImportacao()
  const [folderPath, setFolderPath] = useState(DEFAULT_FOLDER_PATH)
  const [slots, setSlots] = useState<Slots>(emptySlots)
  const [modalKind, setModalKind] = useState<OptionalImportKind | null>(null)
  const [previewTab, setPreviewTab] = useState<'errors' | 'alerts'>('errors')
  const [listPage, setListPage] = useState(1)
  const slotsRef = useRef(slots)
  slotsRef.current = slots

  useEffect(() => {
    setFolderPath(readStoredFolder())
  }, [])

  useEffect(() => {
    const trimmed = folderPath.trim()
    if (!trimmed) return
    try {
      localStorage.setItem(FOLDER_PATH_KEY, trimmed)
    } catch {
      /* ignore */
    }
  }, [folderPath])

  const anyBusy = useMemo(
    () => OPTIONAL_IMPORT_READY_KINDS.some((k) => slotBusy(slots[k])),
    [slots]
  )

  const modalSlot = modalKind ? slots[modalKind] : null
  const modalPreview = modalSlot?.preview ?? null
  const modalMeta = modalKind ? OPTIONAL_IMPORT_META[modalKind] : null

  useEffect(() => {
    setListPage(1)
    if (modalPreview) {
      setPreviewTab(modalPreview.errors.length > 0 ? 'errors' : 'alerts')
    }
  }, [modalKind, modalPreview?.id])

  useEffect(() => {
    setListPage(1)
  }, [previewTab])

  const setSlotFile = (kind: OptionalImportKind, file: File) => {
    setSlots((prev) => ({
      ...prev,
      [kind]: {
        file,
        preview: null,
        job: null,
        error: undefined,
        collecting: false,
        previewing: false,
        importing: false,
      },
    }))
  }

  const clearSlot = (kind: OptionalImportKind) => {
    setSlots((prev) => ({
      ...prev,
      [kind]: emptySlots()[kind],
    }))
  }

  const pollJob = async (
    kind: OptionalImportKind,
    snapshot: OptionalJobSnapshot,
    field: 'preview' | 'job'
  ): Promise<OptionalJobSnapshot> => {
    let current = snapshot
    while (jobActive(current)) {
      await new Promise((r) => setTimeout(r, 400))
      current = await opcionalServico.getJob(kind, snapshot.id)
      setSlots((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], [field]: current },
      }))
    }
    return current
  }

  const handleCollectOne = async (kind: OptionalImportKind) => {
    const path = folderPath.trim() || DEFAULT_FOLDER_PATH
    if (!folderPath.trim()) setFolderPath(DEFAULT_FOLDER_PATH)

    setSlots((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], collecting: true, error: undefined },
    }))

    try {
      const result = await opcionalServico.collectFolder(path)
      const match = result.files.find((f) => f.kind === kind)
      if (!match) {
        toast.error(`Arquivo de ${OPTIONAL_IMPORT_META[kind].shortLabel} não encontrado`, {
          description: `Esperado: ${OPTIONAL_IMPORT_META[kind].exampleFileName}`,
        })
        return
      }
      const file = new File([match.content], match.fileName, { type: 'text/csv' })
      setSlotFile(kind, file)
      toast.success(`Coletado: ${match.fileName}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao coletar pasta')
    } finally {
      setSlots((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], collecting: false },
      }))
    }
  }

  /** Verificação somente — mode fixo `simulate` (backend não chama insert/salvar). */
  const handlePreviewOne = async (kind: OptionalImportKind) => {
    const file = slotsRef.current[kind].file
    if (!file) {
      toast.error('Colete o arquivo antes')
      return
    }

    setModalKind(kind)
    setSlots((prev) => ({
      ...prev,
      [kind]: {
        ...prev[kind],
        previewing: true,
        error: undefined,
        preview: null,
        job: null,
      },
    }))

    try {
      const snapshot = await opcionalServico.startSend(kind, file, {
        tmsBaseUrl,
        mode: 'simulate',
      })
      if (snapshot.mode !== 'simulate') {
        throw new Error('Verificação iniciou em modo incorreto — abortado')
      }
      setSlots((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], preview: snapshot },
      }))
      const result = await pollJob(kind, snapshot, 'preview')
      if (result.mode !== 'simulate') {
        throw new Error('Job de verificação não está em modo simulação')
      }
      const label = OPTIONAL_IMPORT_META[kind].shortLabel
      if (result.errorCount > 0) {
        toast.message(`${label}: verificação com erros`, {
          description: `${formatNumber(result.errorCount)} erro(s) · ${formatNumber(result.skippedCount)} alerta(s)`,
        })
      } else if (result.skippedCount > 0) {
        toast.message(`${label}: verificação com alertas`, {
          description: `${formatNumber(result.successCount)} ok · ${formatNumber(result.skippedCount)} alerta(s)`,
        })
      } else {
        toast.success(
          `${label}: verificação ok — ${formatNumber(result.successCount)} registro(s)`
        )
      }
    } catch (error) {
      setSlots((prev) => ({
        ...prev,
        [kind]: {
          ...prev[kind],
          error: error instanceof Error ? error.message : 'Falha na verificação',
        },
      }))
      toast.error(
        error instanceof Error
          ? error.message
          : `Falha em ${OPTIONAL_IMPORT_META[kind].shortLabel}`
      )
    } finally {
      setSlots((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], previewing: false },
      }))
    }
  }

  const handleImportOne = async (kind: OptionalImportKind) => {
    const slot = slotsRef.current[kind]
    const file = slot.file
    if (!file) {
      toast.error('Colete o arquivo antes de importar')
      return
    }
    if (!jobFinished(slot.preview)) {
      toast.error('Visualize a verificação antes de importar')
      return
    }
    if ((slot.preview?.errorCount ?? 0) > 0) {
      toast.message('Há erros na verificação', {
        description: 'Corrija o CSV ou importe apenas se souber o impacto.',
      })
    }

    setSlots((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], importing: true, error: undefined },
    }))

    try {
      const snapshot = await opcionalServico.startSend(kind, file, {
        tmsBaseUrl,
        mode: 'live',
      })
      setSlots((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], job: snapshot },
      }))
      await pollJob(kind, snapshot, 'job')
      toast.success(`${OPTIONAL_IMPORT_META[kind].shortLabel}: importação concluída`)
    } catch (error) {
      setSlots((prev) => ({
        ...prev,
        [kind]: {
          ...prev[kind],
          error: error instanceof Error ? error.message : 'Falha ao iniciar',
        },
      }))
      toast.error(
        error instanceof Error
          ? error.message
          : `Falha em ${OPTIONAL_IMPORT_META[kind].shortLabel}`
      )
    } finally {
      setSlots((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], importing: false },
      }))
    }
  }

  const previewRunning =
    Boolean(modalSlot?.previewing) || jobActive(modalPreview)
  const previewDone = jobFinished(modalPreview)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg-strong">Etapa 2</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Colete → Visualize (só verifica) → Importar.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-3 py-3 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center gap-2 text-sm font-medium">
          <FolderOpen className="h-4 w-4 text-fg-muted" />
          Pasta
        </div>
        <Input
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          onBlur={() => {
            if (!folderPath.trim()) setFolderPath(DEFAULT_FOLDER_PATH)
          }}
          placeholder={DEFAULT_FOLDER_PATH}
          className="font-mono text-sm"
          disabled={anyBusy}
        />
      </div>

      <ul className="overflow-hidden rounded-lg border border-line bg-surface">
        {OPTIONAL_IMPORT_KINDS.map((kind, index) => {
          const meta = OPTIONAL_IMPORT_META[kind]
          const ready = OPTIONAL_IMPORT_READY[kind]
          const slot = slots[kind]
          const busy = slotBusy(slot)
          const previewDoneRow = jobFinished(slot.preview)
          const canImport = ready && Boolean(slot.file) && previewDoneRow && !busy

          return (
            <li
              key={kind}
              className={cn(
                'px-3 py-2.5 sm:px-4',
                index > 0 && 'border-t border-line',
                !ready && 'opacity-55'
              )}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="w-5 text-[10px] font-medium tabular-nums text-fg-subtle">
                  {index + 1}.
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-fg-strong">
                  {meta.title}
                </span>
                <span className="font-mono text-[10px] text-fg-subtle">
                  {meta.exampleFileName}
                </span>

                {slot.file ? (
                  <span className="inline-flex max-w-[12rem] items-center gap-1 text-xs text-fg-muted">
                    <span className="truncate font-mono">{slot.file.name}</span>
                    {!busy ? (
                      <button
                        type="button"
                        className="shrink-0 text-fg-subtle hover:text-fg-strong"
                        onClick={() => clearSlot(kind)}
                        aria-label={`Remover ${meta.shortLabel}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-xs text-fg-subtle">—</span>
                )}

                {ready ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7"
                      disabled={busy}
                      onClick={() => void handleCollectOne(kind)}
                    >
                      {slot.collecting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FolderOpen className="h-3.5 w-3.5" />
                      )}
                      Coletar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7"
                      disabled={busy || !slot.file}
                      onClick={() => void handlePreviewOne(kind)}
                    >
                      {slot.previewing || jobActive(slot.preview) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      Visualizar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7"
                      disabled={!canImport}
                      onClick={() => void handleImportOne(kind)}
                    >
                      {slot.importing || jobActive(slot.job) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      Importar
                    </Button>
                  </div>
                ) : (
                  <span className="text-[10px] font-medium uppercase tracking-label text-fg-subtle">
                    Em breve
                  </span>
                )}
              </div>

              {slot.error ? <p className="mt-1 text-xs text-danger">{slot.error}</p> : null}
            </li>
          )
        })}
      </ul>

      <Dialog open={modalKind !== null} onOpenChange={(open) => !open && setModalKind(null)}>
        <DialogContent className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-hidden p-4 sm:p-5">
          <DialogHeader className="shrink-0 space-y-1 pr-8">
            <DialogTitle className="text-base leading-snug">
              Verificação — {modalMeta?.title ?? ''}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Nada é gravado no TMS.
            </DialogDescription>
          </DialogHeader>

          {previewRunning ? (
            <div className="shrink-0 space-y-2 py-3">
              <div className="flex items-center gap-2 text-sm text-fg-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando…
              </div>
              {modalPreview ? <Progress value={modalPreview.percent} /> : null}
            </div>
          ) : null}

          {previewDone && modalPreview ? (
            <PreviewModalBody
              preview={modalPreview}
              tab={previewTab}
              onTabChange={setPreviewTab}
              page={listPage}
              onPageChange={setListPage}
            />
          ) : null}

          {!previewRunning && !previewDone && modalSlot?.error ? (
            <p className="shrink-0 text-sm text-danger">{modalSlot.error}</p>
          ) : null}

          <DialogFooter className="shrink-0 border-t border-line pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setModalKind(null)}>
              Fechar
            </Button>
            {previewDone && modalKind ? (
              <Button
                type="button"
                size="sm"
                disabled={slotBusy(slots[modalKind]) || !slots[modalKind].file}
                onClick={() => {
                  const kind = modalKind
                  setModalKind(null)
                  void handleImportOne(kind)
                }}
              >
                <Upload className="h-4 w-4" />
                Importar
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PreviewModalBody({
  preview,
  tab,
  onTabChange,
  page,
  onPageChange,
}: {
  preview: OptionalJobSnapshot
  tab: 'errors' | 'alerts'
  onTabChange: (tab: 'errors' | 'alerts') => void
  page: number
  onPageChange: (page: number) => void
}) {
  const errors = preview.errors
  const alerts = preview.skipped ?? []
  const hasErrors = errors.length > 0
  const hasAlerts = alerts.length > 0
  const activeTab = tab === 'errors' && hasErrors ? 'errors' : hasAlerts ? 'alerts' : 'errors'
  type PreviewItem = { key: string; text: string; tone: 'danger' | 'muted' }
  const items: PreviewItem[] =
    activeTab === 'errors'
      ? errors.map((err) => ({
          key: `e-${err.index}-${err.codigo}`,
          text: `L${err.index >= 0 ? err.index + 2 : '?'} · ${err.codigofornecedor || err.codigo || '-'} · ${err.message}`,
          tone: 'danger',
        }))
      : alerts.map((skip) => ({
          key: `s-${skip.index}-${skip.codigo}`,
          text: `L${skip.index >= 0 ? skip.index + 2 : '?'} · ${skip.codigofornecedor || skip.codigo || '-'} · ${skip.message}`,
          tone: 'muted',
        }))
  const total = items.length
  const pages = totalPages(total)
  const safePage = Math.min(Math.max(1, page), pages)
  const pageItems = pageSlice(items, safePage)
  const from = total === 0 ? 0 : (safePage - 1) * PREVIEW_PAGE_SIZE + 1
  const to = Math.min(safePage * PREVIEW_PAGE_SIZE, total)

  if (!hasErrors && !hasAlerts) {
    return (
      <p className="shrink-0 text-sm text-fg-muted">
        Nenhum erro ou alerta. {formatNumber(preview.successCount)} registro(s) prontos.
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap gap-3 text-xs">
        <span className="text-fg-muted">
          Ok <strong className="text-fg-strong">{formatNumber(preview.successCount)}</strong>
        </span>
        <span className="text-fg-muted">
          Alertas <strong className="text-fg-strong">{formatNumber(preview.skippedCount)}</strong>
        </span>
        <span className={preview.errorCount > 0 ? 'text-danger' : 'text-fg-muted'}>
          Erros <strong>{formatNumber(preview.errorCount)}</strong>
        </span>
      </div>

      <div className="flex w-full shrink-0 rounded-md border border-line p-0.5">
        <Button
          type="button"
          size="sm"
          variant={activeTab === 'errors' ? 'secondary' : 'ghost'}
          className="h-8 flex-1"
          disabled={!hasErrors}
          onClick={() => onTabChange('errors')}
        >
          Erros ({formatNumber(errors.length)})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={activeTab === 'alerts' ? 'secondary' : 'ghost'}
          className="h-8 flex-1"
          disabled={!hasAlerts}
          onClick={() => onTabChange('alerts')}
        >
          Alertas ({formatNumber(alerts.length)})
        </Button>
      </div>

      <div className="min-h-0 max-h-[min(40vh,14rem)] flex-1 space-y-1 overflow-y-auto rounded-md border border-line p-2 text-xs">
        {pageItems.map((item) => (
          <p
            key={item.key}
            className={item.tone === 'danger' ? 'text-danger' : 'text-fg-muted'}
          >
            {item.text}
          </p>
        ))}
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 bg-surface pt-1">
        <p className="text-center text-[11px] text-fg-subtle">
          {formatNumber(from)}–{formatNumber(to)} de {formatNumber(total)} · {PREVIEW_PAGE_SIZE} por
          página
        </p>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 min-w-[6.5rem] flex-1 sm:flex-none"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="shrink-0 px-1 text-sm font-medium tabular-nums text-fg-strong">
            {safePage}/{pages}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 min-w-[6.5rem] flex-1 sm:flex-none"
            disabled={safePage >= pages}
            onClick={() => onPageChange(safePage + 1)}
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
