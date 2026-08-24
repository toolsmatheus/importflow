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
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-foreground">Importação</h1>

      <div
        role="tablist"
        aria-label="Tipos de importação"
        className="mb-6 flex flex-wrap gap-1 border-b border-border pb-px"
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
                  'inline-flex items-center gap-2 rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors',
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
