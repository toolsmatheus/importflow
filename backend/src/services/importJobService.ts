import { randomUUID } from 'crypto'
import type {
  ImportErrorRow,
  ImportMode,
  ImportProgressPayload,
  ImportResultPayload,
} from '../schemas/import.schema.js'

/** Erros mantidos por job; acima disso apenas contamos, para não crescer sem limite. */
const MAX_STORED_ERRORS = 1000
const JOB_TTL_MS = 60 * 60 * 1000

export interface ImportJob {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  table: string
  mode: ImportMode
  total: number
  processed: number
  inserted: number
  updated: number
  skipped: number
  errorCount: number
  errors: ImportErrorRow[]
  message?: string
  startedAt: number
  finishedAt?: number
}

const jobs = new Map<string, ImportJob>()

function cleanupExpiredJobs(): void {
  const now = Date.now()
  for (const [id, job] of jobs) {
    const reference = job.finishedAt ?? job.startedAt
    if (now - reference > JOB_TTL_MS) {
      jobs.delete(id)
    }
  }
}

export function createJob(table: string, mode: ImportMode, total: number): ImportJob {
  cleanupExpiredJobs()

  const job: ImportJob = {
    id: randomUUID(),
    status: 'pending',
    table,
    mode,
    total,
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errorCount: 0,
    errors: [],
    startedAt: Date.now(),
  }

  jobs.set(job.id, job)
  return job
}

export function getJob(id: string): ImportJob | undefined {
  return jobs.get(id)
}

export function addJobError(job: ImportJob, error: ImportErrorRow): void {
  job.errorCount++
  if (job.errors.length < MAX_STORED_ERRORS) {
    job.errors.push(error)
  }
}

export function finishJob(job: ImportJob, status: 'completed' | 'failed', message?: string): void {
  job.status = status
  job.finishedAt = Date.now()
  if (message) job.message = message
}

function elapsedSeconds(job: ImportJob): number {
  const end = job.finishedAt ?? Date.now()
  return Math.round((end - job.startedAt) / 1000)
}

export function toProgressPayload(job: ImportJob): ImportProgressPayload {
  const progress =
    job.status === 'completed'
      ? 100
      : job.total > 0
        ? Math.min(99, Math.floor((job.processed / job.total) * 100))
        : 0

  return {
    id: job.id,
    status: job.status,
    progress,
    processed: job.processed,
    total: job.total,
    inserted: job.inserted,
    updated: job.updated,
    skipped: job.skipped,
    errors: job.errorCount,
    elapsedSeconds: elapsedSeconds(job),
    message: job.message,
  }
}

export function toResultPayload(job: ImportJob): ImportResultPayload {
  return {
    id: job.id,
    status: job.status === 'failed' ? 'failed' : 'completed',
    totalProcessed: job.processed,
    inserted: job.inserted,
    updated: job.updated,
    skipped: job.skipped,
    errors: job.errorCount,
    durationSeconds: elapsedSeconds(job),
    message: job.message,
  }
}
