import { useNavigate } from 'react-router-dom'
import { Upload, FileSpreadsheet, Package, ListChecks, ArrowRight } from 'lucide-react'
import { Header } from '@/components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useImportWizard, WIZARD_STEP_LABELS } from '@/hooks/useImportWizard'

export function DashboardPage() {
  const navigate = useNavigate()
  const { currentStep, csvAnalysis, hasInProgressImport, resetWizard } = useImportWizard()

  return (
    <div>
      <Header
        title="ImportFlow"
        description="Importe produtos via CSV com validação antes do envio ao servidor."
      />

      <Card className="mb-8 border-primary/20 bg-gradient-to-br from-accent/40 to-card">
        <CardHeader>
          <CardTitle>Importação de produtos</CardTitle>
          <CardDescription>
            Baixe o modelo, preencha a planilha, valide com os arquivos auxiliares e envie quando
            estiver tudo certo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {hasInProgressImport ? (
            <>
              <Button onClick={() => navigate('/import')} size="lg">
                Continuar importação
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  resetWizard()
                  navigate('/import')
                }}
              >
                Começar do zero
              </Button>
            </>
          ) : (
            <Button onClick={() => navigate('/import')} size="lg">
              <Upload className="h-4 w-4" />
              Nova importação
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-lg bg-accent p-2.5">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Modelo CSV</p>
              <p className="font-semibold">Colunas fixas</p>
              <p className="text-xs text-muted-foreground">Evita erro de cabeçalho</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-lg bg-accent p-2.5">
              <ListChecks className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Progresso</p>
              <p className="font-semibold">{WIZARD_STEP_LABELS[currentStep]}</p>
              <p className="text-xs text-muted-foreground">
                {csvAnalysis ? csvAnalysis.fileName : 'Nenhum arquivo enviado'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-lg bg-accent p-2.5">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Destino</p>
              <p className="font-semibold">Servidor TMS</p>
              <p className="text-xs text-muted-foreground">Após validação completa</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
