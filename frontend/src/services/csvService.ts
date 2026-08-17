import { apiRequest } from '@/lib/api'
import type { CsvAnalysis } from '@/types'

interface CsvOptions {
  delimiter?: string
  encoding?: string
  hasHeader?: boolean
}

export const csvService = {
  async uploadAndAnalyze(file: File, options?: CsvOptions): Promise<CsvAnalysis> {
    const formData = new FormData()
    formData.append('file', file)

    if (options?.delimiter) formData.append('delimiter', options.delimiter)
    if (options?.encoding) formData.append('encoding', options.encoding)
    if (options?.hasHeader !== undefined) formData.append('hasHeader', String(options.hasHeader))

    const response = await fetch('/api/csv/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data?.message ?? 'Erro ao analisar arquivo CSV')
    }

    return data as CsvAnalysis
  },

  async reanalyze(fileId: string, options: CsvOptions): Promise<CsvAnalysis> {
    return apiRequest<CsvAnalysis>('/csv/analyze', {
      method: 'POST',
      body: JSON.stringify({
        fileId,
        delimiter: options.delimiter,
        encoding: options.encoding,
        hasHeader: options.hasHeader,
      }),
    })
  },

  /** Descarta o arquivo no servidor quando ele deixa de ser necessário. */
  async discard(fileId: string): Promise<void> {
    await fetch(`/api/csv/file/${fileId}`, { method: 'DELETE' })
  },
}
