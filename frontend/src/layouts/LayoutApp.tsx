import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { Download } from 'lucide-react'
import { Toaster } from 'sonner'
import { Button, cn } from '@/components'
import { MenuModelos } from '@/components/shared/MenuModelos'

export function LayoutApp() {
  const navigate = useNavigate()
  const location = useLocation()
  const ativoProdutos = location.pathname.startsWith('/import/produtos')

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="sticky top-0 z-40 border-b border-line bg-surface shadow-[0_1px_0_0_var(--color-line)]">
        <div className="mx-auto flex h-16 max-w-6xl items-stretch gap-6 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/import/produtos')}
            className="flex shrink-0 items-center gap-3 self-center outline-none focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            aria-label="ToolsDataWeb"
          >
            <img
              src="/brand/symbol-color.png"
              alt=""
              className="h-8 w-8 object-contain"
            />
            <span className="flex flex-col items-start leading-none">
              <span
                className="text-[1.35rem] font-normal tracking-[0.06em] text-fg-strong"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                TOOLSDATAWEB
              </span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-label text-fg-subtle">
                ToolsPharma
              </span>
            </span>
          </button>

          <div className="mx-1 hidden w-px self-center bg-line sm:block" aria-hidden />

          <nav className="flex min-w-0 flex-1 items-stretch gap-0" aria-label="Principal">
            <button
              type="button"
              onClick={() => navigate('/import/produtos')}
              className={cn(
                'relative inline-flex items-center px-3 text-sm transition-colors sm:px-4',
                ativoProdutos
                  ? 'font-semibold text-fg-strong'
                  : 'font-medium text-fg-muted hover:text-fg-strong'
              )}
              aria-current={ativoProdutos ? 'page' : undefined}
            >
              Produtos
              {ativoProdutos ? (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-action sm:inset-x-4" />
              ) : null}
            </button>

            <button
              type="button"
              disabled
              title="Em breve"
              aria-disabled="true"
              className="relative inline-flex cursor-not-allowed items-center gap-2 px-3 text-sm font-medium text-fg-faint sm:px-4"
            >
              Opcionais
              <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-label text-fg-subtle">
                Em breve
              </span>
            </button>
          </nav>

          <div className="flex shrink-0 items-center self-center">
            <MenuModelos
              trigger={
                <Button variant="secondary" size="sm" aria-label="Baixar modelos">
                  <Download className="h-4 w-4" aria-hidden />
                  Modelos
                </Button>
              }
            />
          </div>
        </div>
        <div
          className="h-0.5 w-full"
          style={{ background: 'var(--tp-gradient-brand, linear-gradient(60deg, #12353B, #009FA9))' }}
          aria-hidden
        />
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
