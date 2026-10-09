/**
 * Tipos de UI + reexports dos contratos compartilhados (backend models/dto).
 * Não redeclarar formatos de API aqui — use @dto / @models.
 */

export type { AuxiliaryEntity } from '@models/produto.model'

export type {
  IssueSeverity,
  IssueValidacao as ValidationIssue,
  ValidationCheckSummaryItem,
} from '@models/validacao.model'

export type {
  ResultadoValidacaoProdutoDto as ProductValidationResult,
  ProductFieldCatalogDto as ProductFieldCatalog,
} from '@dto/produto.dto'

export type {
  StatusEnvioJob as EnvioJobStatus,
  ModoEnvio,
  FaseEnvioJob,
  ErroEnvioJob as EnvioJobError,
  ProdutoIgnoradoEnvioJob as EnvioJobProdutoIgnorado,
  ProductSkipReason,
} from '@models/envio.model'

export type { SnapshotEnvioJobDto as EnvioJobSnapshot } from '@dto/envio.dto'

export type { CsvAnalysisResultDto as CsvAnalysis } from '@dto/csv.dto'

export type {
  FolderCollectResultDto as FolderCollectResult,
  AuxiliaryCsvPreviewDto as AuxiliaryCsvPreview,
  AuxiliaryUploadResultDto as AuxiliaryUploadResult,
} from '@dto/coleta-pasta.dto'

export type {
  ControladoSuggestion,
  ControladoSuggestKind,
} from '@models/controlado.model'

export type { ControladoSuggestResultDto as ControladoSuggestResult } from '@dto/controlado.dto'

export type {
  OptionalJobSnapshotDto as OptionalJobSnapshot,
  OptionalFolderCollectResultDto as OptionalFolderCollectResult,
  StockJobSnapshotDto,
  LotJobSnapshotDto,
  ValidityJobSnapshotDto,
  SupplierJobSnapshotDto,
} from '@dto/opcional.dto'

export type { OptionalImportKind } from '@models/opcional.model'

/** Passos do wizard de produtos (estado de UI). */
export type WizardStep = 'file' | 'auxiliary' | 'errors' | 'send'

export type FileInputMode = 'manual' | 'folder'
