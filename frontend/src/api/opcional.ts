import type { OptionalImportKind, OptionalModoEnvio } from '@models/opcional.model'
import type { OptionalJobSnapshotDto } from '@dto/opcional.dto'
import type { OptionalFolderCollectResult } from '@/types'

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

export const OPCIONAL_TEMPLATE_URL: Partial<Record<OptionalImportKind, string>> = {
  barcodeExtras: '/api/opcionais/barcode-extras/template',
  supplierRefs: '/api/opcionais/supplier-refs/template',
  validity: '/api/opcionais/validity/template',
  stock: '/api/opcionais/stock/template',
  lots: '/api/opcionais/lots/template',
}

export const opcionalServico = {
  barcodeExtrasTemplateUrl: OPCIONAL_TEMPLATE_URL.barcodeExtras!,
  supplierTemplateUrl: OPCIONAL_TEMPLATE_URL.supplierRefs!,
  validityTemplateUrl: OPCIONAL_TEMPLATE_URL.validity!,
  stockTemplateUrl: OPCIONAL_TEMPLATE_URL.stock!,
  lotsTemplateUrl: OPCIONAL_TEMPLATE_URL.lots!,
  templateUrl(kind: OptionalImportKind): string | null {
    return OPCIONAL_TEMPLATE_URL[kind] ?? null
  },

  async collectFolder(folderPath: string): Promise<OptionalFolderCollectResult> {
    const response = await fetch('/api/opcionais/collect-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(
        (data as { message?: string })?.message ??
          `Erro ao coletar pasta (${response.status})`
      )
    }
    return data as OptionalFolderCollectResult
  },

  async startSend(
    kind: OptionalImportKind,
    file: File,
    options?: { tmsBaseUrl?: string; mode?: OptionalModoEnvio }
  ): Promise<OptionalJobSnapshot> {
    switch (kind) {
      case 'barcodeExtras':
        return this.startBarcodeExtraSend(file, options)
      case 'supplierRefs':
        return this.startSupplierSend(file, options)
      case 'validity':
        return this.startValiditySend(file, options)
      case 'stock':
        return this.startStockSend(file, options)
      case 'lots':
        return this.startLotSend(file, options)
      default:
        throw new Error('Importação ainda não disponível para este tipo')
    }
  },

  async getJob(kind: OptionalImportKind, jobId: string): Promise<OptionalJobSnapshot> {
    switch (kind) {
      case 'barcodeExtras':
        return this.getBarcodeExtraJob(jobId)
      case 'supplierRefs':
        return this.getSupplierJob(jobId)
      case 'validity':
        return this.getValidityJob(jobId)
      case 'stock':
        return this.getStockJob(jobId)
      case 'lots':
        return this.getLotJob(jobId)
      default:
        throw new Error('Importação ainda não disponível para este tipo')
    }
  },

  async startBarcodeExtraSend(
    file: File,
    options?: { tmsBaseUrl?: string; mode?: OptionalModoEnvio }
  ): Promise<OptionalJobSnapshot> {
    return startOptionalSend(
      '/api/opcionais/barcode-extras/send/start',
      file,
      options,
      'Erro ao iniciar importação de códigos de barras adicionais'
    )
  },

  async getBarcodeExtraJob(jobId: string): Promise<OptionalJobSnapshot> {
    return getOptionalJob(
      `/api/opcionais/barcode-extras/send/${jobId}`,
      'Erro ao consultar job'
    )
  },

  async cancelBarcodeExtraJob(jobId: string): Promise<OptionalJobSnapshot> {
    return cancelOptionalJob(
      `/api/opcionais/barcode-extras/send/${jobId}/cancel`,
      'Erro ao cancelar job'
    )
  },

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
