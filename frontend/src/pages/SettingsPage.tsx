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
          <CardTitle>Servidor TMS</CardTitle>
          <CardDescription>
            URL base usada na etapa de envio. Guardada neste navegador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label htmlFor="tms-url" className="mb-1.5 block text-sm text-muted-foreground">
            URL base
          </label>
          <Input
            id="tms-url"
            value={tmsBaseUrl}
            onChange={(e) => setTmsBaseUrl(e.target.value)}
            placeholder="http://localhost:2001"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sobre esta versão</CardTitle>
          <CardDescription>Importação de produtos via CSV para a API TMS.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tema, URL do TMS e o último caminho de pasta automática ficam neste navegador.
            Enquanto a API de insert não estiver disponível, use a simulação na etapa de envio.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
