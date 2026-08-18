import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { Stepper } from '@/components/Stepper'
import { ConnectionForm } from '@/components/ConnectionForm'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { FileDropzone } from '@/components/FileDropzone'
import { FileInfo } from '@/components/FileInfo'
import { TableSelector } from '@/components/TableSelector'
import { ColumnMappingComponent } from '@/components/ColumnMapping'
import { DataPreview } from '@/components/DataPreview'
import { ValidationSummary } from '@/components/ValidationSummary'
import { ImportProgressComponent } from '@/components/ImportProgress'
import { ImportResultComponent } from '@/components/ImportResult'
import { ErrorTable } from '@/components/ErrorTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useImportWizard } from '@/hooks/useImportWizard'
import { mysqlService } from '@/services/mysqlService'
import { csvService } from '@/services/csvService'
import { mappingService } from '@/services/mappingService'
import { importService } from '@/services/importService'
import { formatNumber } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import type { ConnectionConfig, ImportMode } from '@/types'

const IMPORT_MODE_LABELS: Record<ImportMode, string> = {
  insert: 'Inserir novos registros',
  update: 'Atualizar registros existentes',
  upsert: 'Inserir ou atualizar',
}

export function ImportPage() {
  const navigate = useNavigate()
  const wizard = useImportWizard()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [delimiter, setDelimiter] = useState(';')
  const [encoding, setEncoding] = useState('UTF-8')
  const [hasHeader, setHasHeader] = useState(true)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showErrorDetails, setShowErrorDetails] = useState(false)
  const [importPhase, setImportPhase] = useState<'confirm' | 'running' | 'done'>('confirm')
  const [importId, setImportId] = useState<string | null>(null)
  const [isSuggestingMappings, setIsSuggestingMappings] = useState(false)

  const testConnectionMutation = useMutation({
    mutationFn: (config: ConnectionConfig) => mysqlService.testConnection(config),
    onSuccess: (result) => {
      wizard.setConnectionResult(result)
      if (result.success) {
        if (result.sessionId) {
          wizard.setSessionId(result.sessionId)
        }
        toast.success('Conexão realizada com sucesso')
      } else {
        wizard.setSessionId(null)
        toast.error(result.message ?? 'Não foi possível conectar ao banco')
      }
    },
    onError: () => {
      wizard.setSessionId(null)
      toast.error('Erro ao testar conexão')
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Troca de arquivo: descarta o anterior no servidor antes de enviar o novo.
      const previousFileId = wizard.csvAnalysis?.fileId
      if (previousFileId) {
        await csvService.discard(previousFileId).catch(() => undefined)
      }
      return csvService.uploadAndAnalyze(file)
    },
    onSuccess: (analysis) => {
      wizard.setCsvAnalysis(analysis)
      setDelimiter(analysis.delimiter)
      setEncoding(analysis.encoding)
      setHasHeader(analysis.hasHeader)
      wizard.setColumnMappings([])
      toast.success('Arquivo analisado com sucesso')
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao analisar arquivo'),
  })

  const reanalyzeMutation = useMutation({
    mutationFn: () =>
      csvService.reanalyze(wizard.csvAnalysis!.fileId, {
        delimiter,
        encoding,
        hasHeader,
      }),
    onSuccess: (analysis) => {
      wizard.setCsvAnalysis(analysis)
      setDelimiter(analysis.delimiter)
      setEncoding(analysis.encoding)
      setHasHeader(analysis.hasHeader)
      wizard.setColumnMappings([])
      toast.success('Arquivo reanalisado com sucesso')
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao reanalisar arquivo'),
  })

  const tablesQuery = useQuery({
    queryKey: ['mysql-tables', wizard.sessionId],
    queryFn: () => mysqlService.getTables(wizard.sessionId!),
    enabled: wizard.currentStep === 'mapping' && !!wizard.sessionId,
    retry: false,
  })

  const columnsQuery = useQuery({
    queryKey: ['mysql-columns', wizard.sessionId, wizard.selectedTable],
    queryFn: () => mysqlService.getTableColumns(wizard.selectedTable!, wizard.sessionId!),
    enabled: !!wizard.selectedTable && !!wizard.sessionId,
    retry: false,
  })

  const validateMutation = useMutation({
    mutationFn: () =>
      importService.validate({
        sessionId: wizard.sessionId!,
        fileId: wizard.csvAnalysis!.fileId,
        table: wizard.selectedTable!,
        mappings: wizard.columnMappings,
        delimiter,
        encoding,
        hasHeader,
      }),
    onSuccess: (result) => {
      wizard.setValidationResult(result)
      if (result.invalidCount > 0) {
        toast.warning(`${formatNumber(result.invalidCount)} registro(s) com erro encontrados`)
      } else {
        toast.success('Validação concluída sem erros')
      }
    },
    onError: (error: Error) => {
      wizard.setValidationResult(null)
      toast.error(error.message || 'Erro ao validar os dados')
    },
  })

  const startImportMutation = useMutation({
    mutationFn: () =>
      importService.startImport({
        sessionId: wizard.sessionId!,
        fileId: wizard.csvAnalysis!.fileId,
        table: wizard.selectedTable!,
        mappings: wizard.columnMappings,
        delimiter,
        encoding,
        hasHeader,
        mode: wizard.importMode,
        totalRecords: wizard.validationResult?.totalRecords,
      }),
    onSuccess: ({ importId }) => {
      setImportId(importId)
      setImportPhase('running')
    },
    onError: (error: Error) => {
      setImportPhase('confirm')
      toast.error(error.message || 'Não foi possível iniciar a importação')
    },
  })

  const statusQuery = useQuery({
    queryKey: ['import-status', importId],
    queryFn: () => importService.getStatus(importId!, wizard.sessionId!),
    enabled: !!importId && importPhase === 'running',
    refetchInterval: 1000,
    retry: false,
  })

  const errorsQuery = useQuery({
    queryKey: ['import-errors', importId],
    queryFn: () => importService.getErrors(importId!, wizard.sessionId!),
    enabled: showErrorDetails && !!importId,
    retry: false,
  })

  // O backend importa em background; aqui apenas acompanhamos o progresso
  // e buscamos o resultado final quando o job termina.
  useEffect(() => {
    const progress = statusQuery.data
    if (!progress || !importId) return

    wizard.setImportProgress(progress)

    if (progress.status !== 'completed' && progress.status !== 'failed') return

    importService
      .getResult(importId, wizard.sessionId!)
      .then((result) => {
        wizard.setImportResult(result)
        setImportPhase('done')
        if (result.status === 'failed') {
          toast.error(result.message || 'A importação foi interrompida')
        } else if (result.errors > 0) {
          toast.warning(`Importação concluída com ${formatNumber(result.errors)} erro(s)`)
        } else {
          toast.success('Importação concluída com sucesso')
        }
      })
      .catch((error: Error) => {
        setImportPhase('done')
        toast.error(error.message || 'Erro ao obter o resultado da importação')
      })
  }, [statusQuery.data, importId])

  const handleConnectionSubmit = (config: ConnectionConfig) => {
    wizard.setConnection(config)
    if (!wizard.connectionTested) {
      toast.warning('Teste a conexão antes de continuar')
      return
    }
    wizard.goToNextStep()
  }

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    uploadMutation.mutate(file)
  }

  const handleTableSelect = (table: string) => {
    wizard.setSelectedTable(table)
    wizard.setColumnMappings([])
  }

  useEffect(() => {
    if (!wizard.selectedTable || !wizard.csvAnalysis || !columnsQuery.data?.length) {
      return
    }

    let cancelled = false

    const suggest = async () => {
      setIsSuggestingMappings(true)
      try {
        const mappings = await mappingService.suggestMappings(
          wizard.csvAnalysis!.columns,
          columnsQuery.data!
        )
        if (!cancelled) {
          wizard.setColumnMappings(mappings)
        }
      } catch {
        if (!cancelled && wizard.csvAnalysis) {
          wizard.setColumnMappings(
            wizard.csvAnalysis.columns.map((csvColumn) => ({
              csvColumn,
              mysqlColumn: null,
              suggested: false,
            }))
          )
          toast.error('Erro ao sugerir mapeamento. Configure manualmente.')
        }
      } finally {
        if (!cancelled) {
          setIsSuggestingMappings(false)
        }
      }
    }

    suggest()

    return () => {
      cancelled = true
    }
  }, [wizard.selectedTable, wizard.csvAnalysis, columnsQuery.data])

  const handleMappingChange = (csvColumn: string, mysqlColumn: string | null) => {
    wizard.setColumnMappings(
      wizard.columnMappings.map((m) =>
        m.csvColumn === csvColumn ? { ...m, mysqlColumn, suggested: false } : m
      )
    )
  }

  const handleResuggestMappings = async () => {
    if (!wizard.csvAnalysis || !columnsQuery.data?.length) return

    setIsSuggestingMappings(true)
    try {
      const mappings = await mappingService.suggestMappings(
        wizard.csvAnalysis.columns,
        columnsQuery.data
      )
      wizard.setColumnMappings(mappings)
      toast.success('Mapeamento sugerido aplicado')
    } catch {
      toast.error('Erro ao sugerir mapeamento')
    } finally {
      setIsSuggestingMappings(false)
    }
  }

  const mappedCount = wizard.columnMappings.filter((mapping) => mapping.mysqlColumn).length

  const handleGoToReview = () => {
    if (mappedCount === 0) {
      toast.warning('Mapeie ao menos uma coluna antes de continuar')
      return
    }
    wizard.setValidationResult(null)
    validateMutation.mutate()
    wizard.goToNextStep()
  }

  const blockingIssues =
    (wizard.validationResult?.missingRequiredColumns.length ?? 0) > 0

  const handleStartImport = () => {
    setShowConfirmDialog(false)
    setShowErrorDetails(false)
    wizard.setImportProgress(null)
    wizard.setImportResult(null)
    wizard.goToNextStep()
    startImportMutation.mutate()
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      <Header title="Nova importação" description="Siga as etapas para importar seus dados." />
      <Stepper currentStep={wizard.currentStep} />

      {wizard.currentStep === 'connection' && (
        <div className="space-y-4">
          <ConnectionForm
            onSubmit={handleConnectionSubmit}
            onTestConnection={(config) => {
              wizard.setConnection(config)
              testConnectionMutation.mutate(config)
            }}
            isTesting={testConnectionMutation.isPending}
            defaultValues={wizard.connection ?? undefined}
          />
          <ConnectionStatus
            result={wizard.connectionResult}
            isLoading={testConnectionMutation.isPending}
          />
        </div>
      )}

      {wizard.currentStep === 'file' && (
        <div className="space-y-6">
          <FileDropzone
            onFileSelect={handleFileSelect}
            isLoading={uploadMutation.isPending}
            selectedFile={selectedFile}
          />
          {wizard.csvAnalysis && (
            <FileInfo
              analysis={wizard.csvAnalysis}
              delimiter={delimiter}
              encoding={encoding}
              hasHeader={hasHeader}
              onDelimiterChange={setDelimiter}
              onEncodingChange={setEncoding}
              onHasHeaderChange={setHasHeader}
              onReanalyze={() => reanalyzeMutation.mutate()}
              isReanalyzing={reanalyzeMutation.isPending}
            />
          )}
          <div className="flex justify-between">
            <Button variant="outline" onClick={wizard.goToPreviousStep}>
              Voltar
            </Button>
            <Button onClick={wizard.goToNextStep} disabled={!wizard.csvAnalysis}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {wizard.currentStep === 'mapping' && (
        <div className="space-y-6">
          {tablesQuery.isError && (
            <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
              <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">
                {(tablesQuery.error as ApiError).message ?? 'Erro ao carregar tabelas do banco.'}
              </CardContent>
            </Card>
          )}

          <TableSelector
            tables={tablesQuery.data ?? []}
            selectedTable={wizard.selectedTable}
            onTableSelect={handleTableSelect}
            columns={columnsQuery.data ?? []}
            isLoadingTables={tablesQuery.isLoading}
            isLoadingColumns={columnsQuery.isLoading}
          />

          {wizard.selectedTable && columnsQuery.isError && (
            <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
              <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">
                {(columnsQuery.error as ApiError).message ?? 'Erro ao carregar colunas da tabela.'}
              </CardContent>
            </Card>
          )}

          {wizard.selectedTable && wizard.columnMappings.length > 0 && columnsQuery.isSuccess && (
            <ColumnMappingComponent
              mappings={wizard.columnMappings}
              mysqlColumns={columnsQuery.data ?? []}
              onMappingChange={handleMappingChange}
              onSuggestMappings={handleResuggestMappings}
              isSuggesting={isSuggestingMappings}
            />
          )}

          {wizard.selectedTable && isSuggestingMappings && wizard.columnMappings.length === 0 && (
            <Card>
              <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sugerindo correspondências entre colunas...
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Modo de importação</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={wizard.importMode}
                onValueChange={(v) => wizard.setImportMode(v as ImportMode)}
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="insert">Somente inserir</SelectItem>
                  <SelectItem value="update">Atualizar existentes</SelectItem>
                  <SelectItem value="upsert">Inserir ou atualizar</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={wizard.goToPreviousStep}>
              Voltar
            </Button>
            <Button onClick={handleGoToReview} disabled={!wizard.selectedTable}>
              {validateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Continuar
            </Button>
          </div>
        </div>
      )}

      {wizard.currentStep === 'review' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Revise sua importação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label className="text-muted-foreground">Arquivo</Label>
                  <p className="font-medium">{wizard.csvAnalysis?.fileName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tabela</Label>
                  <p className="font-medium">{wizard.selectedTable}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total</Label>
                  <p className="font-medium">
                    {formatNumber(
                      wizard.validationResult?.totalRecords ??
                        wizard.csvAnalysis?.recordCount ??
                        0
                    )}{' '}
                    registros
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Mapeamento</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {wizard.columnMappings
                    .filter((m) => m.mysqlColumn)
                    .map((m) => (
                      <Badge key={m.csvColumn} variant="secondary">
                        {m.csvColumn} → {m.mysqlColumn}
                      </Badge>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {validateMutation.isPending && (
            <Card>
              <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Validando registros e gerando preview...
              </CardContent>
            </Card>
          )}

          {wizard.validationResult && (
            <>
              <DataPreview
                rows={wizard.validationResult.previewRows}
                columns={wizard.validationResult.previewColumns}
              />
              <ValidationSummary result={wizard.validationResult} />
            </>
          )}

          {validateMutation.isError && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <p className="text-sm text-destructive">
                  {validateMutation.error.message || 'Não foi possível validar os dados.'}
                </p>
                <Button variant="outline" size="sm" onClick={() => validateMutation.mutate()}>
                  Tentar novamente
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={wizard.goToPreviousStep}>
              Voltar
            </Button>
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={validateMutation.isPending || !wizard.validationResult || blockingIssues}
            >
              Iniciar importação
            </Button>
          </div>
        </div>
      )}

      {wizard.currentStep === 'import' && (
        <div className="space-y-6">
          {importPhase === 'running' && (
            <>
              {wizard.importProgress ? (
                <ImportProgressComponent progress={wizard.importProgress} />
              ) : (
                <Card>
                  <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Iniciando a importação...
                  </CardContent>
                </Card>
              )}
            </>
          )}
          {importPhase === 'done' && wizard.importResult && (
            <>
              <ImportResultComponent
                result={wizard.importResult}
                onViewDetails={() => setShowErrorDetails(true)}
                onNewImport={async () => {
                  if (wizard.sessionId) {
                    await mysqlService.disconnect(wizard.sessionId).catch(() => undefined)
                  }
                  if (wizard.csvAnalysis) {
                    await csvService.discard(wizard.csvAnalysis.fileId).catch(() => undefined)
                  }
                  wizard.resetWizard()
                  navigate('/import')
                  setImportPhase('confirm')
                  setImportId(null)
                  setShowErrorDetails(false)
                  setSelectedFile(null)
                }}
              />
              {showErrorDetails && errorsQuery.data && (
                <ErrorTable
                  errors={errorsQuery.data.errors}
                  total={errorsQuery.data.total}
                  truncated={errorsQuery.data.truncated}
                />
              )}
            </>
          )}
        </div>
      )}

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar importação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja iniciar a importação?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><strong>Banco:</strong> {wizard.connection?.database}</p>
            <p><strong>Tabela:</strong> {wizard.selectedTable}</p>
            <p><strong>Arquivo:</strong> {wizard.csvAnalysis?.fileName}</p>
            <p><strong>Modo:</strong> {IMPORT_MODE_LABELS[wizard.importMode]}</p>
            <p>
              <strong>Registros válidos:</strong>{' '}
              {formatNumber(wizard.validationResult?.validCount ?? 0)}
            </p>
            {(wizard.validationResult?.warningCount ?? 0) > 0 && (
              <p className="text-amber-700 dark:text-amber-300">
                <strong>Com alertas:</strong>{' '}
                {formatNumber(wizard.validationResult!.warningCount)} (serão importados com os
                valores ajustados)
              </p>
            )}
            {(wizard.validationResult?.invalidCount ?? 0) > 0 && (
              <p className="text-destructive">
                <strong>Inválidos:</strong> {formatNumber(wizard.validationResult!.invalidCount)}{' '}
                (serão ignorados e listados no relatório de erros)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleStartImport}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
