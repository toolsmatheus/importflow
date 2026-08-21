import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Server, Sparkles, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { productService } from '@/services/productService'
import { formatNumber } from '@/lib/utils'
import type { TmsSendResult } from '@/types'

interface SendStepProps {
  rows: Record<string, string>[]
  tmsBaseUrl: string
  onTmsBaseUrlChange: (url: string) => void
  result: TmsSendResult | null
  onResult: (result: TmsSendResult | null) => void
  onBack: () => void
  onFinish: () => void
}

export function SendStep({
  rows,
  tmsBaseUrl,
  onTmsBaseUrlChange,
  result,
  onResult,
  onBack,
  onFinish,
}: SendStepProps) {
  const [idFilialPreview, setIdFilialPreview] = useState<number | null>(null)
  const [simulated, setSimulated] = useState(false)

  const identifyMutation = useMutation({
    mutationFn: () => productService.identifyServer(tmsBaseUrl),
    onSuccess: (data) => {
      setIdFilialPreview(data.idFilial)
      toast.success(`Servidor ok. Filial ${data.idFilial}`)
    },
    onError: (error: Error) => toast.error(error.message || 'Servidor indisponível'),
  })

  const sendMutation = useMutation({
    mutationFn: () => productService.send(rows, tmsBaseUrl),
    onSuccess: (data) => {
      setSimulated(false)
      onResult(data)
      if (data.errorCount === 0) {
        toast.success(`${formatNumber(data.successCount)} produto(s) enviados`)
      } else {
        toast.warning(
          `${formatNumber(data.successCount)} ok, ${formatNumber(data.errorCount)} falha(s)`
        )
      }
    },
    onError: (error: Error) => toast.error(error.message || 'Falha no envio'),
  })

  const simulateSend = () => {
    const fake: TmsSendResult = {
      idFilial: idFilialPreview ?? 1,
      total: rows.length,
      successCount: rows.length,
      errorCount: 0,
      errors: [],
    }
    setSimulated(true)
    onResult(fake)
    toast.success('Simulação concluída. Nenhum dado foi enviado ao TMS')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Envio</CardTitle>
          <CardDescription>
            O sistema identifica a filial no servidor e envia os produtos validados. Enquanto a API
            TMS não estiver pronta, use a simulação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Confirme a URL do servidor</li>
            <li>Teste a conexão (opcional)</li>
            <li>Envie os produtos ou simule o envio</li>
          </ol>

          <div>
            <label htmlFor="send-tms-url" className="mb-1.5 block text-sm text-muted-foreground">
              URL do servidor
            </label>
            <Input
              id="send-tms-url"
              value={tmsBaseUrl}
              onChange={(e) => onTmsBaseUrlChange(e.target.value)}
              placeholder="http://localhost:2001"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => identifyMutation.mutate()}
              disabled={identifyMutation.isPending || !tmsBaseUrl}
            >
              {identifyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Server className="h-4 w-4" />
              )}
              1. Testar servidor
            </Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || rows.length === 0}
            >
              {sendMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              2. Enviar {formatNumber(rows.length)} produto(s)
            </Button>
            <Button variant="secondary" onClick={simulateSend} disabled={rows.length === 0}>
              <Sparkles className="h-4 w-4" />
              Simular (sem TMS)
            </Button>
          </div>

          {idFilialPreview !== null && (
            <p className="text-sm text-muted-foreground">
              Filial detectada:{' '}
              <span className="font-mono text-foreground">{idFilialPreview}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {simulated ? 'Resultado da simulação' : 'Resultado do envio'}
            </CardTitle>
            <CardDescription>
              Filial {result.idFilial}: {formatNumber(result.successCount)} sucesso(s),{' '}
              {formatNumber(result.errorCount)} erro(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {simulated && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Nenhum dado foi enviado. Use “Enviar” quando o TMS estiver disponível.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {formatNumber(result.successCount)} ok
              </Badge>
              <Badge variant={result.errorCount > 0 ? 'destructive' : 'secondary'} className="gap-1">
                <XCircle className="h-3.5 w-3.5" />
                {formatNumber(result.errorCount)} falha(s)
              </Badge>
            </div>

            {result.errors.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.errors.map((err) => (
                    <TableRow key={`${err.index}-${err.codigo}`}>
                      <TableCell>{err.index + 2}</TableCell>
                      <TableCell className="font-mono">{err.codigo || '-'}</TableCell>
                      <TableCell className="text-destructive">{err.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onResult(null)
                setSimulated(false)
              }}
            >
              Limpar resultado e tentar de novo
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={sendMutation.isPending}>
          Voltar
        </Button>
        <Button onClick={onFinish} disabled={!result}>
          Concluir
        </Button>
      </div>
    </div>
  )
}
