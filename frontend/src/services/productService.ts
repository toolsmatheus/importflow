import type {
  AuxiliaryEntity,
  AuxiliaryUploadResult,
  ControladoSuggestResult,
  FolderCollectResult,
  ProductFieldCatalog,
  ProductValidationResult,
  SendJobSnapshot,
  SendMode,
} from '@/types'

export const productService = {
  templateUrl: '/api/products/template',

  auxiliaryTemplateUrl(entity: string) {
    return `/api/products/template/auxiliar/${entity}`
  },

  async getCatalog(): Promise<ProductFieldCatalog> {
    const response = await fetch('/api/products/catalog')
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao carregar o catálogo de campos')
    return data as ProductFieldCatalog
  },

  async uploadAuxiliary(entity: AuxiliaryEntity, file: File): Promise<AuxiliaryUploadResult> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`/api/products/auxiliary/${entity}`, {
      method: 'POST',
      body: formData,
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? `Erro ao enviar ${entity}.csv`)
    return data as AuxiliaryUploadResult
  },

  async validate(
    fileId: string,
    options?: {
      delimiter?: string
      encoding?: string
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
        auxiliary: options?.auxiliary,
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao validar o arquivo')
    return data as ProductValidationResult
  },

  async validateRows(
    rows: Record<string, string>[],
    auxiliary?: Partial<Record<AuxiliaryEntity, string>>
  ): Promise<ProductValidationResult> {
    const response = await fetch('/api/products/validate-rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, auxiliary }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao revalidar as linhas')
    return data as ProductValidationResult
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
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao sugerir controlados')
    return data as ControladoSuggestResult
  },

  async identifyServer(
    tmsBaseUrl?: string
  ): Promise<{ idFilial: number; versao?: string; tmsBaseUrl: string }> {
    const query = tmsBaseUrl ? `?tmsBaseUrl=${encodeURIComponent(tmsBaseUrl)}` : ''
    const response = await fetch(`/api/products/identify-server${query}`)
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao identificar o servidor TMS')
    return data as { idFilial: number; versao?: string; tmsBaseUrl: string }
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
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao iniciar o envio')
    return data as SendJobSnapshot
  },

  async getSendJob(jobId: string): Promise<SendJobSnapshot> {
    const response = await fetch(`/api/products/send/${jobId}`)
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Job de envio não encontrado')
    return data as SendJobSnapshot
  },

  async pauseSend(jobId: string): Promise<SendJobSnapshot> {
    const response = await fetch(`/api/products/send/${jobId}/pause`, { method: 'POST' })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao pausar')
    return data as SendJobSnapshot
  },

  async resumeSend(jobId: string): Promise<SendJobSnapshot> {
    const response = await fetch(`/api/products/send/${jobId}/resume`, { method: 'POST' })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao retomar')
    return data as SendJobSnapshot
  },

  async cancelSend(jobId: string): Promise<SendJobSnapshot> {
    const response = await fetch(`/api/products/send/${jobId}/cancel`, { method: 'POST' })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao cancelar')
    return data as SendJobSnapshot
  },

  async retryFailedSend(jobId: string): Promise<SendJobSnapshot> {
    const response = await fetch(`/api/products/send/${jobId}/retry-failures`, {
      method: 'POST',
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao reenviar falhas')
    return data as SendJobSnapshot
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
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao coletar arquivos da pasta')
    return data as FolderCollectResult
  },

  async getFolderExpect(): Promise<{ expected: { role: string; names: string[] }[]; tip: string }> {
    const response = await fetch('/api/products/folder-expect')
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao carregar nomes esperados')
    return data as { expected: { role: string; names: string[] }[]; tip: string }
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
