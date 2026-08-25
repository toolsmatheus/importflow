import { apiRequest } from '@/lib/api'
import type { CsvAnalysis } from '@/types'

interface CsvOptions {
  delimiter?: string
  encoding?: string
  hasHeader?: boolean
}

export type UploadAnalyzePhase = 'upload' | 'saving' | 'analyze'

export interface UploadAnalyzeProgress {
  phase: UploadAnalyzePhase
  /** Progresso geral 0–100 */
  percent: number
  loaded?: number
  total?: number
  records?: number
  /** Segundos restantes estimados (null se ainda instável) */
  etaSeconds: number | null
  label: string
}

type NdjsonEvent =
  | { type: 'phase'; phase: 'saving' | 'analyze'; bytesTotal?: number }
  | {
      type: 'progress'
      phase: 'saving' | 'analyze'
      bytesWritten?: number
      bytesRead?: number
      bytesTotal?: number
      recordCount?: number
      percent?: number
    }
  | { type: 'done'; analysis: CsvAnalysis }
  | { type: 'error'; message: string }

function etaFromRate(loaded: number, total: number, startedAt: number): number | null {
  const elapsed = (Date.now() - startedAt) / 1000
  if (elapsed < 0.25 || loaded <= 0 || total <= 0 || loaded >= total) return null
  const rate = loaded / elapsed
  if (rate <= 0) return null
  return Math.max(0, Math.ceil((total - loaded) / rate))
}

function overallFromUpload(loaded: number, total: number): number {
  if (total <= 0) return 5
  return Math.min(35, (loaded / total) * 35)
}

function overallFromAnalyze(percent: number): number {
  return 45 + Math.min(55, (Math.max(0, percent) / 100) * 55)
}

export const csvService = {
  async uploadAndAnalyze(
    file: File,
    options?: CsvOptions,
    onProgress?: (progress: UploadAnalyzeProgress) => void
  ): Promise<CsvAnalysis> {
    const formData = new FormData()
    formData.append('file', file)

    if (options?.delimiter) formData.append('delimiter', options.delimiter)
    if (options?.encoding) formData.append('encoding', options.encoding)
    if (options?.hasHeader !== undefined) formData.append('hasHeader', String(options.hasHeader))

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/csv/upload?stream=1')
      xhr.setRequestHeader('Accept', 'application/x-ndjson')
      xhr.responseType = 'text'

      const uploadStartedAt = Date.now()
      let analyzeStartedAt = 0
      let analyzeBytesTotal = file.size
      let lineBuffer = ''
      let consumed = 0
      let settled = false

      const fail = (message: string) => {
        if (settled) return
        settled = true
        reject(new Error(message))
      }

      const succeed = (analysis: CsvAnalysis) => {
        if (settled) return
        settled = true
        onProgress?.({
          phase: 'analyze',
          percent: 100,
          loaded: analysis.fileSize,
          total: analysis.fileSize,
          records: analysis.recordCount,
          etaSeconds: 0,
          label: 'Análise concluída',
        })
        resolve(analysis)
      }

      const handleEvent = (event: NdjsonEvent) => {
        if (event.type === 'phase') {
          if (event.phase === 'saving') {
            onProgress?.({
              phase: 'saving',
              percent: 38,
              etaSeconds: null,
              label: 'Gravando no servidor…',
            })
          } else if (event.phase === 'analyze') {
            analyzeStartedAt = Date.now()
            if (event.bytesTotal) analyzeBytesTotal = event.bytesTotal
            onProgress?.({
              phase: 'analyze',
              percent: 45,
              loaded: 0,
              total: analyzeBytesTotal,
              records: 0,
              etaSeconds: null,
              label: 'Analisando arquivo…',
            })
          }
          return
        }

        if (event.type === 'progress') {
          if (event.phase === 'saving') {
            onProgress?.({
              phase: 'saving',
              percent: 40,
              loaded: event.bytesWritten,
              etaSeconds: null,
              label: 'Gravando no servidor…',
            })
            return
          }

          const loaded = event.bytesRead ?? 0
          const total = event.bytesTotal ?? analyzeBytesTotal
          const records = event.recordCount ?? 0
          const phasePercent = event.percent ?? (total > 0 ? (loaded / total) * 100 : 0)
          onProgress?.({
            phase: 'analyze',
            percent: overallFromAnalyze(phasePercent),
            loaded,
            total,
            records,
            etaSeconds: etaFromRate(loaded, total, analyzeStartedAt || Date.now()),
            label: 'Analisando arquivo…',
          })
          return
        }

        if (event.type === 'error') {
          fail(event.message || 'Erro ao analisar arquivo CSV')
          return
        }

        if (event.type === 'done') {
          succeed(event.analysis)
        }
      }

      const consumeNdjson = () => {
        const chunk = xhr.responseText.slice(consumed)
        consumed = xhr.responseText.length
        if (!chunk) return
        lineBuffer += chunk
        const parts = lineBuffer.split('\n')
        lineBuffer = parts.pop() ?? ''
        for (const line of parts) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            handleEvent(JSON.parse(trimmed) as NdjsonEvent)
          } catch {
            // linha parcial/corrompida — ignora
          }
        }
      }

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return
        onProgress?.({
          phase: 'upload',
          percent: overallFromUpload(e.loaded, e.total),
          loaded: e.loaded,
          total: e.total,
          etaSeconds: etaFromRate(e.loaded, e.total, uploadStartedAt),
          label: 'Enviando arquivo…',
        })
      }

      xhr.upload.onload = () => {
        onProgress?.({
          phase: 'saving',
          percent: 38,
          loaded: file.size,
          total: file.size,
          etaSeconds: null,
          label: 'Processando no servidor…',
        })
      }

      xhr.onprogress = () => consumeNdjson()

      xhr.onload = () => {
        consumeNdjson()
        if (settled) return
        if (xhr.status >= 200 && xhr.status < 300) {
          fail('Resposta incompleta do servidor')
          return
        }
        try {
          const data = JSON.parse(xhr.responseText) as { message?: string }
          fail(data?.message ?? 'Erro ao analisar arquivo CSV')
        } catch {
          fail('Erro ao analisar arquivo CSV')
        }
      }

      xhr.onerror = () => fail('Falha de rede ao enviar o arquivo')
      xhr.onabort = () => fail('Envio cancelado')

      onProgress?.({
        phase: 'upload',
        percent: 0,
        loaded: 0,
        total: file.size,
        etaSeconds: null,
        label: 'Enviando arquivo…',
      })

      xhr.send(formData)
    })
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
