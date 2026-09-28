import {
  auxiliaryMigracaoExists,
  fetchAuxiliaryExistenceCatalogs,
  fetchTmsDcbCatalog,
  insertAuxiliaryEntity,
  markAuxiliaryMigracaoExists,
  type AuxiliaryMigracaoEntity,
} from '../tmsService.js'
import { lookupAnvisaDcb, lookupAnvisaDcbByDescricao, padDcbCode } from '../dcbIndexService.js'
import { AUX_LABEL, MAX_STORED_ERRORS, type SendJobInternal } from './sendJobTypes.js'
import { sleep } from './sendJobWait.js'

export async function insertAuxiliaries(job: SendJobInternal): Promise<void> {
  if (job.mode !== 'live' || job.auxiliaries.length === 0 || job.auxDone) return

  const remaining = job.auxiliaries.slice(job.auxInserted + job.auxFailed + job.auxSkipped)
  const needsDcbCatalog = remaining.some((item) => item.entity === 'dcb')
  const dcbCatalog = needsDcbCatalog ? await fetchTmsDcbCatalog(job.tmsBaseUrl) : null
  const existence = await fetchAuxiliaryExistenceCatalogs(job.tmsBaseUrl)

  for (const item of remaining) {
    if (job.cancelRequested) return
    while (job.pauseRequested && !job.cancelRequested) {
      job.status = 'paused'
      await sleep(200)
    }
    if (job.cancelRequested) return

    if (item.entity === 'dcb' && dcbCatalog) {
      // id do auxiliar ≠ código Anvisa: resolve pelo nome (ex.: Clonazepam → 02300).
      const byName = lookupAnvisaDcbByDescricao(item.descricao)
      const byCode = byName ? null : lookupAnvisaDcb(padDcbCode(item.codigo))
      const anvisa = byName ?? byCode
      if (!anvisa) {
        // Sem código Anvisa: não cadastra o auxiliar; produtos controlados
        // recebem aviso na hora do insert (DCB omitido no payload).
        job.auxSkipped++
        continue
      }

      const existing = dcbCatalog.get(anvisa.dcb) ?? dcbCatalog.get(padDcbCode(anvisa.dcb))
      if (existing) {
        job.auxSkipped++
        continue
      }

      const toInsert = {
        codigo: anvisa.dcb,
        descricao: anvisa.descricao,
      }
      const result = await insertAuxiliaryEntity('dcb', toInsert, job.tmsBaseUrl)
      if (result.ok) {
        job.auxInserted++
        dcbCatalog.set(anvisa.dcb, {
          id: '',
          dcb: anvisa.dcb,
          descricao: toInsert.descricao,
        })
        continue
      }
      job.auxFailed++
      if (job.errors.length < MAX_STORED_ERRORS) {
        job.errors.push({
          index: -1,
          codigo: anvisa.dcb,
          message: `DCB ${anvisa.dcb} (${toInsert.descricao}): ${result.message || 'falha no insert'}`,
          batch: 0,
        })
      }
      continue
    }

    if (item.entity === 'similar') {
      const key = item.descricao.trim().toLocaleUpperCase('pt-BR')
      if (existence.similarByDescricao.has(key)) {
        job.auxSkipped++
        continue
      }
      const result = await insertAuxiliaryEntity('similar', item, job.tmsBaseUrl)
      if (result.ok) {
        job.auxInserted++
        existence.similarByDescricao.add(key)
        continue
      }
      job.auxFailed++
      if (job.errors.length < MAX_STORED_ERRORS) {
        job.errors.push({
          index: -1,
          codigo: item.codigo,
          message: `Similar ${item.codigo} (${item.descricao}): ${result.message || 'falha no insert'}`,
          batch: 0,
        })
      }
      continue
    }

    const migracaoEntity = item.entity as AuxiliaryMigracaoEntity
    if (auxiliaryMigracaoExists(existence, migracaoEntity, item.codigo)) {
      job.auxSkipped++
      continue
    }

    const result = await insertAuxiliaryEntity(item.entity, item, job.tmsBaseUrl)
    if (result.ok) {
      job.auxInserted++
      markAuxiliaryMigracaoExists(existence, migracaoEntity, item.codigo)
      continue
    }

    job.auxFailed++
    if (job.errors.length < MAX_STORED_ERRORS) {
      const label = AUX_LABEL[item.entity]
      job.errors.push({
        index: -1,
        codigo: item.codigo,
        message: `${label} ${item.codigo} (${item.descricao}): ${result.message || 'falha no insert'}`,
        batch: 0,
      })
    }
  }

  if (!job.cancelRequested) job.auxDone = true
}
