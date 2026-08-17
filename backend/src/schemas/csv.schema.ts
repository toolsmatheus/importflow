import { z } from 'zod'

export const csvAnalyzeOptionsSchema = z.object({
  delimiter: z.string().min(1).max(1).optional(),
  encoding: z.string().min(1).optional(),
  hasHeader: z.coerce.boolean().optional(),
})

export const csvReanalyzeSchema = z.object({
  fileId: z.string().uuid(),
  delimiter: z.string().min(1).max(1).optional(),
  encoding: z.string().min(1).optional(),
  hasHeader: z.coerce.boolean().optional(),
})

export type CsvAnalyzeOptions = z.infer<typeof csvAnalyzeOptionsSchema>

export interface CsvAnalysisResult {
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
