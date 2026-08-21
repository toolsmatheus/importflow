import type {
  AuxiliaryEntity,
  AuxiliaryUploadResult,
  ProductFieldCatalog,
  ProductValidationResult,
  TmsSendResult,
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

  async identifyServer(tmsBaseUrl?: string): Promise<{ idFilial: number; tmsBaseUrl: string }> {
    const query = tmsBaseUrl ? `?tmsBaseUrl=${encodeURIComponent(tmsBaseUrl)}` : ''
    const response = await fetch(`/api/products/identify-server${query}`)
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao identificar o servidor TMS')
    return data as { idFilial: number; tmsBaseUrl: string }
  },

  async send(
    rows: Record<string, string>[],
    tmsBaseUrl?: string
  ): Promise<TmsSendResult> {
    const response = await fetch('/api/products/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, tmsBaseUrl }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message ?? 'Erro ao enviar produtos ao TMS')
    return data as TmsSendResult
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
