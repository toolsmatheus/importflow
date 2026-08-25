import type { OptionalImportKind } from '@/types'

export interface OptionalImportMeta {
  id: OptionalImportKind
  title: string
  shortLabel: string
  description: string
  columns: string[]
  /** Exemplo de 1ª linha (valores ilustrativos). */
  sampleRow: string[]
  sourceHint: string
  exampleFileName: string
  /** Quando usar esta importação. */
  whenToUse: string
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
    description: 'EANs extras além do código de barras principal do produto.',
    columns: ['codigo', 'codigobarras', 'codigoadicional', 'fator'],
    sampleRow: ['', '7891234567890', '7891234567891', '1'],
    sourceHint:
      'codigo (migração) é opcional. Localize o produto por codigobarras (EAN principal) ou por codigo; codigoadicional = EAN a cadastrar; fator = conversão.',
    exampleFileName: 'codigos-barras-adicionais.csv',
    whenToUse: 'Depois que os produtos já estiverem no banco.',
  },
  supplierRefs: {
    id: 'supplierRefs',
    title: 'Referências de fornecedor',
    shortLabel: 'Fornecedor',
    description: 'Códigos do fornecedor (CodigoFornecedor) ligados ao produto.',
    columns: ['codigo', 'codigobarras', 'codigofornecedor', 'codigooriginal', 'fator'],
    sampleRow: ['', '7891234567890', '88001', 'CAT-12345', '1'],
    sourceHint:
      'codigo (migração do produto) é opcional — localiza por codigobarras ou codigo. codigofornecedor = codigo_migracao do favorecido/fornecedor; codigooriginal = código do produto no catálogo do fornecedor; fator = fatorCompra (inteiro).',
    exampleFileName: 'codigos-fornecedor.csv',
    whenToUse: 'Depois que os produtos já estiverem no banco.',
  },
  validity: {
    id: 'validity',
    title: 'Validade dos produtos',
    shortLabel: 'Validade',
    description: 'Datas de validade por produto (lote opcional).',
    columns: ['codigo', 'validade', 'lote'],
    sampleRow: ['1001', '31/12/2027', 'L2026A'],
    sourceHint: 'Formato de data preferencial: DD/MM/AAAA. Lote pode ficar em branco.',
    exampleFileName: 'validade-produtos.csv',
    whenToUse: 'Quando precisar atualizar validade sem reenviar o produto.',
  },
  stock: {
    id: 'stock',
    title: 'Importação de estoque',
    shortLabel: 'Estoque',
    description: 'Atualiza quantidades. Aceita o Produto.csv (coluna estoque).',
    columns: ['codigo', 'estoque'],
    sampleRow: ['1001', '24'],
    sourceHint: 'Pode enviar só codigo;estoque ou o CSV completo de produtos da migração.',
    exampleFileName: 'Produto.csv',
    whenToUse: 'Após o cadastro dos produtos (o estoque não vai no envio principal).',
  },
  lots: {
    id: 'lots',
    title: 'Lotes de controlados',
    shortLabel: 'Lotes',
    description: 'Lotes SNGPC: número, validade, quantidade e registro MS.',
    columns: ['codigo', 'lote', 'validade', 'quantidade', 'registroms'],
    sampleRow: ['1001', 'A12', '30/06/2027', '30', '1234567890123'],
    sourceHint: 'Somente produtos controlados já cadastrados com lista de controle.',
    exampleFileName: 'lotes-controlados.csv',
    whenToUse: 'Depois dos controlados importados na aba Produtos.',
  },
}
