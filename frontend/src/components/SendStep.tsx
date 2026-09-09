import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Download,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Server,
  Sparkles,
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
import { formatNumber } from '@/lib/utils'
import type {
  AuxiliaryEntity,
  ProductValidationResult,
  SendJobSnapshot,
  SendMode,
} from '@/types'

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
  const [batchSize, setBatchSize] = useState(500)
  const [concurrency, setConcurrency] = useState(1)
  const progressRef = useRef<HTMLDivElement>(null)

  const active =
    job?.status === 'running' || job?.status === 'queued' || job?.status === 'paused'

  const sendChecks = useMemo(
    () => (job ? buildSendCheckSummary(job) : []),
    [job]
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
    mutationFn: (payload: { mode: SendMode; rows: Record<string, string>[] }) =>
      productService.startSend({
        rows: payload.rows,
        mode: payload.mode,
        tmsBaseUrl,
        batchSize,
        concurrency,
        auxiliary,
      }),
    onSuccess: (snapshot) => {
      onJobChange(snapshot)
      toast.success(
        snapshot.mode === 'simulate'
          ? `Simulação iniciada — ${formatNumber(snapshot.total)} produto(s)`
          : `Envio iniciado — ${formatNumber(snapshot.total)} produto(s)`
      )
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

  const requestStart = (mode: SendMode) => {
    startMutation.mutate({ mode, rows })
  }

  const finished =
    job &&
    (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')

  const progressCard = job ? (
    <Card ref={progressRef} className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              Progresso {job.mode === 'simulate' ? '(simulação)' : '(envio ao vivo)'}
            </CardTitle>
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
          <InconsistencyChecksPanel
            checks={sendChecks}
            title="Checagens do envio ao banco"
            description="O que o envio pesquisou no destino — duplicados, avisos e falhas — mesmo quando o resultado é nenhum."
          />
        )}

        {job.mode === 'simulate' && finished && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Simulação concluída. Nenhum dado foi enviado ao banco.
          </p>
        )}

        {(job.skipped?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Produtos ignorados (código de barras ou codigo_migracao já existentes)
              {job.skippedTruncated ? ' — lista parcial; use o CSV completo.' : ''}:
            </p>
            <div className="max-h-48 overflow-auto rounded-md border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Id destino</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {job.skipped!.map((skip) => (
                    <TableRow key={`skip-${skip.index}-${skip.reason}`}>
                      <TableCell>{skip.index + 2}</TableCell>
                      <TableCell className="font-mono">{skip.codigo || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{skip.reason}</TableCell>
                      <TableCell className="font-mono">
                        {skip.tmsProdutoId ?? '-'}
                      </TableCell>
                      <TableCell>{skip.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {job.errors.length > 0 && (
          <div className="max-h-56 overflow-auto rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.errors.map((err) => (
                  <TableRow key={`${err.index}-${err.batch}-${err.codigo}`}>
                    <TableCell>{err.index >= 0 ? err.index + 2 : '-'}</TableCell>
                    <TableCell>{err.batch}</TableCell>
                    <TableCell className="font-mono">{err.codigo || '-'}</TableCell>
                    <TableCell className="text-destructive">{err.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  ) : null

  return (
    <div className="space-y-6">
      {progressCard}

      <Card>
        <CardHeader>
          <CardTitle>Envio em lotes</CardTitle>
          <CardDescription>
            Envia todos os produtos validados ({formatNumber(rows.length)} no momento). No
            envio ao vivo, os auxiliares (grupo, subgrupo, categoria, laboratório, grupo de
            preço, similar e DCB) são inseridos primeiro; a descrição vai em maiúsculas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="batch-size" className="mb-1.5 block text-sm text-muted-foreground">
                Produtos por lote (ImportarListaProdutos)
              </label>
              <Input
                id="batch-size"
                type="number"
                min={10}
                max={1000}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value) || 500)}
                disabled={Boolean(active)}
              />
            </div>
            <div>
              <label htmlFor="concurrency" className="mb-1.5 block text-sm text-muted-foreground">
                Lotes em paralelo
              </label>
              <Input
                id="concurrency"
                type="number"
                min={1}
                max={8}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value) || 1)}
                disabled={Boolean(active)}
              />
            </div>
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
              onClick={() => requestStart('live')}
              disabled={startMutation.isPending || rows.length === 0 || Boolean(active)}
            >
              {startMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar {formatNumber(rows.length)} produto(s)
            </Button>
            <Button
              variant="secondary"
              onClick={() => requestStart('simulate')}
              disabled={startMutation.isPending || rows.length === 0 || Boolean(active)}
            >
              <Sparkles className="h-4 w-4" />
              Simular lotes
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
        </CardContent>
      </Card>

      {(validationResult?.checkSummary?.length ?? 0) > 0 && !active && (
        <InconsistencyChecksPanel
          checks={validationResult!.checkSummary!}
          issues={validationResult?.issues}
          title="Checagens da validação (antes do envio)"
          description="O que foi pesquisado no CSV — ex.: códigos de barras inválidos ficam explícitos mesmo quando o resultado é nenhum."
          truncated={validationResult?.truncated}
        />
      )}

      <div className="flex justify-between">
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
