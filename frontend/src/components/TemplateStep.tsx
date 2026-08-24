import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { productService } from '@/services/productService'
import { cn } from '@/lib/utils'

interface TemplateStepProps {
  onContinue: () => void
}

function CollapsibleFields({
  title,
  fields,
  defaultOpen = false,
}: {
  title: string
  fields: string[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm"
      >
        <span className="text-muted-foreground">
          {title}{' '}
          <span className="font-mono text-foreground">({fields.length})</span>
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground', open && 'rotate-180')} />
      </button>
      {open && (
        <p className="pb-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {fields.join(' · ')}
        </p>
      )}
    </div>
  )
}

export function TemplateStep({ onContinue }: TemplateStepProps) {
  const catalogQuery = useQuery({
    queryKey: ['product-catalog'],
    queryFn: () => productService.getCatalog(),
  })

  const handleDownload = () => {
    productService.downloadTemplate()
    toast.success('Download do modelo iniciado')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Modelo CSV</p>
          <p className="text-xs text-muted-foreground">
            Delimitador <span className="font-mono">;</span>
            {catalogQuery.data ? ` · ${catalogQuery.data.required.length} campos obrigatórios` : ''}
          </p>
        </div>
        <Button onClick={handleDownload} size="sm" variant="outline">
          <Download className="h-4 w-4" />
          Baixar modelo
        </Button>
      </div>

      {catalogQuery.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full" />
        </div>
      )}

      {catalogQuery.isError && (
        <p className="text-sm text-destructive">
          Não foi possível carregar o catálogo de campos.
        </p>
      )}

      {catalogQuery.data && (
        <div className="rounded-lg border border-border px-4">
          <div className="border-b border-border py-3">
            <p className="mb-2 text-sm font-medium">Obrigatórios</p>
            <div className="flex flex-wrap gap-1.5">
              {catalogQuery.data.required.map((field) => (
                <Badge key={field} variant="secondary" className="font-mono font-normal">
                  {field}
                </Badge>
              ))}
            </div>
          </div>
          <CollapsibleFields title="Opcionais" fields={catalogQuery.data.optional} />
          <CollapsibleFields title="Farmácia popular" fields={catalogQuery.data.farmaciaPopular} />
          <CollapsibleFields title="Controlados" fields={catalogQuery.data.controlados} />
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onContinue}>Continuar</Button>
      </div>
    </div>
  )
}
