import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import type {
  AuxiliaryEntity,
  AuxiliaryUploadResult,
  CsvAnalysis,
  ProductValidationResult,
  SendJobSnapshot,
  WizardStep,
} from '@/types'

const TMS_URL_KEY = 'importflow.tmsBaseUrl'
const DEFAULT_TMS_URL = 'http://localhost:2001'

type AuxiliaryMap = Partial<Record<AuxiliaryEntity, AuxiliaryUploadResult>>

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  template: 'Modelo',
  file: 'Arquivo',
  auxiliary: 'Auxiliares',
  errors: 'Erros',
  preview: 'Prévia',
  send: 'Envio',
}

export const WIZARD_STEPS: WizardStep[] = [
  'template',
  'file',
  'auxiliary',
  'errors',
  'preview',
  'send',
]

function readStoredTmsUrl(): string {
  try {
    return localStorage.getItem(TMS_URL_KEY) || DEFAULT_TMS_URL
  } catch {
    return DEFAULT_TMS_URL
  }
}

interface ImportWizardContextValue {
  currentStep: WizardStep
  setCurrentStep: (step: WizardStep) => void
  csvAnalysis: CsvAnalysis | null
  setCsvAnalysis: (analysis: CsvAnalysis | null) => void
  auxiliaries: AuxiliaryMap
  setAuxiliary: (entity: AuxiliaryEntity, result: AuxiliaryUploadResult | null) => void
  replaceAuxiliaries: (next: AuxiliaryMap) => void
  validationResult: ProductValidationResult | null
  setValidationResult: (result: ProductValidationResult | null) => void
  previewRows: Record<string, string>[]
  setPreviewRows: (rows: Record<string, string>[]) => void
  previewColumns: string[]
  setPreviewColumns: (columns: string[]) => void
  sendJob: SendJobSnapshot | null
  setSendJob: (job: SendJobSnapshot | null) => void
  tmsBaseUrl: string
  setTmsBaseUrl: (url: string) => void
  resetWizard: () => void
  goToNextStep: () => void
  goToPreviousStep: () => void
  auxiliaryFileIds: Partial<Record<AuxiliaryEntity, string>>
  hasInProgressImport: boolean
}

const ImportWizardContext = createContext<ImportWizardContextValue | null>(null)

export function ImportWizardProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('template')
  const [csvAnalysis, setCsvAnalysis] = useState<CsvAnalysis | null>(null)
  const [auxiliaries, setAuxiliaries] = useState<AuxiliaryMap>({})
  const [validationResult, setValidationResult] = useState<ProductValidationResult | null>(null)
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([])
  const [previewColumns, setPreviewColumns] = useState<string[]>([])
  const [sendJob, setSendJob] = useState<SendJobSnapshot | null>(null)
  const [tmsBaseUrl, setTmsBaseUrlState] = useState(readStoredTmsUrl)

  const setTmsBaseUrl = useCallback((url: string) => {
    setTmsBaseUrlState(url)
    try {
      localStorage.setItem(TMS_URL_KEY, url)
    } catch {
      /* ignore */
    }
  }, [])

  const setAuxiliary = useCallback((entity: AuxiliaryEntity, result: AuxiliaryUploadResult | null) => {
    setAuxiliaries((prev) => {
      const next = { ...prev }
      if (result) next[entity] = result
      else delete next[entity]
      return next
    })
  }, [])

  const replaceAuxiliaries = useCallback((next: AuxiliaryMap) => {
    setAuxiliaries(next)
  }, [])

  const auxiliaryFileIds = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(auxiliaries)
          .filter(([, value]) => value)
          .map(([entity, value]) => [entity, value!.fileId])
      ) as Partial<Record<AuxiliaryEntity, string>>,
    [auxiliaries]
  )

  const resetWizard = useCallback(() => {
    setCurrentStep('template')
    setCsvAnalysis(null)
    setAuxiliaries({})
    setValidationResult(null)
    setPreviewRows([])
    setPreviewColumns([])
    setSendJob(null)
  }, [])

  const goToNextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const idx = WIZARD_STEPS.indexOf(prev)
      return idx < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[idx + 1] : prev
    })
  }, [])

  const goToPreviousStep = useCallback(() => {
    setCurrentStep((prev) => {
      const idx = WIZARD_STEPS.indexOf(prev)
      return idx > 0 ? WIZARD_STEPS[idx - 1] : prev
    })
  }, [])

  const hasInProgressImport = Boolean(csvAnalysis) || currentStep !== 'template'

  const value = useMemo<ImportWizardContextValue>(
    () => ({
      currentStep,
      setCurrentStep,
      csvAnalysis,
      setCsvAnalysis,
      auxiliaries,
      setAuxiliary,
      replaceAuxiliaries,
      validationResult,
      setValidationResult,
      previewRows,
      setPreviewRows,
      previewColumns,
      setPreviewColumns,
      sendJob,
      setSendJob,
      tmsBaseUrl,
      setTmsBaseUrl,
      resetWizard,
      goToNextStep,
      goToPreviousStep,
      auxiliaryFileIds,
      hasInProgressImport,
    }),
    [
      currentStep,
      csvAnalysis,
      auxiliaries,
      setAuxiliary,
      replaceAuxiliaries,
      validationResult,
      previewRows,
      previewColumns,
      sendJob,
      tmsBaseUrl,
      setTmsBaseUrl,
      resetWizard,
      goToNextStep,
      goToPreviousStep,
      auxiliaryFileIds,
      hasInProgressImport,
    ]
  )

  return (
    <ImportWizardContext.Provider value={value}>{children}</ImportWizardContext.Provider>
  )
}

export function useImportWizard() {
  const context = useContext(ImportWizardContext)
  if (!context) {
    throw new Error('useImportWizard deve ser usado dentro de ImportWizardProvider')
  }
  return context
}
