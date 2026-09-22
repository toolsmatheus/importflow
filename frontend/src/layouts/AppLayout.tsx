import { Link, Outlet } from 'react-router-dom'
import { Package, Settings } from 'lucide-react'
import { Toaster } from 'sonner'
import { ModelsMenu } from '@/components/ModelsMenu'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTheme } from '@/hooks/useTheme'

export function AppLayout() {
  const { resolvedTheme } = useTheme()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/import/produtos" className="flex items-center gap-2 text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Package className="h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight">ImportFlow</span>
          </Link>
          <div className="flex items-center gap-1">
            <ModelsMenu />
            <ThemeToggle compact />
            <Link
              to="/settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Configurações"
              title="Configurações"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>

      <Toaster position="top-right" richColors closeButton theme={resolvedTheme} />
    </div>
  )
}
