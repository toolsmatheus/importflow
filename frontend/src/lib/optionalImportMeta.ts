import type { OptionalImportKind } from '@/types'

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

export const OPTIONAL_IMPORT_KINDS: OptionalImportKind[] = [
  'barcodes',
  'supplierRefs',
  'validity',
  'stock',
  'lots',
]

export const OPTIONAL_IMPORT_META: Record<OptionalImportKind, OptionalImportMeta> = {
  barcodes: {
    id: 'barcodes',
    title: 'Códigos de barras adicionais',
    shortLabel: 'Barras+',
    description: 'EANs extras além do código de barras principal.',
    columns: ['codigo', 'codigobarras', 'codigoadicional', 'fator'],
    sampleRow: ['', '7891234567890', '7891234567891', '1'],
    sourceHint:
      'Localize por codigobarras ou codigo; codigoadicional = EAN novo; fator = conversão.',
    exampleFileName: 'codigos-barras-adicionais.csv',
  },
  supplierRefs: {
    id: 'supplierRefs',
    title: 'Referências de fornecedor',
    shortLabel: 'Fornecedor',
    description: 'Códigos do fornecedor ligados ao produto.',
    columns: ['codigo', 'codigobarras', 'codigofornecedor', 'codigooriginal', 'fator'],
    sampleRow: ['', '7891234567890', '88001', 'CAT-12345', '1'],
    sourceHint:
      'codigofornecedor = migração do favorecido; codigooriginal = código no catálogo; fator = fatorCompra.',
    exampleFileName: 'codigos-fornecedor.csv',
  },
  validity: {
    id: 'validity',
    title: 'Validade dos produtos',
    shortLabel: 'Validade',
    description: 'Validade e quantidade para não controlados (dd/mm/yyyy).',
    columns: ['codigo', 'validade', 'quantidade'],
    sampleRow: ['1001', '31/12/2027', '24'],
    sourceHint: 'codigo = codigo_migracao. Controlados são ignorados (use Lotes).',
    exampleFileName: 'validade-produtos.csv',
  },
  stock: {
    id: 'stock',
    title: 'Importação de estoque',
    shortLabel: 'Estoque',
    description: 'Quantidade > 0 para não controlados (lote INT000).',
    columns: ['codigo', 'codigobarras', 'estoque'],
    sampleRow: ['1001', '7891234567890', '24'],
    sourceHint:
      'Use codigo e/ou codigobarras + estoque. Controlados e qtd ≤ 0 são ignorados.',
    exampleFileName: 'Produto.csv',
  },
  lots: {
    id: 'lots',
    title: 'Lotes de controlados',
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
    exampleFileName: 'lotes-controlados.csv',
  },
}
