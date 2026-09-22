import { useMemo, useState } from 'react'
import {
  Building2,
  CalendarClock,
  ChevronRight,
  Layers,
  Warehouse,
} from 'lucide-react'
import { OptionalImportPanel } from '@/components/OptionalImportPanel'
import { OPTIONAL_IMPORT_META } from '@/lib/optionalImportMeta'
import { OPTIONAL_THEMES, type OptionalThemeId } from '@/lib/optionalImportThemes'
import { cn } from '@/lib/utils'
import type { OptionalImportKind } from '@/types'

const KIND_ICONS: Record<OptionalImportKind, typeof Warehouse> = {
  supplierRefs: Building2,
  validity: CalendarClock,
  stock: Warehouse,
  lots: Layers,
}

const DEFAULT_THEME_ID: OptionalThemeId =
  OPTIONAL_THEMES.find((t) => t.available)?.id ?? OPTIONAL_THEMES[0].id

type View =
  | { level: 'kinds' }
  | { level: 'import'; kind: OptionalImportKind }

export function OpcionaisImportPage() {
  const [view, setView] = useState<View>({ level: 'kinds' })
  const theme = OPTIONAL_THEMES.find((t) => t.id === DEFAULT_THEME_ID) ?? OPTIONAL_THEMES[0]

  const activeIcon = useMemo(() => {
    if (view.level !== 'import') return null
    const Icon = KIND_ICONS[view.kind]
    return <Icon className="h-5 w-5" />
  }, [view])

  if (view.level === 'import') {
    return (
      <OptionalImportPanel
        kind={view.kind}
        icon={activeIcon}
        themeLabel={theme.label}
        onBack={() => setView({ level: 'kinds' })}
        onBackToThemes={() => setView({ level: 'kinds' })}
      />
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{theme.description}</p>

      <div className="grid gap-2">
        {theme.kinds.map((kind) => {
          const meta = OPTIONAL_IMPORT_META[kind]
          const Icon = KIND_ICONS[kind]
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setView({ level: 'import', kind })}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition-all sm:px-4',
                'hover:border-primary/40 hover:bg-accent/20',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{meta.title}</span>
                <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                  {meta.description}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
