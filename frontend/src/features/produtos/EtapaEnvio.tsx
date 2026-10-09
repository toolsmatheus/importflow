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
  Square,
  SkipForward,
  XCircle,
} from 'lucide-react'
import { PainelChecagensInconsistencia } from '@/features/produtos/PainelChecagensInconsistencia'
import {
  SoftExpand,
  formatDuration,
  phaseLabel,
  skipReasonLabel,
} from '@/features/produtos/EtapaEnvioHelpers'
import {
  baixarRelatorioAlertasPdf,
  podeGerarRelatorioAlertasPdf,
} from '@/features/produtos/relatorioAlertasPdf'
import { produtoServico } from '@/api/produto'
import { formatNumber } from '@/lib/utils'
import type {
  AuxiliaryEntity,
  ProductValidationResult,
  EnvioJobSnapshot,
} from '@/types'
import { Button, Badge, Card, Input, Progress, GridTh, GridCell } from '@/components'

/** Defaults alinhados ao backend — não expostos na UI. */
const SEND_BATCH_SIZE = 500
const SEND_CONCURRENCY = 1

interface EtapaEnvioProps {
  rows: Record<string, string>[]
  onRowsChange?: (rows: Record<string, string>[]) => void
  tmsBaseUrl: string
  onTmsBaseUrlChange: (url: string) => void
  job: EnvioJobSnapshot | null
  onJobChange: (job: EnvioJobSnapshot | null) => void
  onBack: () => void
  onFinish: () => void
  auxiliary?: Partial<Record<AuxiliaryEntity, string>>
  validationResult?: ProductValidationResult | null
}

export function EtapaEnvio({
  rows,
  tmsBaseUrl,
  onTmsBaseUrlChange,
  job,
  onJobChange,
  onBack,
  onFinish,
  auxiliary,
  validationResult,
}: EtapaEnvioProps) {
  const [idFilialPreview, setIdFilialPreview] = useState<number | null>(null)
  const [versaoPreview, setVersaoPreview] = useState<string | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const active =
    job?.status === 'running' || job?.status === 'queued' || job?.status === 'paused'

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
  const skippedDueToErrors = Boolean(
    validationResult &&
      (validationResult.errorCount ?? 0) > 0 &&
      (validationResult.errorRows?.length ??
        validationResult.issues.filter((i) => i.severity === 'error' && i.row > 0)
          .length) > 0 &&
      typeof fileTotal === 'number' &&
      fileTotal > rows.length
  )
  const rowsMismatch =
    typeof fileTotal === 'number' &&
    fileTotal > 0 &&
    fileTotal !== rows.length &&
    !skippedDueToErrors

  useEffect(() => {
    if (!job || !['running', 'queued', 'paused'].includes(job.status)) return

    const timer = setInterval(async () => {
      try {
        const next = await produtoServico.getEnvioJob(job.id)
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
    mutationFn: () => produtoServico.identifyServer(tmsBaseUrl),
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
      produtoServico.startSend({
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
      if (action === 'pause') return produtoServico.pauseSend(job.id)
      if (action === 'resume') return produtoServico.resumeSend(job.id)
      if (action === 'cancel') return produtoServico.cancelSend(job.id)
      return produtoServico.retryFailedSend(job.id)
    },
    onSuccess: (snapshot) => onJobChange(snapshot),
    onError: (error: Error) => toast.error(error.message || 'Falha no controle do envio'),
  })

  const finished =
    job &&
    (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')

  const progressCard = job ? (
    <Card variant="panel" ref={progressRef} className="border-action/30 bg-action/5">
      <div className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-fg-strong text-base">Progresso do envio</h2>
            <p className="text-sm text-fg-muted mt-1 text-base font-medium text-fg-strong">
              {phaseLabel(job)}
            </p>
          </div>
          <Badge variant="neutral" className="px-3 py-1 text-lg font-semibold tabular-nums">
            {job.percent}%
          </Badge>
        </div>
      </div>
      <div className="space-y-4">
        <Progress value={job.percent} className="h-4" />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
          <div className="rounded-lg bg-surface-muted/80 p-3 shadow-sm">
            <p className="text-xs text-fg-muted">Processados</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatNumber(job.processed)} / {formatNumber(job.total)}
            </p>
          </div>
          <div className="rounded-lg bg-surface-muted/80 p-3 shadow-sm">
            <p className="text-xs text-fg-muted">Sucesso</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatNumber(job.successCount)}
            </p>
          </div>
          <div className="rounded-lg bg-surface-muted/80 p-3 shadow-sm">
            <p className="text-xs text-fg-muted">Ignorados</p>
            <p className="text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-300">
              {formatNumber(job.productSkipped ?? 0)}
            </p>
          </div>
          <div className="rounded-lg bg-surface-muted/80 p-3 shadow-sm">
            <p className="text-xs text-fg-muted">Falhas</p>
            <p className="text-lg font-semibold tabular-nums text-danger">
              {formatNumber(job.errorCount)}
            </p>
          </div>
          <div className="rounded-lg bg-surface-muted/80 p-3 shadow-sm">
            <p className="text-xs text-fg-muted">Velocidade</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatNumber(job.productsPerSecond)} /s · {formatDuration(job.elapsedMs)}
            </p>
          </div>
        </div>

        {typeof job.auxTotal === 'number' && job.auxTotal > 0 && (
          <p className="text-sm text-fg-muted">
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
              variant="secondary"
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
              variant="secondary"
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
              variant="secondary"
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
              variant="secondary"
              onClick={() => produtoServico.downloadSkippedProducts(job.id)}
            >
              <Download className="h-4 w-4" />
              Baixar ignorados CSV
            </Button>
          ) : null}
          {finished && podeGerarRelatorioAlertasPdf({ job, validationResult }) ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                try {
                  baixarRelatorioAlertasPdf({
                    job,
                    validationResult,
                    rows,
                  })
                  toast.success('Relatório PDF baixado')
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : 'Falha ao gerar o PDF'
                  )
                }
              }}
            >
              <Download className="h-4 w-4" />
              Baixar PDF (validações)
            </Button>
          ) : null}
          {finished ? (
            <Button size="sm" variant="ghost" onClick={() => onJobChange(null)}>
              Novo envio
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral" className="gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {formatNumber(job.successCount)} ok
          </Badge>
          <Badge
            variant={(job.productSkipped ?? 0) > 0 ? 'neutral' : 'neutral'}
            className="gap-1"
          >
            <SkipForward className="h-3.5 w-3.5" />
            {formatNumber(job.productSkipped ?? 0)} ignorado(s)
          </Badge>
          <Badge variant={job.errorCount > 0 ? 'negative' : 'neutral'} className="gap-1">
            <XCircle className="h-3.5 w-3.5" />
            {formatNumber(job.errorCount)} falha(s)
          </Badge>
          <Badge variant="neutral">
            Filial {job.idFilial} · {job.status}
          </Badge>
        </div>

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
                  produtoServico.downloadSkippedProducts(job.id)
                }}
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            }
          >
            <div className="space-y-2">
              <p className="text-xs text-fg-muted">
                Já existiam no banco (código de barras ou codigo_migracao). Não foram
                reenviados.
                {job.skippedTruncated ? ' Lista parcial — use o CSV completo.' : ''}
              </p>
              <div className="max-h-64 overflow-auto rounded-md border">
                <table className="w-full border-collapse font-data text-sm">
                  <thead>
                    <tr>
                      <GridTh className="w-16">Linha</GridTh>
                      <GridTh>Produto</GridTh>
                      <GridTh className="min-w-[120px]">Cód. barras</GridTh>
                      <GridTh className="w-28">Código</GridTh>
                      <GridTh>Motivo</GridTh>
                      <GridTh className="w-24">Id banco</GridTh>
                    </tr>
                  </thead>
                  <tbody>
                    {job.skipped!.map((skip) => (
                      <tr key={`skip-${skip.index}-${skip.reason}`}>
                        <GridCell className="font-mono text-xs">{skip.index + 2}</GridCell>
                        <GridCell className="max-w-[200px] truncate" title={skip.nome}>
                          {skip.nome || '—'}
                        </GridCell>
                        <GridCell className="font-mono text-xs">
                          {skip.codigobarras || '—'}
                        </GridCell>
                        <GridCell className="font-mono text-xs">{skip.codigo || '—'}</GridCell>
                        <GridCell>
                          <span className="text-sm">{skipReasonLabel(skip.reason)}</span>
                          {skip.message ? (
                            <span className="mt-0.5 block text-xs text-fg-muted">
                              {skip.message}
                            </span>
                          ) : null}
                        </GridCell>
                        <GridCell className="font-mono text-xs">
                          {skip.tmsProdutoId ?? '—'}
                        </GridCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </SoftExpand>
        )}

        {dcbWarnings.length > 0 && (
          <SoftExpand label="Avisos de DCB" count={dcbWarnings.length} tone="warning">
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-fg-muted">
                O nome do DCB no auxiliar não bateu com a lista Anvisa (ou o código Anvisa
                não existe no banco). O produto <strong className="text-fg-strong">foi
                gravado normalmente</strong>, só sem vínculo de DCB. Não bloqueia o envio;
                em controlados o SNGPC pode ficar sem DCB até corrigir o cadastro.
              </p>
              <div className="max-h-56 overflow-auto rounded-md border">
                <table className="w-full border-collapse font-data text-sm">
                  <thead>
                    <tr>
                      <GridTh className="w-16">Linha</GridTh>
                      <GridTh className="w-28">Código</GridTh>
                      <GridTh>Aviso</GridTh>
                    </tr>
                  </thead>
                  <tbody>
                    {dcbWarnings.map((err) => (
                      <tr key={`dcb-${err.index}-${err.batch}-${err.codigo}`}>
                        <GridCell className="font-mono text-xs">
                          {err.index >= 0 ? err.index + 2 : '—'}
                        </GridCell>
                        <GridCell className="font-mono text-xs">{err.codigo || '—'}</GridCell>
                        <GridCell className="text-sm text-amber-800 dark:text-amber-200">
                          {err.message.replace(/^Aviso:\s*/i, '')}
                        </GridCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </SoftExpand>
        )}

        {realErrors.length > 0 && (
          <SoftExpand label="Falhas de inserção" count={realErrors.length} tone="error">
            <div className="max-h-56 overflow-auto rounded-md border">
              <table className="w-full border-collapse font-data text-sm">
                <thead>
                  <tr>
                    <GridTh className="w-16">Linha</GridTh>
                    <GridTh className="w-16">Lote</GridTh>
                    <GridTh className="w-28">Código</GridTh>
                    <GridTh>Mensagem</GridTh>
                  </tr>
                </thead>
                <tbody>
                  {realErrors.map((err) => (
                    <tr key={`${err.index}-${err.batch}-${err.codigo}`}>
                      <GridCell className="font-mono text-xs">
                        {err.index >= 0 ? err.index + 2 : '—'}
                      </GridCell>
                      <GridCell>{err.batch}</GridCell>
                      <GridCell className="font-mono text-xs">{err.codigo || '—'}</GridCell>
                      <GridCell className="text-sm text-danger">{err.message}</GridCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SoftExpand>
        )}
      </div>
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
          <p className="text-sm text-fg-muted">
            Envia {formatNumber(rows.length)} produto(s) validado(s). Auxiliares são
            inseridos primeiro.
          </p>

          {skippedDueToErrors && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                Modo parcial: {formatNumber(rows.length)} produto(s) sem erro serão
                enviados; {formatNumber(fileTotal! - rows.length)} com erro de
                validação ficaram de fora.
              </p>
            )}

          {rowsMismatch && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              Atenção: o arquivo tem {formatNumber(fileTotal!)} registro(s), mas só{' '}
              {formatNumber(rows.length)} estão carregados para envio. Revalide o arquivo
              após atualizar o sistema.
            </p>
          )}

          <div>
            <label htmlFor="send-server-url" className="mb-1.5 block text-sm text-fg-muted">
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
            <p className="text-sm text-fg-muted">
              Auxiliares no envio:{' '}
              <span className="font-mono text-fg-strong">
                {Object.keys(auxiliary).join(', ')}
              </span>
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
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
            <p className="text-sm text-fg-muted">
              Filial detectada:{' '}
              <span className="font-mono text-fg-strong">{idFilialPreview}</span>
              {versaoPreview ? (
                <>
                  {' '}
                  · versão <span className="font-mono text-fg-strong">{versaoPreview}</span>
                </>
              ) : null}
            </p>
          )}
        </div>
      </SoftExpand>

      {(validationResult?.checkSummary?.length ?? 0) > 0 && !active && !job && (
        <SoftExpand label="Checagens da validação">
          <PainelChecagensInconsistencia
            checks={validationResult!.checkSummary!}
            issues={validationResult?.issues}
            truncated={validationResult?.truncated}
            embedded
            defaultExpandWithIssues={false}
          />
        </SoftExpand>
      )}

      <div className="flex justify-between pt-1">
        <Button variant="secondary" onClick={onBack} disabled={Boolean(active)}>
          Voltar
        </Button>
        <Button onClick={onFinish} disabled={!finished || job?.status === 'cancelled'}>
          Concluir
        </Button>
      </div>
    </div>
  )
}
