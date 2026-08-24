import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, FolderOpen, Loader2, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { productService } from '@/services/productService'
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

  const expectQuery = useQuery({
    queryKey: ['folder-expect'],
    queryFn: () => productService.getFolderExpect(),
  })

  const resolvedPath = folderPath.trim() || DEFAULT_FOLDER_PATH

  const collectMutation = useMutation({
    mutationFn: () => productService.collectFolder(resolvedPath),
    onSuccess: (result) => {
      setLastResult(result)
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

  const expectedItems =
    expectQuery.data?.expected.filter((item) =>
      auxiliariesOnly ? item.role !== 'produtos' : true
    ) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderOpen className="h-5 w-5 text-primary" />
          Coletar da pasta
        </CardTitle>
        <CardDescription>
          Pasta padrão: <span className="font-mono">{DEFAULT_FOLDER_PATH}</span>.{' '}
          {auxiliariesOnly
            ? 'Busca grupo.csv, subgrupo.csv, categoria.csv, etc.'
            : 'Busca arquivos pelo nome (produtos.csv, grupo.csv, etc.).'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="folder-path" className="mb-1.5 block text-sm text-muted-foreground">
            Caminho da pasta
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="folder-path"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              onBlur={() => {
                if (!folderPath.trim()) setFolderPath(DEFAULT_FOLDER_PATH)
              }}
              placeholder={DEFAULT_FOLDER_PATH}
            />
            <Button
              type="button"
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
              Coletar agora
            </Button>
          </div>
        </div>

        {expectedItems.length > 0 && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Nomes reconhecidos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {expectedItems.map((item) => (
                <Badge key={item.role} variant="outline" className="font-mono font-normal">
                  {item.names[0]}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {lastResult && (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Pasta: <span className="font-mono text-foreground">{lastResult.folderPath}</span>
            </p>
            <ul className="space-y-1">
              {lastResult.found
                .filter((item) => (auxiliariesOnly ? item.role !== 'produtos' : true))
                .map((item) => (
                  <li key={`${item.role}-${item.fileName}`} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="font-mono">{item.fileName}</span>
                    <span className="text-muted-foreground">({item.role})</span>
                  </li>
                ))}
              {lastResult.missing
                .filter((name) => (auxiliariesOnly ? !name.toLowerCase().includes('produto') : true))
                .map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-2 text-amber-700 dark:text-amber-300"
                  >
                    <XCircle className="h-4 w-4" />
                    Faltando: <span className="font-mono">{name}</span>
                  </li>
                ))}
            </ul>
            {lastResult.ignored.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Ignorados: {lastResult.ignored.join(', ')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
