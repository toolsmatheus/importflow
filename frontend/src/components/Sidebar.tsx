import type { ComponentProps, ReactNode } from 'react'
import { cn } from './cn'

/** Contêiner fixo da barra lateral: segura a barra e a abinha de recolher. */
export function SidebarWrap({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('sticky top-0 z-10 hidden h-screen shrink-0 sm:block', className)} {...props} />
}

interface SidebarProps extends ComponentProps<'aside'> {
  recolhida?: boolean
}

/** Barra lateral clara. Recolhida, mostra só ícones: o nome acessível fica no aria-label de cada item. */
export function Sidebar({ recolhida = false, className, ...props }: SidebarProps) {
  return (
    <aside
      data-recolhida={recolhida ? 'true' : undefined}
      className={cn(
        'group/sidebar flex h-full w-56 flex-col overflow-y-auto border-r border-line bg-surface px-2 py-6 ' +
          'data-[recolhida=true]:w-16 data-[recolhida=true]:px-2',
        className,
      )}
      {...props}
    />
  )
}

/** Marca no topo da barra (logo + nome do produto); some quando a barra está recolhida. */
export function SidebarBrand({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mb-6 flex flex-col items-center gap-1 px-3 group-data-[recolhida=true]/sidebar:hidden', className)} {...props} />
}

export function SidebarLogo({ className, alt = '', ...props }: ComponentProps<'img'>) {
  // O PNG tem cerca de metade de área vazia no topo; o corte mostra só a região com o desenho.
  return <img alt={alt} className={cn('aspect-[732/175] w-36 object-cover object-bottom', className)} {...props} />
}

export function SidebarBrandNome({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('text-center text-xs font-semibold uppercase tracking-label text-fg-muted', className)} {...props} />
}

export function SidebarNav({ className, ...props }: ComponentProps<'nav'>) {
  return <nav className={cn('flex flex-col gap-1', className)} {...props} />
}

interface SidebarItemProps extends ComponentProps<'button'> {
  ativo?: boolean
  /** Ícone à esquerda do rótulo; permanece visível com a barra recolhida. */
  icone?: ReactNode
}

/** Item de navegação (ou ação, como "Sair"). O ativo aparece em pill. Os children são o rótulo, escondido com a barra recolhida. */
export function SidebarItem({ ativo = false, icone, type = 'button', className, children, ...props }: SidebarItemProps) {
  return (
    <button
      type={type}
      data-state={ativo ? 'active' : undefined}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-3 py-2.5 text-left text-sm font-medium text-fg-muted transition-colors ' +
          'hover:bg-surface-muted hover:text-fg-strong data-[state=active]:bg-action-subtle data-[state=active]:font-semibold data-[state=active]:text-action ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
          'group-data-[recolhida=true]/sidebar:justify-center group-data-[recolhida=true]/sidebar:px-0 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {icone}
      {icone ? <SidebarRotulo>{children}</SidebarRotulo> : children}
    </button>
  )
}

/** Texto do item; escondido com a barra recolhida. */
export function SidebarRotulo({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('group-data-[recolhida=true]/sidebar:hidden', className)} {...props} />
}

interface SidebarAbaProps extends ComponentProps<'button'> {
  recolhida?: boolean
}

/** Abinha na borda direita da barra, para recolher/expandir sem ocupar um item do menu. A seta acompanha o estado. */
export function SidebarAba({ recolhida = false, type = 'button', className, ...props }: SidebarAbaProps) {
  return (
    <button
      type={type}
      aria-expanded={!recolhida}
      // Sobrepõe 1px da borda da barra: o fundo da aba "apaga" a linha nesse trecho e as duas formas parecem uma só.
      style={{ left: 'calc(100% - 1px)' }}
      className={cn(
        'absolute top-8 flex h-10 w-5 cursor-pointer items-center justify-center rounded-r-md border border-l-0 border-line bg-surface p-0 text-fg-muted transition-colors ' +
          'hover:bg-surface-muted hover:text-fg-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        className,
      )}
      {...props}
    >
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polyline points={recolhida ? '7,4 13,10 7,16' : '13,4 7,10 13,16'} />
      </svg>
    </button>
  )
}
