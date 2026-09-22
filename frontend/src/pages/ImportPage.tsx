import { NavLink, Outlet } from 'react-router-dom'
import { Package, Puzzle } from 'lucide-react'
import { cn } from '@/lib/utils'

const IMPORT_TABS = [
  {
    to: '/import/produtos',
    label: 'Produtos',
    icon: Package,
  },
  {
    to: '/import/opcionais',
    label: 'Opcionais',
    icon: Puzzle,
  },
] as const

export function ImportPage() {
  return (
    <div>
      <div
        role="tablist"
        aria-label="Fluxos de importação"
        className="mb-6 flex gap-6 border-b border-border"
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
                  'relative -mb-px inline-flex items-center gap-2 border-b-2 pb-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
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
