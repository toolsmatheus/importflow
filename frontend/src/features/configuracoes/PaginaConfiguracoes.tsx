import { Cabecalho } from '@/components/shared/Cabecalho'
import { useAssistenteImportacao } from '@/features/produtos/useAssistenteImportacao'
import { Card, Input } from '@/components'

export function PaginaConfiguracoes() {
  const { tmsBaseUrl, setTmsBaseUrl } = useAssistenteImportacao()

  return (
    <div>
      <Cabecalho title="Configurações" description="Preferências da aplicação." />

      <Card variant="panel" className="mb-6 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-fg-strong">Banco de dados</h2>
          <p className="text-sm text-fg-muted">
            URL base usada na etapa de envio. Guardada neste navegador.
          </p>
        </div>
        <div>
          <label htmlFor="server-url" className="mb-1.5 block text-sm text-fg-muted">
            URL do banco
          </label>
          <Input
            id="server-url"
            value={tmsBaseUrl}
            onChange={(e) => setTmsBaseUrl(e.target.value)}
            placeholder="http://localhost:2001"
          />
        </div>
      </Card>

      <Card variant="panel" className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-fg-strong">Sobre esta versão</h2>
          <p className="text-sm text-fg-muted">Importação de produtos via CSV para o banco de dados.</p>
        </div>
        <p className="text-sm text-fg-muted">
          URL do banco e o último caminho de pasta automática ficam neste navegador. Aparência segue o
          design system ToolsPharma.
        </p>
      </Card>
    </div>
  )
}
