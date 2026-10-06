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
  EnvioJobSnapshot,
  WizardStep,
} from '@/types'

const TMS_URL_KEY = 'toolsdataweb.tmsBaseUrl'
const CLIENT_UF_KEY = 'toolsdataweb.clientUf'
const DEFAULT_TMS_URL = 'http://localhost:2001'

type AuxiliaryMap = Partial<Record<AuxiliaryEntity, AuxiliaryUploadResult>>

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  auxiliary: 'Auxiliares',
  file: 'Produtos',
  errors: 'Erros',
  send: 'Envio',
}

export const WIZARD_STEPS: WizardStep[] = [
  'auxiliary',
  'file',
  'errors',
  'send',
]

function readStoredTmsUrl(): string {
  try {
    return localStorage.getItem(TMS_URL_KEY) || DEFAULT_TMS_URL
  } catch {
    return DEFAULT_TMS_URL
  }
}

function readStoredClientUf(): string {
  try {
    return localStorage.getItem(CLIENT_UF_KEY) || ''
  } catch {
    return ''
  }
}

interface ValorContextoAssistenteImportacao {
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
  envioJob: EnvioJobSnapshot | null
  setEnvioJob: (job: EnvioJobSnapshot | null) => void
  tmsBaseUrl: string
  setTmsBaseUrl: (url: string) => void
  clientUf: string
  setClientUf: (uf: string) => void
  resetWizard: () => void
  goToNextStep: () => void
  goToPreviousStep: () => void
  auxiliaryFileIds: Partial<Record<AuxiliaryEntity, string>>
  hasInProgressImport: boolean
}

const ContextoAssistenteImportacao = createContext<ValorContextoAssistenteImportacao | null>(null)

export function ProvedorAssistenteImportacao({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('auxiliary')
  const [csvAnalysis, setCsvAnalysis] = useState<CsvAnalysis | null>(null)
  const [auxiliaries, setAuxiliaries] = useState<AuxiliaryMap>({})
  const [validationResult, setValidationResult] = useState<ProductValidationResult | null>(null)
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([])
  const [previewColumns, setPreviewColumns] = useState<string[]>([])
  const [envioJob, setEnvioJob] = useState<EnvioJobSnapshot | null>(null)
  const [tmsBaseUrl, setTmsBaseUrlState] = useState(readStoredTmsUrl)
  const [clientUf, setClientUfState] = useState(readStoredClientUf)

  const setTmsBaseUrl = useCallback((url: string) => {
    setTmsBaseUrlState(url)
    try {
      localStorage.setItem(TMS_URL_KEY, url)
    } catch {
      /* ignore */
    }
  }, [])

  const setClientUf = useCallback((uf: string) => {
    setClientUfState(uf)
    try {
      if (uf) localStorage.setItem(CLIENT_UF_KEY, uf)
      else localStorage.removeItem(CLIENT_UF_KEY)
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
    setCurrentStep('auxiliary')
    setCsvAnalysis(null)
    setAuxiliaries({})
    setValidationResult(null)
    setPreviewRows([])
    setPreviewColumns([])
    setEnvioJob(null)
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

  const hasInProgressImport = Boolean(csvAnalysis) || currentStep !== 'auxiliary'

  const value = useMemo<ValorContextoAssistenteImportacao>(
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
      envioJob,
      setEnvioJob,
      tmsBaseUrl,
      setTmsBaseUrl,
      clientUf,
      setClientUf,
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
      envioJob,
      tmsBaseUrl,
      setTmsBaseUrl,
      clientUf,
      setClientUf,
      resetWizard,
      goToNextStep,
      goToPreviousStep,
      auxiliaryFileIds,
      hasInProgressImport,
    ]
  )

  return (
    <ContextoAssistenteImportacao.Provider value={value}>{children}</ContextoAssistenteImportacao.Provider>
  )
}

export function useAssistenteImportacao() {
  const context = useContext(ContextoAssistenteImportacao)
  if (!context) {
    throw new Error('useAssistenteImportacao deve ser usado dentro de ProvedorAssistenteImportacao')
  }
  return context
}
