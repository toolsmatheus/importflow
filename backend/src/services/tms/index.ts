export { DEFAULT_TMS_BASE, TMS_AUTH_SUFFIX, getDefaultTmsBaseUrl } from './tmsConfig.js'

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
  ImportacaoEstoqueDto,
  SalvarListaEstoquesOutcome,
  SalvarListaEstoquesResult,
} from './tmsTypes.js'

export {
  buildTmsBasicAuthorization,
  buscarIdentificacaoServidor,
  obterAuthTms,
  invalidateTmsAuth,
} from './tmsAuth.js'

export {
  AUXILIARY_TMS_PATH,
  insertAuxiliaryEntity,
  AUXILIARY_MIGRACAO_ENTITIES,
  fetchAuxiliaryExistenceCatalogs,
  auxiliaryMigracaoExists,
  markAuxiliaryMigracaoExists,
} from './tmsAuxiliary.js'

export {
  insertProduto,
  parseImportarListaResponse,
  importarListaProdutos,
} from './tmsProductImport.js'

export { insertAliquotaIcms, garantirAliquotaPercentual, garantirAliquotasTaxaZero } from './tmsFiscal.js'

export {
  insertCodigoBarraProduto,
  fetchCodigoBarraProdutoRows,
  insertCodigoFornecedor,
  fetchFavorecidoMigracaoKeys,
  favorecidoMigracaoExists,
  parseFavorecidoMigracao,
  fetchProductCodigoFornecedorKeys,
  insertLocalizacaoProduto,
  ensureLocalizacaoProduto,
} from './tmsProductExtras.js'

export {
  buscarCatalogosLookupProduto,
  fetchTmsDcbCatalog,
  usableMigracaoCodigo,
  resolveProdutoIdFromCsv,
  fetchProdutoIdByMigracaoOrBarcode,
  buscarCatalogosExistenciaProduto,
} from './tmsProductCatalog.js'

export { insertValidadeSistemaAntigo } from './tmsValidity.js'

export { salvarListaEstoques } from './tmsStock.js'

export {
  findRegistroMsId,
  findLoteMedicamento,
  insertLoteMedicamento,
  setLoteMedicamentoQuantidade,
} from './tmsLots.js'
