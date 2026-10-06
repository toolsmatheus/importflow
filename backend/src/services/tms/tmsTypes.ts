/**
 * Reexporta tipos TMS puros de models/dto (compat com imports existentes em tms/).
 */
export type {
  ServerIdentification,
  TmsAuth,
  BatchInsertResult,
  ImportarListaProdutoError,
  ImportarListaProdutosResult,
  TmsDcbRecord,
  TmsAuxiliaryEntity,
  AuxiliaryMigracaoEntity,
  AuxiliaryExistenceCatalogs,
  ProductExistenceCatalogs,
  InsertLoteMedicamentoInput,
  SalvarListaEstoquesOutcome,
  SalvarListaEstoquesResult,
} from '../../models/tms.model.js'

export type { ImportacaoEstoqueDto } from '../../dto/tms.dto.js'
