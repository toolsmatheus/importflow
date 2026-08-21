import { useCallback, useState } from 'react'
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface FileDropzoneProps {
  onFileSelect: (file: File) => void
  isLoading?: boolean
  selectedFile?: File | null
}

function isCsvFile(file: File) {
  return file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
}

export function FileDropzone({ onFileSelect, isLoading, selectedFile }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const acceptFile = useCallback(
    (file: File | undefined) => {
      if (!file) return
      if (!isCsvFile(file)) {
        toast.error('Envie apenas arquivos .csv')
        return
      }
      onFileSelect(file)
    },
    [onFileSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      acceptFile(e.dataTransfer.files[0])
    },
    [acceptFile]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selecione o arquivo</CardTitle>
        <CardDescription>
          Envie o CSV de produtos preenchido a partir do modelo (delimitador ;).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors',
            isDragging
              ? 'border-primary bg-accent/50'
              : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-accent/20',
            isLoading && 'pointer-events-none opacity-60'
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">Analisando arquivo...</p>
            </>
          ) : selectedFile ? (
            <>
              <FileSpreadsheet className="h-12 w-12 text-primary" />
              <p className="mt-4 font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">Clique ou arraste outro arquivo para trocar</p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 font-medium">Arraste seu arquivo CSV aqui</p>
              <p className="text-sm text-muted-foreground">ou clique para procurar</p>
            </>
          )}
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Selecionar arquivo CSV de produtos"
            onChange={(e) => {
              acceptFile(e.target.files?.[0])
              e.target.value = ''
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={isLoading}
          />
        </div>
      </CardContent>
    </Card>
  )
}
