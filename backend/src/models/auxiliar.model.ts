import type { AuxiliaryEntity } from './produto.model.js'

export type AuxiliaryCatalog = Map<string, string>

export type AuxiliaryCatalogs = Partial<Record<AuxiliaryEntity, AuxiliaryCatalog>>

/**
 * Campo do CSV → entidade do arquivo auxiliar.
 * `codigogrupo` é obrigatório no produto; o restante só se a coluna existir.
 */
export const FIELD_TO_AUXILIARY: Record<string, AuxiliaryEntity> = {
  codigogrupo: 'grupo',
  subgrupo: 'subgrupo',
  categoria: 'categoria',
  laboratorio: 'laboratorio',
  grupodepreco: 'grupodepreco',
  similar: 'similar',
  dcb: 'dcb',
}
