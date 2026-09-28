import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Download } from 'lucide-react'
import { productService } from '@/services/productService'
import { cn } from '@/lib/utils'
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

export function ModelsMenu() {
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors',
          'hover:bg-muted hover:text-foreground',
          open && 'bg-muted text-foreground'
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Modelos</span>
        <ChevronDown className={cn('h-3.5 w-3.5', open && 'rotate-180')} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              productService.downloadTemplate()
              toast.success('Download do modelo de produtos iniciado')
              setOpen(false)
            }}
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            Produtos
          </button>

          <div className="my-1 border-t border-border" />
          <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Auxiliares
          </p>

          {AUXILIARY_MODELS.map(({ entity, label }) => (
            <button
              key={entity}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                productService.downloadAuxiliaryTemplate(entity)
                setOpen(false)
              }}
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
