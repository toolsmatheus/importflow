import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { ChevronDown, Download } from 'lucide-react'
import { Toaster } from 'sonner'
import { Button, cn } from '@/components'
import { MenuModelos } from '@/components/shared/MenuModelos'

const PRODUTOS_OPCOES = [
  { path: '/import/produtos', label: 'Etapa 1' },
  { path: '/import/opcionais', label: 'Etapa 2' },
] as const

export function LayoutApp() {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuAberto, setMenuAberto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const ativoProdutos = location.pathname.startsWith('/import/produtos')
  const ativoOpcionais = location.pathname.startsWith('/import/opcionais')
  const emAreaProdutos = ativoProdutos || ativoOpcionais
  const rotuloAtual = ativoOpcionais ? 'Etapa 2' : 'Etapa 1'

  useEffect(() => {
    if (!menuAberto) return
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuAberto(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAberto(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuAberto])

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="sticky top-0 z-40 border-b border-line bg-surface shadow-[0_1px_0_0_var(--color-line)]">
        <div className="mx-auto flex h-16 max-w-6xl items-stretch gap-6 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/import/produtos')}
            className="flex shrink-0 flex-col items-start self-center leading-none outline-none focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            aria-label="ToolsDataWeb"
          >
            <span
              className="text-[1.35rem] font-normal tracking-[0.06em] text-fg-strong"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              TOOLSDATAWEB
            </span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-label text-fg-subtle">
              ToolsPharma
            </span>
          </button>

          <div className="mx-1 hidden w-px self-center bg-line sm:block" aria-hidden />

          <nav className="flex min-w-0 flex-1 items-stretch" aria-label="Principal">
            <div ref={menuRef} className="relative flex items-stretch">
              <button
                type="button"
                onClick={() => setMenuAberto((v) => !v)}
                className={cn(
                  'relative inline-flex items-center gap-1.5 px-3 text-sm transition-colors sm:px-4',
                  emAreaProdutos
                    ? 'font-semibold text-fg-strong'
                    : 'font-medium text-fg-muted hover:text-fg-strong'
                )}
                aria-expanded={menuAberto}
                aria-haspopup="menu"
              >
                Produtos
                <span className="hidden font-normal text-fg-muted sm:inline">· {rotuloAtual}</span>
                <ChevronDown
                  className={cn('h-3.5 w-3.5 text-fg-muted transition-transform', menuAberto && 'rotate-180')}
                  aria-hidden
                />
                {emAreaProdutos ? (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-action sm:inset-x-4" />
                ) : null}
              </button>

              {menuAberto ? (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-50 mt-1 min-w-[11rem] overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
                >
                  {PRODUTOS_OPCOES.map((opcao) => {
                    const ativo = location.pathname.startsWith(opcao.path)
                    return (
                      <button
                        key={opcao.path}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          navigate(opcao.path)
                          setMenuAberto(false)
                        }}
                        className={cn(
                          'flex w-full px-3 py-2 text-left text-sm transition-colors',
                          ativo
                            ? 'bg-action-subtle font-semibold text-action'
                            : 'text-fg hover:bg-surface-muted'
                        )}
                      >
                        {opcao.label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
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
