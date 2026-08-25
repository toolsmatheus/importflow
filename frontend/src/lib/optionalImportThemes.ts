import type { OptionalImportKind } from '@/types'
import { OPTIONAL_IMPORT_KINDS } from '@/lib/optionalImportMeta'

export type OptionalThemeId = 'produtos' | 'favorecidos' | 'financeiro'

export interface OptionalThemeMeta {
  id: OptionalThemeId
  label: string
  description: string
  /** Quantidade de importações disponíveis agora. */
  importCount: number
  available: boolean
  comingSoonHint?: string
  kinds: OptionalImportKind[]
}

export const OPTIONAL_THEMES: OptionalThemeMeta[] = [
  {
    id: 'produtos',
    label: 'Produtos',
    description: 'Barras extras, fornecedor, validade, estoque e lotes de controlados.',
    importCount: OPTIONAL_IMPORT_KINDS.length,
    available: true,
    kinds: [...OPTIONAL_IMPORT_KINDS],
  },
  {
    id: 'favorecidos',
    label: 'Favorecidos',
    description: 'Complementos de fornecedores e favorecidos após o cadastro principal.',
    importCount: 0,
    available: false,
    comingSoonHint: 'Em breve',
    kinds: [],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Ajustes e complementos de títulos e lançamentos.',
    importCount: 0,
    available: false,
    comingSoonHint: 'Em breve',
    kinds: [],
  },
]

export function getOptionalTheme(id: OptionalThemeId): OptionalThemeMeta {
  return OPTIONAL_THEMES.find((t) => t.id === id) ?? OPTIONAL_THEMES[0]
}
