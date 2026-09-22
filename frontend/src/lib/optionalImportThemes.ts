import type { OptionalImportKind } from '@/types'
import { OPTIONAL_IMPORT_KINDS } from '@/lib/optionalImportMeta'

export type OptionalThemeId = 'produtos'

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
    description: 'Fornecedor, validade, estoque e lotes de controlados.',
    importCount: OPTIONAL_IMPORT_KINDS.length,
    available: true,
    kinds: [...OPTIONAL_IMPORT_KINDS],
  },
]

export function getOptionalTheme(id: OptionalThemeId): OptionalThemeMeta {
  return OPTIONAL_THEMES.find((t) => t.id === id) ?? OPTIONAL_THEMES[0]
}
