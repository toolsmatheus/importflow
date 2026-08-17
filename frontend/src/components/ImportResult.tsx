import { CheckCircle2, RefreshCw, XCircle, Clock, SkipForward, AlertOctagon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDuration, formatNumber } from '@/lib/utils'
import type { ImportResult } from '@/types'

interface ImportResultProps {
  result: ImportResult
  onViewDetails: () => void
  onNewImport: () => void
}

export function ImportResultComponent({ result, onViewDetails, onNewImport }: ImportResultProps) {
  const failed = result.status === 'failed'

  return (
    <Card className={failed ? 'border-red-200' : 'border-green-200'}>
      <CardHeader className="text-center">
        <div
          className={`mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full ${
            failed ? 'bg-red-100' : 'bg-green-100'
          }`}
        >
          {failed ? (
            <AlertOctagon className="h-10 w-10 text-red-600" />
          ) : (
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          )}
        </div>
        <CardTitle className={`text-xl ${failed ? 'text-red-800' : 'text-green-800'}`}>
          {failed ? 'Importação interrompida' : 'Importação concluída'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-center text-muted-foreground">
          {formatNumber(result.totalProcessed)} registros processados
        </p>

        {result.message && (
          <p
            className={`rounded-lg p-3 text-center text-sm ${
              failed ? 'bg-red-50 text-red-700' : 'bg-muted text-muted-foreground'
            }`}
          >
            {result.message}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
            <div>
              <p className="text-xl font-bold text-green-800">{formatNumber(result.inserted)}</p>
              <p className="text-sm text-green-600">inseridos</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-4">
            <RefreshCw className="h-6 w-6 shrink-0 text-blue-600" />
            <div>
              <p className="text-xl font-bold text-blue-800">{formatNumber(result.updated)}</p>
              <p className="text-sm text-blue-600">atualizados</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-slate-100 p-4">
            <SkipForward className="h-6 w-6 shrink-0 text-slate-600" />
            <div>
              <p className="text-xl font-bold text-slate-800">{formatNumber(result.skipped)}</p>
              <p className="text-sm text-slate-600">ignorados</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4">
            <XCircle className="h-6 w-6 shrink-0 text-red-600" />
            <div>
              <p className="text-xl font-bold text-red-800">{formatNumber(result.errors)}</p>
              <p className="text-sm text-red-600">erros</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Tempo total: {formatDuration(result.durationSeconds)}
        </div>

        <div className="flex justify-center gap-3">
          {result.errors > 0 && (
            <Button variant="outline" onClick={onViewDetails}>
              Ver detalhes
            </Button>
          )}
          <Button onClick={onNewImport}>Nova importação</Button>
        </div>
      </CardContent>
    </Card>
  )
}
