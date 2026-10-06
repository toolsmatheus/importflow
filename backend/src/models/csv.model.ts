/** Arquivo CSV armazenado em temp (metadados em memória). */
export interface StoredCsvFile {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  createdAt: Date
  lastAccessedAt: Date
}

export interface ResolvedCsvOptions {
  delimiter: string
  encoding: string
  hasHeader: boolean
}

export interface AnalyzeProgressEvent {
  bytesRead: number
  bytesTotal: number
  recordCount: number
  percent: number
}

export type AnalyzeProgressCallback = (event: AnalyzeProgressEvent) => void
