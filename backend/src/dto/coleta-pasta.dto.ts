import type { AuxiliaryEntity } from '../models/produto.model.js'
import type { CsvAnalysisResultDto } from './csv.dto.js'

export interface CollectedAuxiliaryDto {
  entity: AuxiliaryEntity
  fileId: string
  fileName: string
  fileSize: number
  recordCount: number
  parseWarnings: string[]
}

export interface FolderCollectResultDto {
  folderPath: string
  products: CsvAnalysisResultDto | null
  auxiliaries: Partial<Record<AuxiliaryEntity, CollectedAuxiliaryDto>>
  found: { role: string; fileName: string }[]
  missing: string[]
  ignored: string[]
}

export interface AuxiliaryCsvPreviewDto {
  fileId: string
  fileName: string
  columns: string[]
  rows: Record<string, string>[]
  totalRecords: number
  truncated: boolean
}

export interface AuxiliaryUploadResultDto {
  entity: AuxiliaryEntity
  fileId: string
  fileName: string
  fileSize: number
  recordCount: number
  parseWarnings: string[]
}

/** @deprecated Use FolderCollectResultDto */
export type FolderCollectResult = FolderCollectResultDto
/** @deprecated Use CollectedAuxiliaryDto */
export type CollectedAuxiliary = CollectedAuxiliaryDto
/** @deprecated Use AuxiliaryCsvPreviewDto */
export type AuxiliaryCsvPreview = AuxiliaryCsvPreviewDto
