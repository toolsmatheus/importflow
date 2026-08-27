import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, RotateCcw } from 'lucide-react'
import { Stepper } from '@/components/Stepper'
import { FileDropzone } from '@/components/FileDropzone'
import { FileInfo } from '@/components/FileInfo'
import { FolderCollectPanel } from '@/components/FolderCollectPanel'
import { AuxiliaryStep } from '@/components/AuxiliaryStep'
import { ErrorsStep } from '@/components/ErrorsStep'
import { PreviewStep } from '@/components/PreviewStep'
import { SendStep } from '@/components/SendStep'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useImportWizard } from '@/hooks/useImportWizard'
import { csvService, type UploadAnalyzeProgress } from '@/services/csvService'
import { productService } from '@/services/productService'
import {
  applyExpectedAliquota,
  findAliquotaMismatches,
  formatAliquotaCsv,
  getUfIcms,
  UF_ICMS_TABLE,
} from '@/lib/icmsByUf'
import { formatNumber } from '@/lib/utils'
import type { FileInputMode, FolderCollectResult, ProductValidationResult } from '@/types'

function isAliquotaUfWarning(issue: { field: string; message: string }) {
  return issue.field === 'aliquota' && issue.message.includes('padrão da UF')
}

function applyAliquotaFixToResult(
  result: ProductValidationResult,
  uf: string
): ProductValidationResult | null {
  const mismatch = findAliquotaMismatches(result.rows, uf)
  if (!mismatch || mismatch.mismatches.length === 0) return null

  const nextRows = applyExpectedAliquota(result.rows, mismatch.mismatches, mismatch.expected)
  const removed = result.issues.filter(isAliquotaUfWarning)
  const kept = result.issues.filter((i) => !isAliquotaUfWarning(i))

  return {
    ...result,
    rows: nextRows,
    issues: kept,
    warningCount: Math.max(
      0,
      result.warningCount - Math.max(removed.length, mismatch.mismatches.length)
    ),
    checkSummary: result.checkSummary?.map((check) =>
      check.id === 'aliquota_uf' ? { ...check, count: 0 } : check
    ),
  }
}

export function ProductImportPage() {
  const navigate = useNavigate()
  const wizard = useImportWizard()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [inputMode, setInputMode] = useState<FileInputMode>('manual')
  const [showChangeSource, setShowChangeSource] = useState(false)
  const [productFromFolder, setProductFromFolder] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadAnalyzeProgress | null>(null)

  const selectedUfEntry = getUfIcms(wizard.clientUf)

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (wizard.csvAnalysis?.fileId) {
        await csvService.discard(wizard.csvAnalysis.fileId).catch(() => undefined)
      }
      setUploadProgress({
        phase: 'upload',
        percent: 0,
        loaded: 0,
        total: file.size,
        etaSeconds: null,
        label: 'Enviando arquivo…',
      })
      return csvService.uploadAndAnalyze(file, { delimiter: ';', hasHeader: true }, setUploadProgress)
    },
    onSuccess: (analysis) => {
      setUploadProgress(null)
      wizard.setCsvAnalysis(analysis)
      wizard.setValidationResult(null)
      wizard.setPreviewRows([])
      wizard.setSendJob(null)
      setProductFromFolder(false)
      setShowChangeSource(false)
      toast.success(
        `Arquivo analisado: ${formatNumber(analysis.recordCount)} registro(s), ${analysis.columnCount} coluna(s)`
      )
    },
    onError: (error: Error) => {
      setUploadProgress(null)
      toast.error(error.message || 'Erro ao enviar o arquivo')
    },
  })

  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!wizard.csvAnalysis) throw new Error('Envie o arquivo antes de validar')
      if (!wizard.clientUf) throw new Error('Selecione o estado (UF) do cliente antes de validar')
      return productService.validate(wizard.csvAnalysis.fileId, {
        delimiter: wizard.csvAnalysis.delimiter,
        encoding: wizard.csvAnalysis.encoding,
        clientUf: wizard.clientUf,
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
      setProductFromFolder(true)
      setShowChangeSource(false)
    } else if (showChangeSource) {
      wizard.setCsvAnalysis(null)
      setProductFromFolder(false)
    }

    wizard.replaceAuxiliaries({
      ...wizard.auxiliaries,
      ...result.auxiliaries,
    })
    wizard.setValidationResult(null)
    wizard.setPreviewRows([])
    wizard.setSendJob(null)
  }

  const applyFolderFromAuxiliary = (result: FolderCollectResult) => {
    wizard.replaceAuxiliaries({
      ...wizard.auxiliaries,
      ...result.auxiliaries,
    })
    if (result.products) {
      wizard.setCsvAnalysis(result.products)
      setProductFromFolder(true)
      setShowChangeSource(false)
      wizard.setValidationResult(null)
      wizard.setPreviewRows([])
      wizard.setSendJob(null)
    }
  }

  const handleFixAliquotas = () => {
    if (!wizard.validationResult || !wizard.clientUf) return
    const fixed = findAliquotaMismatches(wizard.validationResult.rows, wizard.clientUf)
    const next = applyAliquotaFixToResult(wizard.validationResult, wizard.clientUf)
    if (!next) {
      toast.message('Nenhuma alíquota divergente para corrigir na prévia')
      return
    }
    wizard.setValidationResult(next)
    wizard.setPreviewRows(next.rows)
    toast.success(
      `${formatNumber(fixed?.mismatches.length ?? 0)} alíquota(s) ajustada(s) para ${formatAliquotaCsv(
        fixed?.expected ?? 0
      )}% (${wizard.clientUf})`
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Produtos</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            wizard.resetWizard()
            setSelectedFile(null)
            setShowChangeSource(false)
            setProductFromFolder(false)
            toast.message('Importação reiniciada')
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Reiniciar
        </Button>
      </div>

      <Stepper currentStep={wizard.currentStep} />

      {wizard.currentStep === 'auxiliary' && (
        <AuxiliaryStep
          auxiliaries={wizard.auxiliaries}
          onUploaded={wizard.setAuxiliary}
          onFolderCollected={applyFolderFromAuxiliary}
          onContinue={() => wizard.setCurrentStep('file')}
        />
      )}

      {wizard.currentStep === 'file' && (
        <div className="space-y-4">
          {wizard.csvAnalysis && !showChangeSource ? (
            <FileInfo
              analysis={wizard.csvAnalysis}
              sourceHint={productFromFolder ? 'coletado da pasta' : undefined}
              onChange={() => {
                setShowChangeSource(true)
                setInputMode(productFromFolder ? 'folder' : 'manual')
              }}
            />
          ) : (
            <>
              <div className="inline-flex rounded-md border border-border p-0.5">
                <Button
                  size="sm"
                  variant={inputMode === 'manual' ? 'secondary' : 'ghost'}
                  className="h-8"
                  onClick={() => setInputMode('manual')}
                >
                  Manual
                </Button>
                <Button
                  size="sm"
                  variant={inputMode === 'folder' ? 'secondary' : 'ghost'}
                  className="h-8"
                  onClick={() => setInputMode('folder')}
                >
                  Pasta
                </Button>
              </div>

              {inputMode === 'manual' ? (
                <FileDropzone
                  onFileSelect={handleFileSelect}
                  isLoading={uploadMutation.isPending}
                  progress={uploadProgress}
                  selectedFile={selectedFile}
                />
              ) : (
                <FolderCollectPanel onCollected={handleFolderCollected} />
              )}

              {showChangeSource && wizard.csvAnalysis ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setShowChangeSource(false)}
                >
                  Manter {wizard.csvAnalysis.fileName}
                </Button>
              ) : null}
            </>
          )}

          <div className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">UF do cliente</p>
              <p className="text-xs text-muted-foreground">
                Alíquota ICMS esperada
                {selectedUfEntry
                  ? `: ${formatAliquotaCsv(selectedUfEntry.aliquota)}%`
                  : ' — selecione antes de validar'}
              </p>
            </div>
            <Select value={wizard.clientUf || undefined} onValueChange={wizard.setClientUf}>
              <SelectTrigger id="client-uf" className="w-full sm:w-52">
                <SelectValue placeholder="Selecione a UF" />
              </SelectTrigger>
              <SelectContent>
                {UF_ICMS_TABLE.map((entry) => (
                  <SelectItem key={entry.uf} value={entry.uf}>
                    {entry.uf} — {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between pt-1">
            <Button
              variant="outline"
              onClick={() => wizard.setCurrentStep('auxiliary')}
              disabled={validateMutation.isPending}
            >
              Voltar
            </Button>
            <Button
              onClick={() => {
                if (!wizard.clientUf) {
                  toast.error('Selecione o estado (UF) do cliente antes de validar')
                  return
                }
                validateMutation.mutate()
              }}
              disabled={
                !wizard.csvAnalysis ||
                !wizard.auxiliaries.grupo ||
                !wizard.clientUf ||
                validateMutation.isPending
              }
            >
              {validateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Validar
            </Button>
          </div>
        </div>
      )}

      {wizard.currentStep === 'errors' && (
        <ErrorsStep
          result={wizard.validationResult}
          clientUf={wizard.clientUf}
          onBack={() => wizard.setCurrentStep('file')}
          onFixFile={() => wizard.setCurrentStep('file')}
          onFixAuxiliary={() => wizard.setCurrentStep('auxiliary')}
          onRevalidate={() => validateMutation.mutate()}
          isRevalidating={validateMutation.isPending}
          onFixAliquotas={handleFixAliquotas}
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
          clientUf={wizard.clientUf}
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
          validationResult={wizard.validationResult}
          onBack={() => wizard.setCurrentStep('preview')}
          onFinish={() => {
            wizard.resetWizard()
            setSelectedFile(null)
            setShowChangeSource(false)
            setProductFromFolder(false)
            navigate('/import/produtos')
            toast.success('Produtos concluídos. Opcionais ficam na aba Opcionais.')
          }}
        />
      )}
    </div>
  )
}
