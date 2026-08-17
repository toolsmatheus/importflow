import { useCallback, useState } from 'react'
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface FileDropzoneProps {
  onFileSelect: (file: File) => void
  isLoading?: boolean
  selectedFile?: File | null
}

export function FileDropzone({ onFileSelect, isLoading, selectedFile }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && file.name.endsWith('.csv')) {
        onFileSelect(file)
      }
    },
    [onFileSelect]
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selecione o arquivo</CardTitle>
        <CardDescription>Envie o arquivo CSV que deseja importar.</CardDescription>
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
            isDragging ? 'border-primary bg-accent/50' : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-accent/20',
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
              <p className="text-sm text-muted-foreground">Arquivo selecionado</p>
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
            accept=".csv"
            onChange={handleFileInput}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={isLoading}
          />
        </div>
      </CardContent>
    </Card>
  )
}
