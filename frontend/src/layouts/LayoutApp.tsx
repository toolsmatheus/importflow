import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { Package, Puzzle, Settings, Download } from 'lucide-react'
import { Toaster } from 'sonner'
import { cn } from '@/components'
import { MenuModelos } from '@/components/shared/MenuModelos'

const NAV = [
  { path: '/import/produtos', label: 'Produtos', match: '/import/produtos', icon: Package },
  { path: '/import/opcionais', label: 'Opcionais', match: '/import/opcionais', icon: Puzzle },
  { path: '/settings', label: 'Configurações', match: '/settings', icon: Settings },
] as const

export function LayoutApp() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/import/produtos')}
            className="flex shrink-0 items-center gap-2 text-fg-strong"
            aria-label="ImportFlow"
          >
            <img
              src="/brand/lockup-horizontal-color.png"
              alt="ToolsPharma"
              className="hidden h-7 w-auto object-contain object-left sm:block"
            />
            <img
              src="/brand/symbol-color.png"
              alt=""
              className="h-7 w-7 object-contain sm:hidden"
            />
            <span className="text-sm font-semibold tracking-tight">ImportFlow</span>
          </button>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Principal">
            {NAV.map(({ path, label, match, icon: Icon }) => {
              const ativo = location.pathname.startsWith(match)
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => navigate(path)}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors',
                    ativo
                      ? 'bg-action-subtle font-semibold text-action'
                      : 'text-fg-muted hover:bg-surface-muted hover:text-fg-strong'
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              )
            })}
          </nav>

          <div className="shrink-0">
            <MenuModelos
              trigger={
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg-strong"
                  aria-label="Modelos"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Modelos</span>
                </button>
              }
            />
          </div>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      <Toaster position="top-right" richColors closeButton theme="light" />
    </div>
  )
}
