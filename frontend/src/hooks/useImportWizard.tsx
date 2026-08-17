import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type {
  ConnectionConfig,
  ConnectionTestResult,
  CsvAnalysis,
  ColumnMapping,
  ValidationResult,
  ImportProgress,
  ImportResult,
  ImportMode,
  WizardStep,
} from '@/types'

interface ImportWizardContextValue {
  currentStep: WizardStep
  setCurrentStep: (step: WizardStep) => void
  connection: ConnectionConfig | null
  setConnection: (config: ConnectionConfig) => void
  sessionId: string | null
  setSessionId: (id: string | null) => void
  connectionTested: boolean
  connectionResult: ConnectionTestResult | null
  setConnectionResult: (result: ConnectionTestResult | null) => void
  csvAnalysis: CsvAnalysis | null
  setCsvAnalysis: (analysis: CsvAnalysis | null) => void
  selectedTable: string | null
  setSelectedTable: (table: string | null) => void
  columnMappings: ColumnMapping[]
  setColumnMappings: (mappings: ColumnMapping[]) => void
  importMode: ImportMode
  setImportMode: (mode: ImportMode) => void
  validationResult: ValidationResult | null
  setValidationResult: (result: ValidationResult | null) => void
  importProgress: ImportProgress | null
  setImportProgress: (progress: ImportProgress | null) => void
  importResult: ImportResult | null
  setImportResult: (result: ImportResult | null) => void
  resetWizard: () => void
  goToNextStep: () => void
  goToPreviousStep: () => void
}

const STEPS: WizardStep[] = ['connection', 'file', 'mapping', 'review', 'import']

const ImportWizardContext = createContext<ImportWizardContextValue | null>(null)

export function ImportWizardProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('connection')
  const [connection, setConnection] = useState<ConnectionConfig | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [connectionResult, setConnectionResult] = useState<ConnectionTestResult | null>(null)
  const [csvAnalysis, setCsvAnalysis] = useState<CsvAnalysis | null>(null)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
  const [importMode, setImportMode] = useState<ImportMode>('upsert')
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const connectionTested = connectionResult?.success === true

  const resetWizard = useCallback(() => {
    setCurrentStep('connection')
    setConnection(null)
    setSessionId(null)
    setConnectionResult(null)
    setCsvAnalysis(null)
    setSelectedTable(null)
    setColumnMappings([])
    setImportMode('upsert')
    setValidationResult(null)
    setImportProgress(null)
    setImportResult(null)
  }, [])

  const goToNextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const idx = STEPS.indexOf(prev)
      return idx < STEPS.length - 1 ? STEPS[idx + 1] : prev
    })
  }, [])

  const goToPreviousStep = useCallback(() => {
    setCurrentStep((prev) => {
      const idx = STEPS.indexOf(prev)
      return idx > 0 ? STEPS[idx - 1] : prev
    })
  }, [])

  return (
    <ImportWizardContext.Provider
      value={{
        currentStep,
        setCurrentStep,
        connection,
        setConnection,
        sessionId,
        setSessionId,
        connectionTested,
        connectionResult,
        setConnectionResult,
        csvAnalysis,
        setCsvAnalysis,
        selectedTable,
        setSelectedTable,
        columnMappings,
        setColumnMappings,
        importMode,
        setImportMode,
        validationResult,
        setValidationResult,
        importProgress,
        setImportProgress,
        importResult,
        setImportResult,
        resetWizard,
        goToNextStep,
        goToPreviousStep,
      }}
    >
      {children}
    </ImportWizardContext.Provider>
  )
}

export function useImportWizard() {
  const context = useContext(ImportWizardContext)
  if (!context) {
    throw new Error('useImportWizard must be used within ImportWizardProvider')
  }
  return context
}

export { STEPS }
