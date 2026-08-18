import { Header } from '@/components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/ThemeToggle'

export function SettingsPage() {
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

      <Card>
        <CardHeader>
          <CardTitle>Dados da sessão</CardTitle>
          <CardDescription>
            As credenciais MySQL não são gravadas no navegador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nesta versão MVP, a preferência de tema é a única configuração guardada no
            navegador. As credenciais MySQL ficam apenas na sessão temporária do servidor.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
