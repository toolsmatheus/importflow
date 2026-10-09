import type { OptionalImportKind } from '@/types'
import {
  OPTIONAL_FILE_ALIASES,
  OPTIONAL_IMPORT_KINDS,
  OPTIONAL_IMPORT_READY,
  OPTIONAL_IMPORT_READY_KINDS,
} from '@models/opcional.model'

export type { OptionalImportKind }
export {
  OPTIONAL_FILE_ALIASES,
  OPTIONAL_IMPORT_KINDS,
  OPTIONAL_IMPORT_READY,
  OPTIONAL_IMPORT_READY_KINDS,
}

export interface OptionalImportMeta {
  id: OptionalImportKind
  title: string
  shortLabel: string
  /** Uma linha: o que esta importação faz. */
  description: string
  columns: string[]
  sampleRow: string[]
  /** Dica curta das colunas (sem repetir o título). */
  sourceHint: string
  exampleFileName: string
}

export const OPTIONAL_IMPORT_META: Record<OptionalImportKind, OptionalImportMeta> = {
  barcodeExtras: {
    id: 'barcodeExtras',
    title: 'Código de barra adicional',
    shortLabel: 'Barras adicionais',
    description: 'EANs extras do produto (listacodigobarras).',
    columns: ['codigo_migracao', 'codigobarra', 'codigoadicional', 'fator'],
    sampleRow: ['1001', '7891234567890', '7891234567891', '1'],
    sourceHint:
      'Busca por codigo_migracao, senão codigobarra. codigoadicional obrigatório; fator vazio → 1.',
    exampleFileName: 'CodigosAdicionais.csv',
  },
  supplierRefs: {
    id: 'supplierRefs',
    title: 'Códigos de fornecedores',
    shortLabel: 'Fornecedores',
    description: 'Códigos do fornecedor ligados ao produto.',
    columns: [
      'codigo_migracao',
      'codigobarra',
      'codigoprodutofornecedor',
      'codigofornecedor',
      'fator',
    ],
    sampleRow: ['1001', '7891234567890', 'CAT-12345', '88001', '1'],
    sourceHint:
      'Busca por codigo_migracao, senão codigobarra. codigofornecedor = migração do favorecido; fator vazio → 1.',
    exampleFileName: 'CodigoFornecedor.csv',
  },
  stock: {
    id: 'stock',
    title: 'Estoque',
    shortLabel: 'Estoque',
    description: 'Quantidade > 0 para não controlados (lote INT000).',
    columns: ['codigo', 'codigobarras', 'estoque'],
    sampleRow: ['1001', '7891234567890', '24'],
    sourceHint:
      'Use codigo e/ou codigobarras + estoque. Controlados e qtd ≤ 0 são ignorados.',
    exampleFileName: 'estoque.csv',
  },
  lots: {
    id: 'lots',
    title: 'Lotes',
    shortLabel: 'Lotes',
    description: 'Lote, registro MS, estoque, fabricação e validade (controlados).',
    columns: [
      'codigo',
      'codigobarras',
      'lote',
      'registroms',
      'estoque',
      'fabricacao',
      'validade',
    ],
    sampleRow: [
      '1001',
      '7891234567890',
      'A12',
      '1234567890123',
      '30',
      '15/01/2024',
      '30/06/2027',
    ],
    sourceHint:
      'Busca por codigo (migração), senão codigobarras. Datas dd/mm/yyyy. Não controlados → use Estoque.',
    exampleFileName: 'lotes.csv',
  },
  priceUpdate: {
    id: 'priceUpdate',
    title: 'Atualização de preço',
    shortLabel: 'Preço',
    description: 'Atualiza preços dos produtos.',
    columns: ['codigo', 'preco'],
    sampleRow: ['1001', '19.90'],
    sourceHint: 'Em breve.',
    exampleFileName: 'preco.csv',
  },
  paymentDiscount: {
    id: 'paymentDiscount',
    title: 'Desconto por condição de pagamento',
    shortLabel: 'Desconto',
    description: 'Descontos por condição de pagamento.',
    columns: ['codigo', 'condicao', 'desconto'],
    sampleRow: ['1001', '30', '5'],
    sourceHint: 'Em breve.',
    exampleFileName: 'desconto.csv',
  },
  validity: {
    id: 'validity',
    title: 'Validade',
    shortLabel: 'Validade',
    description: 'Validade e quantidade para não controlados (dd/mm/yyyy).',
    columns: ['codigo', 'validade', 'quantidade'],
    sampleRow: ['1001', '31/12/2027', '24'],
    sourceHint: 'codigo = codigo_migracao. Controlados são ignorados (use Lotes).',
    exampleFileName: 'validade.csv',
  },
}
