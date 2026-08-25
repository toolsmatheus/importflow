import { Header } from '@/components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Input } from '@/components/ui/input'
import { useImportWizard } from '@/hooks/useImportWizard'

export function SettingsPage() {
  const { tmsBaseUrl, setTmsBaseUrl } = useImportWizard()

  return (
    <div>
      <Header title="Configurações" description="Preferências da aplicação." />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>
            Escolha o tema claro, escuro ou acompanhe a configuração do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Banco de dados</CardTitle>
          <CardDescription>
            URL base usada na etapa de envio. Guardada neste navegador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label htmlFor="server-url" className="mb-1.5 block text-sm text-muted-foreground">
            URL do banco
          </label>
          <Input
            id="server-url"
            value={tmsBaseUrl}
            onChange={(e) => setTmsBaseUrl(e.target.value)}
            placeholder="http://localhost:2001"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sobre esta versão</CardTitle>
          <CardDescription>Importação de produtos via CSV para o banco de dados.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tema, URL do banco e o último caminho de pasta automática ficam neste navegador.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
