import { Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function FavorecidosImportPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Favorecidos
          </CardTitle>
          <Badge variant="secondary">Em breve</Badge>
        </div>
        <CardDescription>
          Importação de fornecedores e favorecidos. Interface preparada; backend ainda não
          implementado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>Próximas etapas previstas nesta aba:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Modelo CSV de favorecidos / fornecedores</li>
          <li>Validação de documentos e vínculos</li>
          <li>Envio em lotes para o banco de dados</li>
        </ul>
      </CardContent>
    </Card>
  )
}
