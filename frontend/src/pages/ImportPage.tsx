import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { Stepper } from '@/components/Stepper'
import { TemplateStep } from '@/components/TemplateStep'
import { FileDropzone } from '@/components/FileDropzone'
import { FileInfo } from '@/components/FileInfo'
import { AuxiliaryStep } from '@/components/AuxiliaryStep'
import { ErrorsStep } from '@/components/ErrorsStep'
import { PreviewStep } from '@/components/PreviewStep'
import { SendStep } from '@/components/SendStep'
import { Button } from '@/components/ui/button'
import { useImportWizard } from '@/hooks/useImportWizard'
import { csvService } from '@/services/csvService'
import { productService } from '@/services/productService'
import { formatNumber } from '@/lib/utils'

export function ImportPage() {
  const navigate = useNavigate()
  const wizard = useImportWizard()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

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
      wizard.setSendResult(null)
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

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      <Header
        title="Nova importação"
        description="Importe produtos via CSV com validação antes do envio."
      />

      <Stepper currentStep={wizard.currentStep} />

      {wizard.currentStep === 'template' && (
        <TemplateStep onContinue={wizard.goToNextStep} />
      )}

      {wizard.currentStep === 'file' && (
        <div className="space-y-6">
          <FileDropzone
            onFileSelect={handleFileSelect}
            isLoading={uploadMutation.isPending}
            selectedFile={selectedFile}
          />

          {wizard.csvAnalysis && <FileInfo analysis={wizard.csvAnalysis} />}

          <div className="flex justify-between">
            <Button variant="outline" onClick={wizard.goToPreviousStep}>
              Voltar
            </Button>
            <Button
              onClick={() => wizard.setCurrentStep('auxiliary')}
              disabled={!wizard.csvAnalysis}
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      {wizard.currentStep === 'auxiliary' && (
        <AuxiliaryStep
          auxiliaries={wizard.auxiliaries}
          onUploaded={wizard.setAuxiliary}
          onBack={() => wizard.setCurrentStep('file')}
          onContinue={() => validateMutation.mutate()}
          isValidating={validateMutation.isPending}
        />
      )}

      {wizard.currentStep === 'errors' && (
        <ErrorsStep
          result={wizard.validationResult}
          onBack={() => wizard.setCurrentStep('auxiliary')}
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
          result={wizard.sendResult}
          onResult={wizard.setSendResult}
          onBack={() => wizard.setCurrentStep('preview')}
          onFinish={() => {
            wizard.resetWizard()
            setSelectedFile(null)
            navigate('/')
            toast.success('Importação concluída')
          }}
        />
      )}

      {validateMutation.isPending && wizard.currentStep === 'auxiliary' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validando produtos e vínculos auxiliares...
        </div>
      )}
    </div>
  )
}
