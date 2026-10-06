import type { OptionalModoEnvio } from '@models/opcional.model'
import type { OptionalJobSnapshotDto } from '@dto/opcional.dto'

/** Erro/ignorado genérico na UI (fornecedor pode trazer codigofornecedor). */
type OpcionalErroUi = {
  index: number
  codigo: string
  codigofornecedor?: string
  message: string
}

export type OptionalJobSnapshot = OptionalJobSnapshotDto<OpcionalErroUi, OpcionalErroUi>

export type { OptionalModoEnvio }

async function startOptionalSend(
  url: string,
  file: File,
  options?: { tmsBaseUrl?: string; mode?: OptionalModoEnvio },
  failMessage = 'Erro ao iniciar importação'
): Promise<OptionalJobSnapshot> {
  const formData = new FormData()
  formData.append('file', file)
  if (options?.tmsBaseUrl) formData.append('tmsBaseUrl', options.tmsBaseUrl)
  formData.append('mode', options?.mode ?? 'live')

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.message ?? failMessage)
  }
  return data as OptionalJobSnapshot
}

async function getOptionalJob(url: string, failMessage: string): Promise<OptionalJobSnapshot> {
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) throw new Error(data?.message ?? failMessage)
  return data as OptionalJobSnapshot
}

async function cancelOptionalJob(url: string, failMessage: string): Promise<OptionalJobSnapshot> {
  const response = await fetch(url, { method: 'POST' })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.message ?? failMessage)
  return data as OptionalJobSnapshot
}

export const opcionalServico = {
  supplierTemplateUrl: '/api/opcionais/supplier-refs/template',
  validityTemplateUrl: '/api/opcionais/validity/template',
  stockTemplateUrl: '/api/opcionais/stock/template',
  lotsTemplateUrl: '/api/opcionais/lots/template',

  async startSupplierSend(
    file: File,
    options?: { tmsBaseUrl?: string; mode?: OptionalModoEnvio }
  ): Promise<OptionalJobSnapshot> {
    return startOptionalSend(
      '/api/opcionais/supplier-refs/send/start',
      file,
      options,
      'Erro ao iniciar importação de códigos de fornecedor'
    )
  },

  async getSupplierJob(jobId: string): Promise<OptionalJobSnapshot> {
    return getOptionalJob(
      `/api/opcionais/supplier-refs/send/${jobId}`,
      'Erro ao consultar job'
    )
  },

  async cancelSupplierJob(jobId: string): Promise<OptionalJobSnapshot> {
    return cancelOptionalJob(
      `/api/opcionais/supplier-refs/send/${jobId}/cancel`,
      'Erro ao cancelar job'
    )
  },

  async startValiditySend(
    file: File,
    options?: { tmsBaseUrl?: string; mode?: OptionalModoEnvio }
  ): Promise<OptionalJobSnapshot> {
    return startOptionalSend(
      '/api/opcionais/validity/send/start',
      file,
      options,
      'Erro ao iniciar importação de validade'
    )
  },

  async getValidityJob(jobId: string): Promise<OptionalJobSnapshot> {
    return getOptionalJob(`/api/opcionais/validity/send/${jobId}`, 'Erro ao consultar job')
  },

  async cancelValidityJob(jobId: string): Promise<OptionalJobSnapshot> {
    return cancelOptionalJob(
      `/api/opcionais/validity/send/${jobId}/cancel`,
      'Erro ao cancelar job'
    )
  },

  async startStockSend(
    file: File,
    options?: { tmsBaseUrl?: string; mode?: OptionalModoEnvio }
  ): Promise<OptionalJobSnapshot> {
    return startOptionalSend(
      '/api/opcionais/stock/send/start',
      file,
      options,
      'Erro ao iniciar importação de estoque'
    )
  },

  async getStockJob(jobId: string): Promise<OptionalJobSnapshot> {
    return getOptionalJob(`/api/opcionais/stock/send/${jobId}`, 'Erro ao consultar job')
  },

  async cancelStockJob(jobId: string): Promise<OptionalJobSnapshot> {
    return cancelOptionalJob(
      `/api/opcionais/stock/send/${jobId}/cancel`,
      'Erro ao cancelar job'
    )
  },

  async startLotSend(
    file: File,
    options?: { tmsBaseUrl?: string; mode?: OptionalModoEnvio }
  ): Promise<OptionalJobSnapshot> {
    return startOptionalSend(
      '/api/opcionais/lots/send/start',
      file,
      options,
      'Erro ao iniciar importação de lotes'
    )
  },

  async getLotJob(jobId: string): Promise<OptionalJobSnapshot> {
    return getOptionalJob(`/api/opcionais/lots/send/${jobId}`, 'Erro ao consultar job')
  },

  async cancelLotJob(jobId: string): Promise<OptionalJobSnapshot> {
    return cancelOptionalJob(
      `/api/opcionais/lots/send/${jobId}/cancel`,
      'Erro ao cancelar job'
    )
  },
}
