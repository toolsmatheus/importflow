import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { productService } from '@/services/productService'
import { FolderCollectPanel } from '@/components/FolderCollectPanel'
import { formatNumber } from '@/lib/utils'
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
  onBack: () => void
  onContinue: () => void
  isValidating?: boolean
}

export function AuxiliaryStep({
  auxiliaries,
  onUploaded,
  onFolderCollected,
  onBack,
  onContinue,
  isValidating,
}: AuxiliaryStepProps) {
  const [pendingEntity, setPendingEntity] = useState<AuxiliaryEntity | null>(null)
  const inputRefs = useRef<Partial<Record<AuxiliaryEntity, HTMLInputElement | null>>>({})

  const uploadMutation = useMutation({
    mutationFn: ({ entity, file }: { entity: AuxiliaryEntity; file: File }) =>
      productService.uploadAuxiliary(entity, file),
    onSuccess: (result) => {
      onUploaded(result.entity, result)
      toast.success(
        `${result.entity}.csv: ${formatNumber(result.recordCount)} registro(s)`
      )
      if (result.parseWarnings.length > 0) {
        toast.warning(`${result.parseWarnings.length} alerta(s) no arquivo auxiliar`)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao enviar auxiliar')
    },
    onSettled: () => setPendingEntity(null),
  })

  const hasGrupo = Boolean(auxiliaries.grupo)

  return (
    <div className="space-y-6">
      <FolderCollectPanel mode="auxiliaries" onCollected={onFolderCollected} />

      <Card>
        <CardHeader>
          <CardTitle>Arquivos auxiliares</CardTitle>
          <CardDescription>
            Um CSV por entidade, com colunas <span className="font-mono">id;nome</span>. O arquivo
            de <strong>grupo</strong> é obrigatório.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ENTITIES.map(({ entity, label, required }) => {
            const uploaded = auxiliaries[entity]
            const isLoading = uploadMutation.isPending && pendingEntity === entity

            return (
              <div
                key={entity}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    <span className="font-medium">{label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{entity}.csv</span>
                    {required && <Badge variant="secondary">obrigatório</Badge>}
                  </div>
                  {uploaded ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {uploaded.fileName} ({formatNumber(uploaded.recordCount)} id(s))
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Não enviado</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => productService.downloadAuxiliaryTemplate(entity)}
                  >
                    <Download className="h-4 w-4" />
                    Modelo
                  </Button>

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
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => inputRefs.current[entity]?.click()}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploaded ? 'Trocar' : 'Enviar'}
                  </Button>

                  {uploaded && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remover ${entity}.csv`}
                      onClick={() => onUploaded(entity, null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isValidating}>
          Voltar
        </Button>
        <Button onClick={onContinue} disabled={!hasGrupo || isValidating}>
          {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
          Continuar para produtos
        </Button>
      </div>
    </div>
  )
}
