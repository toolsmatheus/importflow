import { NavLink, Outlet } from 'react-router-dom'
import { Package, Users, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

const IMPORT_TABS = [
  {
    to: '/import/produtos',
    label: 'Produtos',
    icon: Package,
  },
  {
    to: '/import/favorecidos',
    label: 'Favorecidos',
    icon: Users,
  },
  {
    to: '/import/financeiro',
    label: 'Financeiro',
    icon: Wallet,
  },
] as const

export function ImportPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Importação</h1>
        <p className="mt-1 text-muted-foreground">
          Escolha o tipo de importação. Por enquanto apenas produtos está ativo no backend.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Tipos de importação"
        className="mb-8 flex flex-wrap gap-2 border-b border-border pb-px"
      >
        {IMPORT_TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              role="tab"
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-t-lg border border-transparent px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? '-mb-px border-border border-b-background bg-card text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </NavLink>
          )
        })}
      </div>

      <Outlet />
    </div>
  )
}
