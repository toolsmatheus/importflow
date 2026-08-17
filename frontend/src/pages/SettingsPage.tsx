import { Header } from '@/components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SettingsPage() {
  return (
    <div>
      <Header title="Configurações" description="Preferências da aplicação." />
      <Card>
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
          <CardDescription>
            Configurações adicionais estarão disponíveis em versões futuras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nesta versão MVP, não há configurações persistentes. As credenciais MySQL são mantidas
            apenas durante a sessão de importação no servidor.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
