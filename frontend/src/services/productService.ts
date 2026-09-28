import type {
  AuxiliaryCsvPreview,
  AuxiliaryEntity,
  AuxiliaryUploadResult,
  ControladoSuggestResult,
  FolderCollectResult,
  ProductFieldCatalog,
  ProductValidationResult,
  SendJobSnapshot,
  SendMode,
} from '@/types'

async function readJsonResponse<T>(
  response: Response,
  fallbackError: string
): Promise<T> {
  const text = await response.text()
  if (!text.trim()) {
    throw new Error(
      response.ok
        ? fallbackError
        : `Servidor indisponível (HTTP ${response.status}). Verifique se o backend está no ar.`
    )
  }
  let data: unknown
  try {
    data = JSON.parse(text) as unknown
  } catch {
    throw new Error(
      `Resposta inválida do servidor (HTTP ${response.status}). Verifique se o backend está no ar.`
    )
  }
  if (!response.ok) {
    const message =
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : fallbackError
    throw new Error(message)
  }
  return data as T
}

export const productService = {
  templateUrl: '/api/products/template',

  auxiliaryTemplateUrl(entity: string) {
    return `/api/products/template/auxiliar/${entity}`
  },

  async getCatalog(): Promise<ProductFieldCatalog> {
    const response = await fetch('/api/products/catalog')
    return readJsonResponse<ProductFieldCatalog>(response, 'Erro ao carregar o catálogo de campos')
  },

  async uploadAuxiliary(entity: AuxiliaryEntity, file: File): Promise<AuxiliaryUploadResult> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`/api/products/auxiliary/${entity}`, {
      method: 'POST',
      body: formData,
    })
    return readJsonResponse<AuxiliaryUploadResult>(
      response,
      `Erro ao enviar ${entity}.csv`
    )
  },

  async previewAuxiliary(fileId: string, limit = 100): Promise<AuxiliaryCsvPreview> {
    const response = await fetch(
      `/api/products/auxiliary/preview/${encodeURIComponent(fileId)}?limit=${limit}`
    )
    return readJsonResponse<AuxiliaryCsvPreview>(
      response,
      'Erro ao pré-visualizar o auxiliar'
    )
  },

  async validate(
    fileId: string,
    options?: {
      delimiter?: string
      encoding?: string
      clientUf?: string
      auxiliary?: Partial<Record<AuxiliaryEntity, string>>
    }
  ): Promise<ProductValidationResult> {
    const response = await fetch('/api/products/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        delimiter: options?.delimiter ?? ';',
        encoding: options?.encoding,
        clientUf: options?.clientUf,
        auxiliary: options?.auxiliary,
      }),
    })
    return readJsonResponse<ProductValidationResult>(
      response,
      'Erro ao validar o arquivo'
    )
  },

  async validateRows(
    rows: Record<string, string>[],
    auxiliary?: Partial<Record<AuxiliaryEntity, string>>,
    clientUf?: string
  ): Promise<ProductValidationResult> {
    const response = await fetch('/api/products/validate-rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, auxiliary, clientUf }),
    })
    return readJsonResponse<ProductValidationResult>(
      response,
      'Erro ao revalidar as linhas'
    )
  },

  async suggestControlados(
    rows: Record<string, string>[],
    auxiliary?: Partial<Record<AuxiliaryEntity, string>>
  ): Promise<ControladoSuggestResult> {
    const response = await fetch('/api/products/suggest-controlados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows,
        auxiliary: auxiliary?.dcb ? { dcb: auxiliary.dcb } : undefined,
      }),
    })
    return readJsonResponse<ControladoSuggestResult>(
      response,
      'Erro ao sugerir controlados'
    )
  },

  async identifyServer(
    tmsBaseUrl?: string
  ): Promise<{ idFilial: number; versao?: string; tmsBaseUrl: string }> {
    const query = tmsBaseUrl ? `?tmsBaseUrl=${encodeURIComponent(tmsBaseUrl)}` : ''
    const response = await fetch(`/api/products/identify-server${query}`)
    return readJsonResponse<{ idFilial: number; versao?: string; tmsBaseUrl: string }>(
      response,
      'Erro ao identificar o servidor'
    )
  },

  async startSend(options: {
    rows: Record<string, string>[]
    mode?: SendMode
    tmsBaseUrl?: string
    batchSize?: number
    concurrency?: number
    auxiliary?: Partial<Record<AuxiliaryEntity, string>>
  }): Promise<SendJobSnapshot> {
    const response = await fetch('/api/products/send/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: options.rows,
        mode: options.mode,
        tmsBaseUrl: options.tmsBaseUrl,
        batchSize: options.batchSize,
        concurrency: options.concurrency,
        auxiliary: options.auxiliary,
      }),
    })
    return readJsonResponse<SendJobSnapshot>(response, 'Erro ao iniciar o envio')
  },

  async getSendJob(jobId: string): Promise<SendJobSnapshot> {
    const response = await fetch(`/api/products/send/${jobId}`)
    return readJsonResponse<SendJobSnapshot>(response, 'Job de envio não encontrado')
  },

  async pauseSend(jobId: string): Promise<SendJobSnapshot> {
    const response = await fetch(`/api/products/send/${jobId}/pause`, { method: 'POST' })
    return readJsonResponse<SendJobSnapshot>(response, 'Erro ao pausar')
  },

  async resumeSend(jobId: string): Promise<SendJobSnapshot> {
    const response = await fetch(`/api/products/send/${jobId}/resume`, { method: 'POST' })
    return readJsonResponse<SendJobSnapshot>(response, 'Erro ao retomar')
  },

  async cancelSend(jobId: string): Promise<SendJobSnapshot> {
    const response = await fetch(`/api/products/send/${jobId}/cancel`, { method: 'POST' })
    return readJsonResponse<SendJobSnapshot>(response, 'Erro ao cancelar')
  },

  async retryFailedSend(jobId: string): Promise<SendJobSnapshot> {
    const response = await fetch(`/api/products/send/${jobId}/retry-failures`, {
      method: 'POST',
    })
    return readJsonResponse<SendJobSnapshot>(response, 'Erro ao reenviar falhas')
  },

  downloadSkippedProducts(jobId: string) {
    const link = document.createElement('a')
    link.href = `/api/products/send/${jobId}/skipped.csv`
    link.download = `produtos-ignorados-${jobId.slice(0, 8)}.csv`
    link.click()
  },

  async collectFolder(folderPath: string): Promise<FolderCollectResult> {
    const response = await fetch('/api/products/collect-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath }),
    })
    return readJsonResponse<FolderCollectResult>(
      response,
      'Erro ao coletar arquivos da pasta'
    )
  },

  async getFolderExpect(): Promise<{ expected: { role: string; names: string[] }[]; tip: string }> {
    const response = await fetch('/api/products/folder-expect')
    return readJsonResponse<{ expected: { role: string; names: string[] }[]; tip: string }>(
      response,
      'Erro ao carregar nomes esperados'
    )
  },

  downloadTemplate() {
    const link = document.createElement('a')
    link.href = this.templateUrl
    link.download = 'modelo-produtos.csv'
    link.click()
  },

  downloadAuxiliaryTemplate(entity: string) {
    const link = document.createElement('a')
    link.href = this.auxiliaryTemplateUrl(entity)
    link.download = `modelo-${entity}.csv`
    link.click()
  },
}
