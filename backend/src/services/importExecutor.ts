import type mysql from 'mysql2/promise'
import type { CellValue } from '../repositories/importRepository.js'
import {
  insertBatch,
  parseDuplicates,
  supportsRowAlias,
  updateRow,
  upsertBatch,
} from '../repositories/importRepository.js'
import type { ImportMode, StartImportInput } from '../schemas/import.schema.js'
import { getFriendlyMysqlStatementError } from '../utils/mysqlErrors.js'
import { coerceValue } from '../utils/valueCoercion.js'
import type { StoredCsvFile } from './csvFileService.js'
import { createRecordStream, normalizeRecord, resolveCsvOptions } from './csvService.js'
import { addJobError, finishJob, type ImportJob } from './importJobService.js'
import { createConnectionFromSession } from './mysqlService.js'
import type { ActiveMapping } from './validationService.js'

const BATCH_SIZE = 500

interface BatchRow {
  row: number
  values: CellValue[]
}

interface Plan {
  table: string
  mode: ImportMode
  targetColumns: string[]
  updateColumns: string[]
  keyColumns: string[]
  useRowAlias: boolean
}

/**
 * No modo "atualizar" precisamos de uma chave para localizar o registro.
 * Damos preferência à chave primária completa e, na falta dela, a uma coluna única.
 */
function resolveKeyColumns(active: ActiveMapping[]): string[] {
  const primary = active.filter((item) => item.column.key === 'PRI').map((item) => item.column.name)
  if (primary.length > 0) return primary

  const unique = active.find((item) => item.column.key === 'UNI')
  return unique ? [unique.column.name] : []
}

function splitValues(plan: Plan, values: CellValue[]): { set: CellValue[]; key: CellValue[] } {
  const byColumn = new Map(plan.targetColumns.map((column, index) => [column, values[index]]))

  return {
    set: plan.updateColumns.map((column) => byColumn.get(column) ?? null),
    key: plan.keyColumns.map((column) => byColumn.get(column) ?? null),
  }
}

async function applyRow(
  connection: mysql.Connection,
  job: ImportJob,
  plan: Plan,
  item: BatchRow
): Promise<void> {
  if (plan.mode === 'update') {
    const { set, key } = splitValues(plan, item.values)

    if (key.some((value) => value === null || value === '')) {
      addJobError(job, {
        row: item.row,
        field: plan.keyColumns.join(', '),
        value: '',
        message: 'Chave de atualização vazia; não é possível localizar o registro.',
      })
      return
    }

    const result = await updateRow(
      connection,
      plan.table,
      plan.updateColumns,
      plan.keyColumns,
      set,
      key
    )

    if (result.affectedRows > 0) job.updated++
    else job.skipped++
    return
  }

  if (plan.mode === 'upsert') {
    const result = await upsertBatch(
      connection,
      plan.table,
      plan.targetColumns,
      plan.updateColumns,
      [item.values],
      plan.useRowAlias
    )
    const counts = parseDuplicates(result.info, 1)
    job.inserted += counts.inserted
    job.updated += counts.updated
    return
  }

  await insertBatch(connection, plan.table, plan.targetColumns, [item.values])
  job.inserted++
}

/**
 * Quando o lote inteiro falha, reprocessamos linha por linha para descobrir
 * exatamente quais registros causaram o problema — as linhas boas do lote entram.
 */
async function retryRowByRow(
  connection: mysql.Connection,
  job: ImportJob,
  plan: Plan,
  batch: BatchRow[]
): Promise<void> {
  for (const item of batch) {
    try {
      await applyRow(connection, job, plan, item)
    } catch (error) {
      addJobError(job, {
        row: item.row,
        field: '',
        value: '',
        message: getFriendlyMysqlStatementError(error),
      })
    }
  }
}

async function flushBatch(
  connection: mysql.Connection,
  job: ImportJob,
  plan: Plan,
  batch: BatchRow[]
): Promise<void> {
  if (batch.length === 0) return

  await connection.beginTransaction()

  try {
    if (plan.mode === 'insert') {
      await insertBatch(connection, plan.table, plan.targetColumns, batch.map((item) => item.values))
      job.inserted += batch.length
    } else if (plan.mode === 'upsert') {
      const result = await upsertBatch(
        connection,
        plan.table,
        plan.targetColumns,
        plan.updateColumns,
        batch.map((item) => item.values),
        plan.useRowAlias
      )
      const counts = parseDuplicates(result.info, batch.length)
      job.inserted += counts.inserted
      job.updated += counts.updated
    } else {
      for (const item of batch) {
        await applyRow(connection, job, plan, item)
      }
    }

    await connection.commit()
  } catch {
    await connection.rollback().catch(() => undefined)
    await retryRowByRow(connection, job, plan, batch)
  }
}

/**
 * Núcleo da importação, separado da criação da conexão para permitir testes
 * com uma conexão simulada.
 */
export async function executeImportWithConnection(
  connection: mysql.Connection,
  job: ImportJob,
  input: StartImportInput,
  file: StoredCsvFile,
  active: ActiveMapping[]
): Promise<void> {
  try {
    const targetColumns = active.map((item) => item.column.name)
    const keyColumns = resolveKeyColumns(active)
    const primaryColumns = new Set(
      active.filter((item) => item.column.key === 'PRI').map((item) => item.column.name)
    )

    const updateColumns =
      input.mode === 'update'
        ? targetColumns.filter((column) => !keyColumns.includes(column))
        : targetColumns.filter((column) => !primaryColumns.has(column))

    if (input.mode === 'update') {
      if (keyColumns.length === 0) {
        finishJob(
          job,
          'failed',
          'O modo "atualizar" exige que a chave primária ou uma coluna única esteja mapeada.'
        )
        return
      }
      if (updateColumns.length === 0) {
        finishJob(job, 'failed', 'Nenhuma coluna além da chave foi mapeada; não há o que atualizar.')
        return
      }
    }

    const plan: Plan = {
      table: input.table,
      mode: input.mode,
      targetColumns,
      updateColumns,
      keyColumns,
      useRowAlias: input.mode === 'upsert' ? await supportsRowAlias(connection) : false,
    }

    const options = await resolveCsvOptions(file.filePath, {
      delimiter: input.delimiter,
      encoding: input.encoding,
      hasHeader: input.hasHeader,
    })

    const stream = createRecordStream(file.filePath, options)
    let batch: BatchRow[] = []

    for await (const raw of stream) {
      const record = normalizeRecord(raw as Record<string, string> | string[])
      job.processed++
      const rowNumber = options.hasHeader ? job.processed + 1 : job.processed

      const values: CellValue[] = []
      let blocking: { field: string; value: string; message: string } | null = null

      for (const { csvColumn, column } of active) {
        const rawValue = record[csvColumn]
        const { value, issues } = coerceValue(rawValue, column)
        const firstError = issues.find((issue) => issue.severity === 'error')

        if (firstError && !blocking) {
          blocking = { field: csvColumn, value: rawValue ?? '', message: firstError.message }
        }

        values.push(value)
      }

      if (blocking) {
        addJobError(job, { row: rowNumber, ...blocking })
        continue
      }

      batch.push({ row: rowNumber, values })

      if (batch.length >= BATCH_SIZE) {
        await flushBatch(connection, job, plan, batch)
        batch = []
      }
    }

    await flushBatch(connection, job, plan, batch)

    if (job.total === 0) {
      job.total = job.processed
    }

    finishJob(job, 'completed')
  } catch (error) {
    finishJob(job, 'failed', getFriendlyMysqlStatementError(error))
  }
}

export async function runImport(
  job: ImportJob,
  sessionId: string,
  input: StartImportInput,
  file: StoredCsvFile,
  active: ActiveMapping[]
): Promise<void> {
  job.status = 'running'

  // FOUND_ROWS faz o UPDATE reportar linhas encontradas em vez de linhas alteradas,
  // permitindo distinguir "registro não existe" de "registro já estava igual".
  const connection = await createConnectionFromSession(sessionId, { flags: ['+FOUND_ROWS'] })

  if (!connection) {
    finishJob(job, 'failed', 'Sessão expirada. Teste a conexão novamente.')
    return
  }

  try {
    await executeImportWithConnection(connection, job, input, file, active)
  } finally {
    await connection.end().catch(() => undefined)
  }
}
