import { useNavigate } from 'react-router-dom'
import {
  Upload,
  Database,
  FileSpreadsheet,
  Hash,
  Activity,
} from 'lucide-react'
import { Header } from '@/components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useImportWizard } from '@/hooks/useImportWizard'
import { formatNumber } from '@/lib/utils'

export function DashboardPage() {
  const navigate = useNavigate()
  const {
    connection,
    connectionTested,
    csvAnalysis,
    importResult,
    importProgress,
  } = useImportWizard()

  const status = importResult
    ? 'Concluída'
    : importProgress
      ? 'Importando'
      : csvAnalysis
        ? 'Arquivo pronto'
        : connectionTested
          ? 'Conectado'
          : 'Aguardando'

  const statusVariant = importResult
    ? 'success'
    : importProgress
      ? 'default'
      : connectionTested
        ? 'secondary'
        : 'outline'

  return (
    <div>
      <Header
        title="ImportFlow"
        description="Importe dados para seu banco MySQL de forma simples e segura."
      />

      <Card className="mb-8 border-primary/20 bg-gradient-to-br from-accent/40 to-card">
        <CardHeader>
          <CardTitle>Nova importação</CardTitle>
          <CardDescription>
            Envie um arquivo CSV e importe seus dados diretamente para uma tabela MySQL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/import')} size="lg">
            <Upload className="h-4 w-4" />
            Nova importação
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-lg bg-accent p-2.5">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Banco conectado</p>
              <p className="font-semibold">
                {connectionTested && connection
                  ? connection.database
                  : 'Nenhum'}
              </p>
              {connection && (
                <p className="text-xs text-muted-foreground">{connection.name}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-lg bg-accent p-2.5">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Arquivo selecionado</p>
              <p className="font-semibold">{csvAnalysis?.fileName ?? 'Nenhum'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-lg bg-accent p-2.5">
              <Hash className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Registros</p>
              <p className="font-semibold">
                {csvAnalysis ? formatNumber(csvAnalysis.recordCount) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-lg bg-accent p-2.5">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={statusVariant as 'default'} className="mt-1">
                {status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
