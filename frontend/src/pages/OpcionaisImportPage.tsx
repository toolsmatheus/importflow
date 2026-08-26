import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Barcode,
  Building2,
  CalendarClock,
  ChevronRight,
  Layers,
  Package,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OptionalImportPanel } from '@/components/OptionalImportPanel'
import {
  OPTIONAL_IMPORT_META,
} from '@/lib/optionalImportMeta'
import {
  getOptionalTheme,
  OPTIONAL_THEMES,
  type OptionalThemeId,
} from '@/lib/optionalImportThemes'
import { cn } from '@/lib/utils'
import type { OptionalImportKind } from '@/types'

const THEME_ICONS: Record<OptionalThemeId, typeof Package> = {
  produtos: Package,
  favorecidos: Users,
  financeiro: Wallet,
}

const KIND_ICONS: Record<OptionalImportKind, typeof Warehouse> = {
  barcodes: Barcode,
  supplierRefs: Building2,
  validity: CalendarClock,
  stock: Warehouse,
  lots: Layers,
}

type View =
  | { level: 'themes' }
  | { level: 'kinds'; themeId: OptionalThemeId }
  | { level: 'import'; themeId: OptionalThemeId; kind: OptionalImportKind }

function Breadcrumb({
  items,
}: {
  items: { label: string; onClick?: () => void }[]
}) {
  return (
    <nav aria-label="Navegação" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 ? <span aria-hidden>/</span> : null}
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="rounded-md px-1 py-0.5 hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </button>
            ) : (
              <span className={cn(isLast && 'font-medium text-foreground')}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export function OpcionaisImportPage() {
  const [view, setView] = useState<View>({ level: 'themes' })

  const theme =
    view.level === 'themes' ? null : getOptionalTheme(view.themeId)

  const activeIcon = useMemo(() => {
    if (view.level !== 'import') return null
    const Icon = KIND_ICONS[view.kind]
    return <Icon className="h-5 w-5" />
  }, [view])

  if (view.level === 'import' && theme) {
    return (
      <OptionalImportPanel
        kind={view.kind}
        icon={activeIcon}
        themeLabel={theme.label}
        onBack={() => setView({ level: 'kinds', themeId: view.themeId })}
        onBackToThemes={() => setView({ level: 'themes' })}
      />
    )
  }

  if (view.level === 'kinds' && theme) {
    const ThemeIcon = THEME_ICONS[theme.id]
    return (
      <div className="space-y-5">
        <div className="space-y-3">
          <Breadcrumb
            items={[
              { label: 'Opcionais', onClick: () => setView({ level: 'themes' }) },
              { label: theme.label },
            ]}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <ThemeIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{theme.label}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{theme.description}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setView({ level: 'themes' })}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Temas
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          {theme.kinds.map((kind) => {
            const meta = OPTIONAL_IMPORT_META[kind]
            const Icon = KIND_ICONS[kind]
            return (
              <button
                key={kind}
                type="button"
                onClick={() =>
                  setView({ level: 'import', themeId: theme.id, kind })
                }
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Opcionais</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Importações complementares, fora do fluxo principal.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {OPTIONAL_THEMES.map((item) => {
          const Icon = THEME_ICONS[item.id]
          const disabled = !item.available
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!item.available) return
                setView({ level: 'kinds', themeId: item.id })
              }}
              className={cn(
                'group flex h-full flex-col rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all',
                !disabled &&
                  'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                disabled && 'cursor-not-allowed opacity-60'
              )}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <span
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-2xl',
                    disabled
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground'
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
                {disabled ? (
                  <Badge variant="outline">{item.comingSoonHint ?? 'Em breve'}</Badge>
                ) : (
                  <Badge variant="secondary">{item.importCount} importações</Badge>
                )}
              </div>

              <p className="text-lg font-semibold tracking-tight text-foreground">{item.label}</p>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">
                  {disabled ? 'Indisponível' : 'Abrir tema'}
                </span>
                {!disabled ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
