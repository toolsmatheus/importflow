import { useCallback, useId, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  ClipboardCopy,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatBytes } from '@/lib/utils'
import { OPTIONAL_IMPORT_META } from '@/lib/optionalImportMeta'
import type { OptionalImportKind } from '@/types'

interface OptionalImportPanelProps {
  kind: OptionalImportKind
  onBack: () => void
  /** Volta para a lista de temas (Opcionais). */
  onBackToThemes?: () => void
  themeLabel?: string
  icon?: ReactNode
}

function isCsvFile(file: File) {
  return file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
}

export function OptionalImportPanel({
  kind,
  onBack,
  onBackToThemes,
  themeLabel = 'Produtos',
  icon,
}: OptionalImportPanelProps) {
  const meta = OPTIONAL_IMPORT_META[kind]
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const headerLine = meta.columns.join(';')

  const acceptFile = useCallback((file: File | undefined) => {
    if (!file) return
    if (!isCsvFile(file)) {
      toast.error('Envie apenas arquivos .csv')
      return
    }
    setSelectedFile(file)
  }, [])

  const copyHeader = async () => {
    try {
      await navigator.clipboard.writeText(headerLine)
      toast.success('Cabeçalho copiado')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Selecione um CSV antes de importar')
      return
    }

    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 500))
    setIsSubmitting(false)
    toast.message('Backend ainda não conectado', {
      description: `${meta.shortLabel}: a tela está pronta; o envio será ligado em seguida.`,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={onBackToThemes ?? onBack}
          className="rounded-md px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
        >
          Opcionais
        </button>
        <span aria-hidden>/</span>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
        >
          {themeLabel}
        </button>
        <span aria-hidden>/</span>
        <span className="font-medium text-foreground">{meta.shortLabel}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <Card className="order-2 lg:order-1">
          <CardHeader className="space-y-3">
            <div className="flex items-start gap-3">
              {icon ? (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg leading-snug">{meta.title}</CardTitle>
                <CardDescription>{meta.description}</CardDescription>
              </div>
            </div>
            <p className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {meta.whenToUse}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Modelo do CSV</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyHeader()}>
                <ClipboardCopy className="h-3.5 w-3.5" />
                Copiar cabeçalho
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    {meta.columns.map((col) => (
                      <TableHead key={col} className="font-mono text-xs">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    {meta.sampleRow.map((value, i) => (
                      <TableCell key={`${meta.columns[i]}-${i}`} className="font-mono text-xs text-muted-foreground">
                        {value}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <p className="text-sm text-muted-foreground">{meta.sourceHint}</p>
            <p className="font-mono text-xs text-muted-foreground">
              Ex.: {meta.exampleFileName} · delimitador ;
            </p>
          </CardContent>
        </Card>

        <Card className="order-1 lg:order-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Arquivo</CardTitle>
              <Badge variant={selectedFile ? 'default' : 'secondary'}>
                {selectedFile ? 'Pronto' : 'Aguardando CSV'}
              </Badge>
            </div>
            <CardDescription>Arraste o arquivo ou selecione no computador.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                acceptFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />

            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  inputRef.current?.click()
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                acceptFile(e.dataTransfer.files[0])
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all outline-none',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isDragging && 'scale-[1.01] border-primary bg-accent/60 shadow-sm',
                !isDragging &&
                  !selectedFile &&
                  'border-border bg-muted/20 hover:border-primary/50 hover:bg-accent/30',
                selectedFile && !isDragging && 'border-primary/40 bg-accent/20'
              )}
            >
              {selectedFile ? (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p className="flex items-center gap-2 font-medium">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    {selectedFile.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatBytes(selectedFile.size)}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-4"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFile(null)
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                    Remover
                  </Button>
                </>
              ) : (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="font-medium">Solte o CSV aqui</p>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    ou clique para escolher · apenas .csv
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
                Voltar
              </Button>
              <Button
                type="button"
                className="ml-auto"
                onClick={() => void handleImport()}
                disabled={isSubmitting || !selectedFile}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Importar {meta.shortLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
