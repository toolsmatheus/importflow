export interface CsvAnalysisResultDto {
  fileId: string
  fileName: string
  fileSize: number
  recordCount: number
  columnCount: number
  encoding: string
  delimiter: string
  hasHeader: boolean
  columns: string[]
}

/** @deprecated Use CsvAnalysisResultDto */
export type CsvAnalysisResult = CsvAnalysisResultDto
