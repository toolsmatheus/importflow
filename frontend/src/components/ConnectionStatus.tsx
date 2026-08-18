import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { ConnectionTestResult } from '@/types'

interface ConnectionStatusProps {
  result: ConnectionTestResult | null
  isLoading?: boolean
}

export function ConnectionStatus({ result, isLoading }: ConnectionStatusProps) {
  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-accent/30">
        <CardContent className="flex items-center gap-3 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Testando conexão...</span>
        </CardContent>
      </Card>
    )
  }

  if (!result) return null

  if (result.success) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">Conexão realizada com sucesso</p>
              <div className="mt-2 space-y-1 text-sm text-green-700 dark:text-green-300">
                {result.connectionName && <p className="font-medium">{result.connectionName}</p>}
                <p>{result.host}:{result.port}</p>
                <p>{result.database}</p>
                <p className="text-green-600 dark:text-green-400">{result.responseTimeMs}ms</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
      <CardContent className="flex items-start gap-3 p-4">
        <XCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
        <div>
          <p className="font-medium text-red-800 dark:text-red-200">Não foi possível conectar ao banco.</p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {result.message ?? 'Verifique os dados informados e tente novamente.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
