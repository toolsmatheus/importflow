import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, RotateCcw } from 'lucide-react'
import { Stepper } from '@/components/Stepper'
import { TemplateStep } from '@/components/TemplateStep'
import { FileDropzone } from '@/components/FileDropzone'
import { FileInfo } from '@/components/FileInfo'
import { FolderCollectPanel } from '@/components/FolderCollectPanel'
import { AuxiliaryStep } from '@/components/AuxiliaryStep'
import { ErrorsStep } from '@/components/ErrorsStep'
import { PreviewStep } from '@/components/PreviewStep'
import { SendStep } from '@/components/SendStep'
import { Button } from '@/components/ui/button'
import { useImportWizard } from '@/hooks/useImportWizard'
import { csvService } from '@/services/csvService'
import { productService } from '@/services/productService'
import { formatNumber } from '@/lib/utils'
import type { FileInputMode, FolderCollectResult } from '@/types'

export function ProductImportPage() {
  const navigate = useNavigate()
  const wizard = useImportWizard()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [inputMode, setInputMode] = useState<FileInputMode>('manual')

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (wizard.csvAnalysis?.fileId) {
        await csvService.discard(wizard.csvAnalysis.fileId).catch(() => undefined)
      }
      return csvService.uploadAndAnalyze(file, { delimiter: ';', hasHeader: true })
    },
    onSuccess: (analysis) => {
      wizard.setCsvAnalysis(analysis)
      wizard.setValidationResult(null)
      wizard.setPreviewRows([])
      wizard.setSendJob(null)
      toast.success(
        `Arquivo analisado: ${formatNumber(analysis.recordCount)} registro(s), ${analysis.columnCount} coluna(s)`
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao enviar o arquivo')
    },
  })

  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!wizard.csvAnalysis) throw new Error('Envie o arquivo antes de validar')
      return productService.validate(wizard.csvAnalysis.fileId, {
        delimiter: wizard.csvAnalysis.delimiter,
        encoding: wizard.csvAnalysis.encoding,
        auxiliary: wizard.auxiliaryFileIds,
      })
    },
    onSuccess: (result) => {
      wizard.setValidationResult(result)
      wizard.setPreviewRows(result.rows)
      wizard.setPreviewColumns(
        result.columns.length ? result.columns : wizard.csvAnalysis?.columns ?? []
      )
      wizard.setCurrentStep('errors')

      if (result.errorCount > 0) {
        toast.warning(
          `${formatNumber(result.errorCount)} erro(s) e ${formatNumber(result.warningCount)} alerta(s)`
        )
      } else if (result.warningCount > 0) {
        toast.success(`Validação ok com ${formatNumber(result.warningCount)} alerta(s)`)
      } else {
        toast.success('Validação concluída sem problemas')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao validar o arquivo')
    },
  })

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    uploadMutation.mutate(file)
  }

  const handleFolderCollected = (result: FolderCollectResult) => {
    if (result.products) {
      wizard.setCsvAnalysis(result.products)
      setSelectedFile(null)
    } else {
      wizard.setCsvAnalysis(null)
    }

    wizard.replaceAuxiliaries({
      ...wizard.auxiliaries,
      ...result.auxiliaries,
    })
    wizard.setValidationResult(null)
    wizard.setPreviewRows([])
    wizard.setSendJob(null)
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Produtos
          </h2>
          <p className="mt-1 text-muted-foreground">
            Auxiliares, CSV de produtos e envio ao servidor.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            wizard.resetWizard()
            setSelectedFile(null)
            toast.message('Importação de produtos reiniciada')
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Reiniciar
        </Button>
      </div>

      <Stepper currentStep={wizard.currentStep} />

      {wizard.currentStep === 'template' && (
        <TemplateStep onContinue={wizard.goToNextStep} />
      )}

      {wizard.currentStep === 'auxiliary' && (
        <AuxiliaryStep
          auxiliaries={wizard.auxiliaries}
          onUploaded={wizard.setAuxiliary}
          onFolderCollected={(result) => {
            wizard.replaceAuxiliaries({
              ...wizard.auxiliaries,
              ...result.auxiliaries,
            })
          }}
          onBack={() => wizard.setCurrentStep('template')}
          onContinue={() => wizard.setCurrentStep('file')}
        />
      )}

      {wizard.currentStep === 'file' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={inputMode === 'manual' ? 'default' : 'outline'}
              onClick={() => setInputMode('manual')}
            >
              Manual
            </Button>
            <Button
              size="sm"
              variant={inputMode === 'folder' ? 'default' : 'outline'}
              onClick={() => setInputMode('folder')}
            >
              Pasta automática
            </Button>
          </div>

          {Object.keys(wizard.auxiliaries).length > 0 && (
            <p className="text-sm text-muted-foreground">
              Auxiliares prontos: {Object.keys(wizard.auxiliaries).join(', ')}.
            </p>
          )}

          {inputMode === 'manual' ? (
            <FileDropzone
              onFileSelect={handleFileSelect}
              isLoading={uploadMutation.isPending}
              selectedFile={selectedFile}
            />
          ) : (
            <FolderCollectPanel onCollected={handleFolderCollected} />
          )}

          {wizard.csvAnalysis && <FileInfo analysis={wizard.csvAnalysis} />}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => wizard.setCurrentStep('auxiliary')}
              disabled={validateMutation.isPending}
            >
              Voltar
            </Button>
            <Button
              onClick={() => validateMutation.mutate()}
              disabled={!wizard.csvAnalysis || !wizard.auxiliaries.grupo || validateMutation.isPending}
            >
              {validateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Validar produtos
            </Button>
          </div>

          {validateMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validando produtos e vínculos auxiliares...
            </div>
          )}
        </div>
      )}

      {wizard.currentStep === 'errors' && (
        <ErrorsStep
          result={wizard.validationResult}
          onBack={() => wizard.setCurrentStep('file')}
          onFixFile={() => wizard.setCurrentStep('file')}
          onFixAuxiliary={() => wizard.setCurrentStep('auxiliary')}
          onRevalidate={() => validateMutation.mutate()}
          isRevalidating={validateMutation.isPending}
          onContinue={() => {
            if (wizard.validationResult?.rows?.length) {
              wizard.setPreviewRows(wizard.validationResult.rows)
              wizard.setPreviewColumns(wizard.validationResult.columns)
            }
            wizard.setCurrentStep('preview')
          }}
        />
      )}

      {wizard.currentStep === 'preview' && (
        <PreviewStep
          columns={wizard.previewColumns}
          rows={wizard.previewRows}
          onRowsChange={wizard.setPreviewRows}
          onColumnsChange={wizard.setPreviewColumns}
          auxiliary={wizard.auxiliaryFileIds}
          onBack={() => wizard.setCurrentStep('errors')}
          onContinue={() => wizard.setCurrentStep('send')}
        />
      )}

      {wizard.currentStep === 'send' && (
        <SendStep
          rows={wizard.previewRows}
          tmsBaseUrl={wizard.tmsBaseUrl}
          onTmsBaseUrlChange={wizard.setTmsBaseUrl}
          job={wizard.sendJob}
          onJobChange={wizard.setSendJob}
          auxiliary={wizard.auxiliaryFileIds}
          onBack={() => wizard.setCurrentStep('preview')}
          onFinish={() => {
            wizard.resetWizard()
            setSelectedFile(null)
            navigate('/import/produtos')
            toast.success('Importação de produtos concluída')
          }}
        />
      )}
    </div>
  )
}
