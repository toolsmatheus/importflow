import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatDuration, formatNumber } from '@/lib/utils'
import type { ImportProgress } from '@/types'

interface ImportProgressProps {
  progress: ImportProgress
}

export function ImportProgressComponent({ progress }: ImportProgressProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Importando dados...
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Progress value={progress.progress} className="h-3" />
          <div className="flex justify-between text-sm">
            <span className="font-medium">{progress.progress}%</span>
            <span className="text-muted-foreground">
              {formatNumber(progress.processed)} / {formatNumber(progress.total)}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-green-50 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{formatNumber(progress.inserted)}</p>
            <p className="text-sm text-green-600">Inseridos</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{formatNumber(progress.updated)}</p>
            <p className="text-sm text-blue-600">Atualizados</p>
          </div>
          <div className="rounded-lg bg-slate-100 p-4 text-center">
            <p className="text-2xl font-bold text-slate-700">{formatNumber(progress.skipped)}</p>
            <p className="text-sm text-slate-600">Ignorados</p>
          </div>
          <div className="rounded-lg bg-red-50 p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{formatNumber(progress.errors)}</p>
            <p className="text-sm text-red-600">Erros</p>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Tempo decorrido: {formatDuration(progress.elapsedSeconds)}
        </p>
      </CardContent>
    </Card>
  )
}
