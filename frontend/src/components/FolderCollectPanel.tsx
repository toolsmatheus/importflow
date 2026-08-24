import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, ChevronDown, FolderOpen, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { productService } from '@/services/productService'
import { cn } from '@/lib/utils'
import type { FolderCollectResult } from '@/types'

const FOLDER_PATH_KEY = 'importflow.collectFolderPath'
export const DEFAULT_FOLDER_PATH = 'C:\\ToolsPharma\\Migracao'
const LEGACY_FOLDER_PATHS = ['C:\\ToolsPharma\\Migração', 'C:\\ToolsPharma\\Migraçao']

interface FolderCollectPanelProps {
  onCollected: (result: FolderCollectResult) => void
  /** full = produtos+auxiliares; auxiliaries = só CSVs auxiliares */
  mode?: 'full' | 'auxiliaries'
}

function readStoredFolder(): string {
  try {
    const stored = localStorage.getItem(FOLDER_PATH_KEY)?.trim()
    if (!stored || LEGACY_FOLDER_PATHS.includes(stored)) return DEFAULT_FOLDER_PATH
    return stored
  } catch {
    return DEFAULT_FOLDER_PATH
  }
}

export function FolderCollectPanel({
  onCollected,
  mode = 'full',
}: FolderCollectPanelProps) {
  const [folderPath, setFolderPath] = useState(DEFAULT_FOLDER_PATH)
  const [lastResult, setLastResult] = useState<FolderCollectResult | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const auxiliariesOnly = mode === 'auxiliaries'

  useEffect(() => {
    const initial = readStoredFolder()
    setFolderPath(initial)
    try {
      localStorage.setItem(FOLDER_PATH_KEY, initial)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const trimmed = folderPath.trim()
    if (!trimmed) return
    try {
      localStorage.setItem(FOLDER_PATH_KEY, trimmed)
    } catch {
      /* ignore */
    }
  }, [folderPath])

  const resolvedPath = folderPath.trim() || DEFAULT_FOLDER_PATH

  const collectMutation = useMutation({
    mutationFn: () => productService.collectFolder(resolvedPath),
    onSuccess: (result) => {
      setLastResult(result)
      setDetailsOpen(false)
      onCollected(result)

      const auxCount = Object.keys(result.auxiliaries).length
      const missingAux = result.missing.filter((name) => name !== 'produtos.csv')

      if (auxiliariesOnly) {
        if (auxCount === 0) {
          toast.error('Nenhum CSV auxiliar encontrado na pasta')
          return
        }
        toast.success(
          `Coletados ${auxCount} auxiliar(es)${
            missingAux.length ? `. Faltando: ${missingAux.join(', ')}` : ''
          }`
        )
        return
      }

      if (!result.products) {
        toast.error('produtos.csv (ou alias) não encontrado na pasta')
        return
      }

      toast.success(
        `Coletados: produtos + ${auxCount} auxiliar(es)${
          result.missing.length ? `. Faltando: ${result.missing.join(', ')}` : ''
        }`
      )
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao coletar pasta'),
  })

  const foundFiltered =
    lastResult?.found.filter((item) => (auxiliariesOnly ? item.role !== 'produtos' : true)) ??
    []
  const missingFiltered =
    lastResult?.missing.filter((name) =>
      auxiliariesOnly ? !name.toLowerCase().includes('produto') : true
    ) ?? []

  const summaryParts: string[] = []
  if (lastResult) {
    if (!auxiliariesOnly && lastResult.products) summaryParts.push('produtos')
    if (foundFiltered.length) {
      summaryParts.push(
        `${foundFiltered.filter((f) => f.role !== 'produtos').length || foundFiltered.length} auxiliar(es)`
      )
    }
    if (missingFiltered.length) summaryParts.push(`${missingFiltered.length} faltando`)
  }

  return (
    <div className="space-y-2 rounded-lg border border-border px-3 py-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        Coletar pasta
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="folder-path"
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          onBlur={() => {
            if (!folderPath.trim()) setFolderPath(DEFAULT_FOLDER_PATH)
          }}
          placeholder={DEFAULT_FOLDER_PATH}
          className="font-mono text-sm"
        />
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          onClick={() => {
            if (!folderPath.trim()) setFolderPath(DEFAULT_FOLDER_PATH)
            collectMutation.mutate()
          }}
          disabled={collectMutation.isPending}
        >
          {collectMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderOpen className="h-4 w-4" />
          )}
          Coletar
        </Button>
      </div>

      {lastResult && (
        <div className="space-y-1.5 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{summaryParts.join(' · ') || 'Sem arquivos'}</p>
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {detailsOpen ? 'Ocultar' : 'Detalhes'}
              <ChevronDown className={cn('h-3.5 w-3.5', detailsOpen && 'rotate-180')} />
            </button>
          </div>

          {detailsOpen && (
            <ul className="space-y-1 text-xs">
              {foundFiltered.map((item) => (
                <li key={`${item.role}-${item.fileName}`} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-mono">{item.fileName}</span>
                </li>
              ))}
              {missingFiltered.map((name) => (
                <li
                  key={name}
                  className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span className="font-mono">{name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
