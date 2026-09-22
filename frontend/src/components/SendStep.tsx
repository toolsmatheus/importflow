import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CheckCircle2,
  ChevronDown,
  Download,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Server,
  Square,
  SkipForward,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  buildSendCheckSummary,
  InconsistencyChecksPanel,
} from '@/components/InconsistencyChecksPanel'
import { productService } from '@/services/productService'
import { cn, formatNumber } from '@/lib/utils'
import type {
  AuxiliaryEntity,
  ProductValidationResult,
  SendJobSnapshot,
} from '@/types'

/** Defaults alinhados ao backend — não expostos na UI. */
const SEND_BATCH_SIZE = 500
const SEND_CONCURRENCY = 1

interface SendStepProps {
  rows: Record<string, string>[]
  onRowsChange?: (rows: Record<string, string>[]) => void
  tmsBaseUrl: string
  onTmsBaseUrlChange: (url: string) => void
  job: SendJobSnapshot | null
  onJobChange: (job: SendJobSnapshot | null) => void
  onBack: () => void
  onFinish: () => void
  auxiliary?: Partial<Record<AuxiliaryEntity, string>>
  validationResult?: ProductValidationResult | null
}

function SoftExpand({
  label,
  count,
  tone = 'neutral',
  children,
  defaultOpen = false,
  actions,
}: {
  label: string
  count?: number
  tone?: 'neutral' | 'warning' | 'error' | 'success'
  children: ReactNode
  defaultOpen?: boolean
  actions?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background/60">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              !open && '-rotate-90'
            )}
          />
          <span className="font-medium text-foreground">{label}</span>
          {count !== undefined ? (
            <span
              className={cn(
                'tabular-nums text-muted-foreground',
                tone === 'warning' && count > 0 && 'text-amber-700 dark:text-amber-300',
                tone === 'error' && count > 0 && 'text-destructive',
                tone === 'success' && 'text-emerald-700 dark:text-emerald-300'
              )}
            >
              {formatNumber(count)}
            </span>
          ) : null}
        </button>
        {actions}
      </div>
      {open ? <div className="border-t border-border px-3 py-3">{children}</div> : null}
    </div>
  )
}

function skipReasonLabel(reason: string): string {
  if (reason === 'codigo_barras') return 'Código de barras já existe'
  if (reason === 'codigo_migracao') return 'Código de migração já existe'
  return reason
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function phaseLabel(job: SendJobSnapshot): string {
  switch (job.phase) {
    case 'auxiliaries': {
      const done = (job.auxInserted ?? 0) + (job.auxFailed ?? 0) + (job.auxSkipped ?? 0)
      const total = job.auxTotal ?? 0
      return `Inserindo auxiliares (${formatNumber(done)}/${formatNumber(total)})…`
    }
    case 'catalogs':
      return 'Carregando catálogos do banco…'
    case 'products':
      return `Enviando produtos — lote ${job.currentBatch}/${job.totalBatches}`
    case 'done':
      return job.status === 'completed'
        ? 'Concluído'
        : job.status === 'cancelled'
          ? 'Cancelado'
          : job.status === 'failed'
            ? 'Falhou'
            : 'Finalizado'
    default:
      if (job.status === 'paused') return 'Pausado'
      if (job.status === 'queued') return 'Na fila…'
      return `Status: ${job.status}`
  }
}

export function SendStep({
  rows,
  tmsBaseUrl,
  onTmsBaseUrlChange,
  job,
  onJobChange,
  onBack,
  onFinish,
  auxiliary,
  validationResult,
}: SendStepProps) {
  const [idFilialPreview, setIdFilialPreview] = useState<number | null>(null)
  const [versaoPreview, setVersaoPreview] = useState<string | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const active =
    job?.status === 'running' || job?.status === 'queued' || job?.status === 'paused'

  const sendChecks = useMemo(
    () => (job ? buildSendCheckSummary(job) : []),
    [job]
  )

  const dcbWarnings = useMemo(
    () =>
      (job?.errors ?? []).filter((e) =>
        e.message.trim().toLowerCase().startsWith('aviso:')
      ),
    [job?.errors]
  )

  const realErrors = useMemo(
    () =>
      (job?.errors ?? []).filter(
        (e) => !e.message.trim().toLowerCase().startsWith('aviso:')
      ),
    [job?.errors]
  )

  const fileTotal = validationResult?.totalRecords
  const rowsMismatch =
    typeof fileTotal === 'number' && fileTotal > 0 && fileTotal !== rows.length

  useEffect(() => {
    if (!job || !['running', 'queued', 'paused'].includes(job.status)) return

    const timer = setInterval(async () => {
      try {
        const next = await productService.getSendJob(job.id)
        onJobChange(next)
      } catch {
        /* ignore transient poll errors */
      }
    }, 500)

    return () => clearInterval(timer)
  }, [job?.id, job?.status, onJobChange])

  useEffect(() => {
    if (!job) return
    progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [job?.id])

  const identifyMutation = useMutation({
    mutationFn: () => productService.identifyServer(tmsBaseUrl),
    onSuccess: (data) => {
      setIdFilialPreview(data.idFilial)
      setVersaoPreview(data.versao ?? null)
      toast.success(
        data.versao
          ? `Banco ok. Filial ${data.idFilial}, versão ${data.versao}`
          : `Banco ok. Filial ${data.idFilial}`
      )
    },
    onError: (error: Error) => toast.error(error.message || 'Banco de dados indisponível'),
  })

  const startMutation = useMutation({
    mutationFn: () =>
      productService.startSend({
        rows,
        mode: 'live',
        tmsBaseUrl,
        batchSize: SEND_BATCH_SIZE,
        concurrency: SEND_CONCURRENCY,
        auxiliary,
      }),
    onSuccess: (snapshot) => {
      onJobChange(snapshot)
      toast.success(`Envio iniciado — ${formatNumber(snapshot.total)} produto(s)`)
    },
    onError: (error: Error) => toast.error(error.message || 'Falha ao iniciar'),
  })

  const controlMutation = useMutation({
    mutationFn: async (action: 'pause' | 'resume' | 'cancel' | 'retry') => {
      if (!job) throw new Error('Nenhum job ativo')
      if (action === 'pause') return productService.pauseSend(job.id)
      if (action === 'resume') return productService.resumeSend(job.id)
      if (action === 'cancel') return productService.cancelSend(job.id)
      return productService.retryFailedSend(job.id)
    },
    onSuccess: (snapshot) => onJobChange(snapshot),
    onError: (error: Error) => toast.error(error.message || 'Falha no controle do envio'),
  })

  const finished =
    job &&
    (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')

  const progressCard = job ? (
    <Card ref={progressRef} className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Progresso do envio</CardTitle>
            <CardDescription className="mt-1 text-base font-medium text-foreground">
              {phaseLabel(job)}
            </CardDescription>
          </div>
          <Badge variant="outline" className="px-3 py-1 text-lg font-semibold tabular-nums">
            {job.percent}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={job.percent} className="h-4" />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
          <div className="rounded-lg bg-background/80 p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Processados</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatNumber(job.processed)} / {formatNumber(job.total)}
            </p>
          </div>
          <div className="rounded-lg bg-background/80 p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Sucesso</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatNumber(job.successCount)}
            </p>
          </div>
          <div className="rounded-lg bg-background/80 p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Ignorados</p>
            <p className="text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-300">
              {formatNumber(job.productSkipped ?? 0)}
            </p>
          </div>
          <div className="rounded-lg bg-background/80 p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Falhas</p>
            <p className="text-lg font-semibold tabular-nums text-destructive">
              {formatNumber(job.errorCount)}
            </p>
          </div>
          <div className="rounded-lg bg-background/80 p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Velocidade</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatNumber(job.productsPerSecond)} /s · {formatDuration(job.elapsedMs)}
            </p>
          </div>
        </div>

        {typeof job.auxTotal === 'number' && job.auxTotal > 0 && (
          <p className="text-sm text-muted-foreground">
            Auxiliares: {formatNumber(job.auxInserted ?? 0)} inseridos
            {job.auxSkipped ? ` · ${formatNumber(job.auxSkipped)} já existentes` : ''}
            {job.auxFailed ? ` · ${formatNumber(job.auxFailed)} falha(s)` : ''}
            {' · '}
            total {formatNumber(job.auxTotal)}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {job.status === 'running' || job.status === 'queued' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => controlMutation.mutate('pause')}
              disabled={controlMutation.isPending}
            >
              <Pause className="h-4 w-4" />
              Pausar
            </Button>
          ) : null}
          {job.status === 'paused' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => controlMutation.mutate('resume')}
              disabled={controlMutation.isPending}
            >
              <Play className="h-4 w-4" />
              Continuar
            </Button>
          ) : null}
          {active ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => controlMutation.mutate('cancel')}
              disabled={controlMutation.isPending}
            >
              <Square className="h-4 w-4" />
              Cancelar
            </Button>
          ) : null}
          {finished && job.errorCount > 0 ? (
            <Button
              size="sm"
              onClick={() => controlMutation.mutate('retry')}
              disabled={controlMutation.isPending}
            >
              <RotateCcw className="h-4 w-4" />
              Reenviar falhas
            </Button>
          ) : null}
          {(job.productSkipped ?? 0) > 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => productService.downloadSkippedProducts(job.id)}
            >
              <Download className="h-4 w-4" />
              Baixar ignorados CSV
            </Button>
          ) : null}
          {finished ? (
            <Button size="sm" variant="ghost" onClick={() => onJobChange(null)}>
              Novo envio
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {formatNumber(job.successCount)} ok
          </Badge>
          <Badge
            variant={(job.productSkipped ?? 0) > 0 ? 'outline' : 'secondary'}
            className="gap-1"
          >
            <SkipForward className="h-3.5 w-3.5" />
            {formatNumber(job.productSkipped ?? 0)} ignorado(s)
          </Badge>
          <Badge variant={job.errorCount > 0 ? 'destructive' : 'secondary'} className="gap-1">
            <XCircle className="h-3.5 w-3.5" />
            {formatNumber(job.errorCount)} falha(s)
          </Badge>
          <Badge variant="outline">
            Filial {job.idFilial} · {job.status}
          </Badge>
        </div>

        {job.processed > 0 && (
          <SoftExpand label="Checagens do envio">
            <InconsistencyChecksPanel
              checks={sendChecks}
              embedded
              defaultExpandWithIssues={false}
            />
          </SoftExpand>
        )}

        {(job.skipped?.length ?? 0) > 0 && (
          <SoftExpand
            label="Produtos ignorados"
            count={job.productSkipped ?? job.skipped!.length}
            tone="warning"
            actions={
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  productService.downloadSkippedProducts(job.id)
                }}
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            }
          >
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Já existiam no banco (código de barras ou codigo_migracao). Não foram
                reenviados.
                {job.skippedTruncated ? ' Lista parcial — use o CSV completo.' : ''}
              </p>
              <div className="max-h-64 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Linha</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="min-w-[120px]">Cód. barras</TableHead>
                      <TableHead className="w-28">Código</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="w-24">Id banco</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {job.skipped!.map((skip) => (
                      <TableRow key={`skip-${skip.index}-${skip.reason}`}>
                        <TableCell className="font-mono text-xs">{skip.index + 2}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={skip.nome}>
                          {skip.nome || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {skip.codigobarras || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{skip.codigo || '—'}</TableCell>
                        <TableCell>
                          <span className="text-sm">{skipReasonLabel(skip.reason)}</span>
                          {skip.message ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {skip.message}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {skip.tmsProdutoId ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </SoftExpand>
        )}

        {dcbWarnings.length > 0 && (
          <SoftExpand label="Avisos de DCB" count={dcbWarnings.length} tone="warning">
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                O nome do DCB no auxiliar não bateu com a lista Anvisa (ou o código Anvisa
                não existe no banco). O produto <strong className="text-foreground">foi
                gravado normalmente</strong>, só sem vínculo de DCB. Não bloqueia o envio;
                em controlados o SNGPC pode ficar sem DCB até corrigir o cadastro.
              </p>
              <div className="max-h-56 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Linha</TableHead>
                      <TableHead className="w-28">Código</TableHead>
                      <TableHead>Aviso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dcbWarnings.map((err) => (
                      <TableRow key={`dcb-${err.index}-${err.batch}-${err.codigo}`}>
                        <TableCell className="font-mono text-xs">
                          {err.index >= 0 ? err.index + 2 : '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{err.codigo || '—'}</TableCell>
                        <TableCell className="text-sm text-amber-800 dark:text-amber-200">
                          {err.message.replace(/^Aviso:\s*/i, '')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </SoftExpand>
        )}

        {realErrors.length > 0 && (
          <SoftExpand label="Falhas de inserção" count={realErrors.length} tone="error">
            <div className="max-h-56 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Linha</TableHead>
                    <TableHead className="w-16">Lote</TableHead>
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {realErrors.map((err) => (
                    <TableRow key={`${err.index}-${err.batch}-${err.codigo}`}>
                      <TableCell className="font-mono text-xs">
                        {err.index >= 0 ? err.index + 2 : '—'}
                      </TableCell>
                      <TableCell>{err.batch}</TableCell>
                      <TableCell className="font-mono text-xs">{err.codigo || '—'}</TableCell>
                      <TableCell className="text-sm text-destructive">{err.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SoftExpand>
        )}
      </CardContent>
    </Card>
  ) : null

  return (
    <div className="space-y-4">
      {progressCard}

      <SoftExpand
        label="Configuração do envio"
        defaultOpen={!job}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envia {formatNumber(rows.length)} produto(s) validado(s). Auxiliares são
            inseridos primeiro.
          </p>

          {rowsMismatch && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              Atenção: o arquivo tem {formatNumber(fileTotal!)} registro(s), mas só{' '}
              {formatNumber(rows.length)} estão carregados para envio. Revalide o arquivo
              após atualizar o sistema.
            </p>
          )}

          <div>
            <label htmlFor="send-server-url" className="mb-1.5 block text-sm text-muted-foreground">
              URL do banco de dados
            </label>
            <Input
              id="send-server-url"
              value={tmsBaseUrl}
              onChange={(e) => onTmsBaseUrlChange(e.target.value)}
              placeholder="http://localhost:2001"
              disabled={Boolean(active)}
            />
          </div>

          {auxiliary && Object.keys(auxiliary).length > 0 && (
            <p className="text-sm text-muted-foreground">
              Auxiliares no envio:{' '}
              <span className="font-mono text-foreground">
                {Object.keys(auxiliary).join(', ')}
              </span>
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => identifyMutation.mutate()}
              disabled={identifyMutation.isPending || !tmsBaseUrl || Boolean(active)}
            >
              {identifyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Server className="h-4 w-4" />
              )}
              Testar conexão
            </Button>
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending || rows.length === 0 || Boolean(active)}
            >
              {startMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar {formatNumber(rows.length)} produto(s)
            </Button>
          </div>

          {idFilialPreview !== null && (
            <p className="text-sm text-muted-foreground">
              Filial detectada:{' '}
              <span className="font-mono text-foreground">{idFilialPreview}</span>
              {versaoPreview ? (
                <>
                  {' '}
                  · versão <span className="font-mono text-foreground">{versaoPreview}</span>
                </>
              ) : null}
            </p>
          )}
        </div>
      </SoftExpand>

      {(validationResult?.checkSummary?.length ?? 0) > 0 && !active && !job && (
        <SoftExpand label="Checagens da validação">
          <InconsistencyChecksPanel
            checks={validationResult!.checkSummary!}
            issues={validationResult?.issues}
            truncated={validationResult?.truncated}
            embedded
            defaultExpandWithIssues={false}
          />
        </SoftExpand>
      )}

      <div className="flex justify-between pt-1">
        <Button variant="outline" onClick={onBack} disabled={Boolean(active)}>
          Voltar
        </Button>
        <Button onClick={onFinish} disabled={!finished || job?.status === 'cancelled'}>
          Concluir
        </Button>
      </div>
    </div>
  )
}
