import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Download, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { productService } from '@/services/productService'
import { cn } from '@/lib/utils'

interface TemplateStepProps {
  onContinue: () => void
}

function FieldAccordion({
  title,
  description,
  fields,
  defaultOpen = false,
  variant = 'secondary',
}: {
  title: string
  description?: string
  fields: string[]
  defaultOpen?: boolean
  variant?: 'default' | 'secondary' | 'outline'
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium">{title}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{fields.length}</Badge>
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </div>
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          {fields.map((field) => (
            <Badge key={field} variant={variant} className="font-mono font-normal">
              {field}
            </Badge>
          ))}
        </div>
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
      <Card className="border-primary/20 bg-gradient-to-br from-accent/40 to-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Modelo de planilha
          </CardTitle>
          <CardDescription>
            Baixe o CSV com as colunas já nomeadas. Preencha no Excel ou LibreOffice e envie no
            próximo passo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={handleDownload} size="lg">
            <Download className="h-4 w-4" />
            Baixar modelo-produtos.csv
          </Button>
        </CardContent>
      </Card>

      {catalogQuery.isLoading && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      )}

      {catalogQuery.isError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">
            Não foi possível carregar o catálogo. Verifique se o backend está no ar.
          </CardContent>
        </Card>
      )}

      {catalogQuery.data && (
        <div className="space-y-3">
          <FieldAccordion
            title="Campos obrigatórios"
            description={`Devem existir e não podem ficar em branco. Delimitador: ${catalogQuery.data.delimiter}`}
            fields={catalogQuery.data.required}
            defaultOpen
            variant="default"
          />
          <FieldAccordion
            title="Campos opcionais"
            description="Validados apenas se a coluna existir e estiver preenchida"
            fields={catalogQuery.data.optional}
          />
          <FieldAccordion
            title="Farmácia popular"
            fields={catalogQuery.data.farmaciaPopular}
            variant="outline"
          />
          <FieldAccordion
            title="Controlados"
            fields={catalogQuery.data.controlados}
            variant="outline"
          />
          <FieldAccordion
            title="Valores de listapiscofins"
            fields={catalogQuery.data.listapiscofins}
            variant="outline"
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button size="lg" onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </div>
  )
}
