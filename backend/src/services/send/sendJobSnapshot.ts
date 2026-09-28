import {
  MAX_SNAPSHOT_SKIPPED,
  MAX_STORED_ERRORS,
  type SendJobInternal,
  type SendJobSnapshot,
} from './sendJobTypes.js'

export function toSnapshot(job: SendJobInternal): SendJobSnapshot {
  const now = Date.now()
  const started = job.startedAt ?? now
  const ended = job.finishedAt ?? now
  const elapsedMs = Math.max(0, ended - started)
  const productsPerSecond =
    elapsedMs > 0 ? Number(((job.processed * 1000) / elapsedMs).toFixed(1)) : 0

  const auxHandled = job.auxInserted + job.auxFailed + job.auxSkipped
  const auxTotal = job.auxiliaries.length
  const productTotal = job.rows.length

  let percent = 100
  if (job.phase === 'auxiliaries' && auxTotal > 0) {
    // Auxiliares ocupam até 8% do progresso geral (fase longa de catálogo/insert).
    percent = Math.min(8, Math.round((auxHandled / auxTotal) * 8))
  } else if (job.phase === 'catalogs') {
    percent = 10
  } else if (productTotal === 0) {
    percent = 100
  } else {
    // Produtos: 10% → 100%
    percent = 10 + Math.round((job.processed / productTotal) * 90)
  }
  if (job.status === 'completed') percent = 100

  return {
    id: job.id,
    status: job.status,
    mode: job.mode,
    phase: job.phase,
    tmsBaseUrl: job.tmsBaseUrl,
    idFilial: job.idFilial,
    batchSize: job.batchSize,
    concurrency: job.concurrency,
    total: job.rows.length,
    processed: job.processed,
    successCount: job.successCount,
    errorCount: job.errorCount,
    productSkipped: job.skipped.length,
    currentBatch: job.currentBatch,
    totalBatches: job.totalBatches,
    errors: job.errors.slice(0, MAX_STORED_ERRORS),
    errorsTruncated: job.errors.length > MAX_STORED_ERRORS,
    skipped: job.skipped.slice(0, MAX_SNAPSHOT_SKIPPED),
    skippedTruncated: job.skipped.length > MAX_SNAPSHOT_SKIPPED,
    startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
    elapsedMs,
    productsPerSecond,
    percent: Math.min(100, Math.max(0, percent)),
    remaining: Math.max(0, job.rows.length - job.processed),
    gruposTotal: job.auxiliaries.filter((a) => a.entity === 'grupo').length,
    gruposInserted: job.auxInserted,
    gruposFailed: job.auxFailed,
    auxTotal: job.auxiliaries.length,
    auxInserted: job.auxInserted,
    auxFailed: job.auxFailed,
    auxSkipped: job.auxSkipped,
  }
}
