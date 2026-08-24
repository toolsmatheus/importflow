import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, ChevronDown, Download, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { productService } from '@/services/productService'
import { FolderCollectPanel } from '@/components/FolderCollectPanel'
import { formatNumber, cn } from '@/lib/utils'
import type { AuxiliaryEntity, AuxiliaryUploadResult, FolderCollectResult } from '@/types'

const ENTITIES: { entity: AuxiliaryEntity; label: string; required?: boolean }[] = [
  { entity: 'grupo', label: 'Grupo', required: true },
  { entity: 'subgrupo', label: 'Subgrupo' },
  { entity: 'categoria', label: 'Categoria' },
  { entity: 'laboratorio', label: 'Laboratório' },
  { entity: 'grupodepreco', label: 'Grupo de preço' },
  { entity: 'similar', label: 'Similar' },
  { entity: 'dcb', label: 'DCB' },
]

interface AuxiliaryStepProps {
  auxiliaries: Partial<Record<AuxiliaryEntity, AuxiliaryUploadResult>>
  onUploaded: (entity: AuxiliaryEntity, result: AuxiliaryUploadResult | null) => void
  onFolderCollected: (result: FolderCollectResult) => void
  onContinue: () => void
  isValidating?: boolean
}

export function AuxiliaryStep({
  auxiliaries,
  onUploaded,
  onFolderCollected,
  onContinue,
  isValidating,
}: AuxiliaryStepProps) {
  const [pendingEntity, setPendingEntity] = useState<AuxiliaryEntity | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const inputRefs = useRef<Partial<Record<AuxiliaryEntity, HTMLInputElement | null>>>({})

  const uploadMutation = useMutation({
    mutationFn: ({ entity, file }: { entity: AuxiliaryEntity; file: File }) =>
      productService.uploadAuxiliary(entity, file),
    onSuccess: (result) => {
      onUploaded(result.entity, result)
      toast.success(`${result.entity}: ${formatNumber(result.recordCount)} id(s)`)
      if (result.parseWarnings.length > 0) {
        toast.warning(`${result.parseWarnings.length} alerta(s) no auxiliar`)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao enviar auxiliar')
    },
    onSettled: () => setPendingEntity(null),
  })

  const hasGrupo = Boolean(auxiliaries.grupo)
  const readyCount = Object.keys(auxiliaries).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            productService.downloadTemplate()
            toast.success('Download do modelo iniciado')
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Modelo produtos
        </Button>
      </div>

      <FolderCollectPanel mode="auxiliaries" onCollected={onFolderCollected} />

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm font-medium">
            Auxiliares
            <span className="ml-2 font-normal text-muted-foreground">
              {readyCount}/{ENTITIES.length}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setTemplatesOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Modelos
            <ChevronDown className={cn('h-3.5 w-3.5', templatesOpen && 'rotate-180')} />
          </button>
        </div>

        {templatesOpen && (
          <div className="flex flex-wrap gap-1.5 border-b border-border bg-muted/30 px-3 py-2">
            {ENTITIES.map(({ entity, label }) => (
              <Button
                key={entity}
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => productService.downloadAuxiliaryTemplate(entity)}
              >
                <Download className="h-3 w-3" />
                {label}
              </Button>
            ))}
          </div>
        )}

        <ul className="divide-y divide-border">
          {ENTITIES.map(({ entity, label, required }) => {
            const uploaded = auxiliaries[entity]
            const isLoading = uploadMutation.isPending && pendingEntity === entity

            return (
              <li
                key={entity}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{label}</span>
                    {required && (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        obrig.
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {uploaded
                      ? `${uploaded.fileName} · ${formatNumber(uploaded.recordCount)}`
                      : '—'}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {uploaded && (
                    <span className="mr-1 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-4 w-4" />
                    </span>
                  )}

                  <input
                    ref={(el) => {
                      inputRefs.current[entity] = el
                    }}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return
                      setPendingEntity(entity)
                      uploadMutation.mutate({ entity, file })
                    }}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={isLoading}
                    aria-label={uploaded ? `Trocar ${label}` : `Enviar ${label}`}
                    onClick={() => inputRefs.current[entity]?.click()}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>

                  {uploaded && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={`Remover ${label}`}
                      onClick={() => onUploaded(entity, null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex justify-end">
        <Button onClick={onContinue} disabled={!hasGrupo || isValidating}>
          {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
          Continuar
        </Button>
      </div>
    </div>
  )
}
