/** Catálogos TMS usados para montar refs `@xdata.ref` no insert de produto. */
export interface CatalogosBuscaProduto {
  grupoByMigracao: Map<string, number>
  subgrupoByMigracao: Map<string, number>
  categoriaByMigracao: Map<string, number>
  laboratorioByMigracao: Map<string, number>
  grupodeprecoByMigracao: Map<string, number>
  /** descrição UPPER → id TMS */
  similarByDescricao: Map<string, number>
  /** código do CSV auxiliar similar → descrição */
  similarCodigoToDescricao: Map<string, string>
  /** código Anvisa DCB (padded e raw) → id TMS */
  dcbByCode: Map<string, number>
  /** descrição UPPER → id TMS (preferindo código Anvisa limpo) */
  dcbByDescricao: Map<string, number>
  /** código do CSV auxiliar dcb → descrição */
  dcbCodigoToDescricao: Map<string, string>
  unidadeUnId: number
  /** percentual ICMS (≠ 0) → id AliquotaICMS tipICMS */
  aliquotaByPercent: Map<number, number>
  aliquotaStId: number
  aliquotaIsentoId: number
  aliquotaSemIncidenciaId: number
  /** CFOP string → id preferido (com descrição quando houver) */
  cfopByCode: Map<string, number>
  /** descrição UPPER → id LocalizacaoProduto */
  localizacaoByDescricao: Map<string, number>
}

export interface MapProductResult {
  ok: true
  payload: Record<string, unknown>
  /** Avisos que não impedem o insert (ex.: DCB omitido em controlado). */
  warnings?: string[]
}

export interface MapProductError {
  ok: false
  message: string
}
