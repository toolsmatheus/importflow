import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { produtoServico } from '@/api/produto'
import { OPCIONAL_TEMPLATE_URL } from '@/api/opcional'
import {
  OPTIONAL_IMPORT_META,
  OPTIONAL_IMPORT_READY_KINDS,
} from '@/lib/optionalImportMeta'
import type { AuxiliaryEntity } from '@/types'

const AUXILIARY_MODELS: { entity: AuxiliaryEntity; label: string }[] = [
  { entity: 'grupo', label: 'Grupo' },
  { entity: 'subgrupo', label: 'Subgrupo' },
  { entity: 'categoria', label: 'Categoria' },
  { entity: 'laboratorio', label: 'Laboratório' },
  { entity: 'grupodepreco', label: 'Grupo de preço' },
  { entity: 'similar', label: 'Similar' },
  { entity: 'dcb', label: 'DCB' },
]

const OPCIONAL_MODELS = OPTIONAL_IMPORT_READY_KINDS.flatMap((kind) => {
  const url = OPCIONAL_TEMPLATE_URL[kind]
  if (!url) return []
  return [{ kind, label: OPTIONAL_IMPORT_META[kind].shortLabel, url }]
})

interface MenuModelosProps {
  /** Substitui o botão padrão (ex.: item da Sidebar). */
  trigger?: ReactElement<{ onClick?: (event: React.MouseEvent) => void }>
}

export function MenuModelos({ trigger }: MenuModelosProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const defaultTrigger = (
    <button
      type="button"
      className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg-strong"
      aria-expanded={open}
      aria-haspopup="menu"
    >
      <Download className="h-4 w-4" />
      <span>Modelos</span>
    </button>
  )

  const triggerNode = isValidElement(trigger) ? trigger : defaultTrigger
  const triggerEl = cloneElement(triggerNode, {
    onClick: (event: React.MouseEvent) => {
      triggerNode.props.onClick?.(event)
      setOpen((v) => !v)
    },
  })

  return (
    <div ref={rootRef} className="relative">
      {triggerEl}

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-fg hover:bg-surface-muted"
            onClick={() => {
              produtoServico.downloadTemplate()
              toast.success('Download do modelo de produtos iniciado')
              setOpen(false)
            }}
          >
            <Download className="h-3.5 w-3.5 text-fg-muted" />
            Produtos
          </button>

          <div className="my-1 border-t border-line" />
          <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-label text-fg-muted">
            Auxiliares
          </p>

          {AUXILIARY_MODELS.map(({ entity, label }) => (
            <button
              key={entity}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg hover:bg-surface-muted"
              onClick={() => {
                produtoServico.downloadAuxiliaryTemplate(entity)
                setOpen(false)
              }}
            >
              <Download className="h-3.5 w-3.5 text-fg-muted" />
              {label}
            </button>
          ))}

          {OPCIONAL_MODELS.length > 0 ? (
            <>
              <div className="my-1 border-t border-line" />
              <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-label text-fg-muted">
                Etapa 2
              </p>
              {OPCIONAL_MODELS.map(({ kind, label, url }) => (
                <a
                  key={kind}
                  role="menuitem"
                  href={url}
                  download
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg hover:bg-surface-muted"
                  onClick={() => {
                    toast.success(`Download do modelo de ${label} iniciado`)
                    setOpen(false)
                  }}
                >
                  <Download className="h-3.5 w-3.5 text-fg-muted" />
                  {label}
                </a>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
