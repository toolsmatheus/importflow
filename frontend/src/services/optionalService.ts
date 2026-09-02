export type OptionalSendMode = 'live' | 'simulate'

export interface OptionalJobError {
  index: number
  codigo: string
  /** Barras+: EAN adicional; Fornecedor: código do fornecedor. */
  detail: string
  message: string
}

export interface OptionalJobSnapshot {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  mode: OptionalSendMode
  tmsBaseUrl: string
  idFilial: number
  total: number
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  percent: number
  errors: Array<{
    index: number
    codigo: string
    codigoadicional?: string
    codigofornecedor?: string
    message: string
  }>
  errorsTruncated: boolean
  skipped?: Array<{
    index: number
    codigo: string
    codigoadicional?: string
    codigofornecedor?: string
    message: string
  }>
  skippedTruncated?: boolean
  startedAt: string | null
  finishedAt: string | null
  message?: string
}

async function startOptionalSend(
  url: string,
  file: File,
  options?: { tmsBaseUrl?: string; mode?: OptionalSendMode },
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

export const optionalService = {
  barcodeTemplateUrl: '/api/opcionais/barcodes/template',
  supplierTemplateUrl: '/api/opcionais/supplier-refs/template',
  validityTemplateUrl: '/api/opcionais/validity/template',
  stockTemplateUrl: '/api/opcionais/stock/template',
  lotsTemplateUrl: '/api/opcionais/lots/template',

  async startBarcodeSend(
    file: File,
    options?: { tmsBaseUrl?: string; mode?: OptionalSendMode }
  ): Promise<OptionalJobSnapshot> {
    return startOptionalSend(
      '/api/opcionais/barcodes/send/start',
      file,
      options,
      'Erro ao iniciar importação de códigos de barras'
    )
  },

  async getBarcodeJob(jobId: string): Promise<OptionalJobSnapshot> {
    return getOptionalJob(`/api/opcionais/barcodes/send/${jobId}`, 'Erro ao consultar job')
  },

  async cancelBarcodeJob(jobId: string): Promise<OptionalJobSnapshot> {
    return cancelOptionalJob(
      `/api/opcionais/barcodes/send/${jobId}/cancel`,
      'Erro ao cancelar job'
    )
  },

  async startSupplierSend(
    file: File,
    options?: { tmsBaseUrl?: string; mode?: OptionalSendMode }
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
    options?: { tmsBaseUrl?: string; mode?: OptionalSendMode }
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
    options?: { tmsBaseUrl?: string; mode?: OptionalSendMode }
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
    options?: { tmsBaseUrl?: string; mode?: OptionalSendMode }
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
