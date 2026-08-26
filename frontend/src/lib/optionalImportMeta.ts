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
    description:
      'Importa validade/quantidade só para produtos não controlados (tipoclassesngpc = tcNenhuma).',
    columns: ['codigo', 'validade', 'quantidade'],
    sampleRow: ['1001', '31/12/2027', '24'],
    sourceHint:
      'codigo = codigo_migracao do produto; validade em dd/mm/yyyy; quantidade = inteiro. Controlados são ignorados.',
    exampleFileName: 'validade-produtos.csv',
    whenToUse: 'Depois que os produtos já estiverem no banco. Não preenche controlados (use Lotes).',
  },
  stock: {
    id: 'stock',
    title: 'Importação de estoque',
    shortLabel: 'Estoque',
    description:
      'Estoque (> 0) para não controlados via ImportacaoProdutoService/SalvarListaEstoques (lote INT000).',
    columns: ['codigo', 'codigobarras', 'estoque'],
    sampleRow: ['1001', '7891234567890', '24'],
    sourceHint:
      'Produto.csv: codigo + estoque (resolve IdProduto). Layout barras (Delphi): codigobarras + quantidade (> 0). Controlados e qtd ≤ 0 são ignorados.',
    exampleFileName: 'Produto.csv',
    whenToUse:
      'Após o cadastro dos produtos. Usa o mesmo serviço XData da importação Delphi.',
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
