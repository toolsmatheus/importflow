import { useMemo, useState } from 'react'
import { Download, Percent, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  findAliquotaMismatches,
  formatAliquotaCsv,
  getUfIcms,
  summarizeAliquotaMismatches,
  type AliquotaMismatch,
} from '@/lib/icmsByUf'
import { formatNumber } from '@/lib/utils'

const PREVIEW_LIMIT = 200

interface AliquotaUfReviewPanelProps {
  rows: Record<string, string>[]
  clientUf: string
  truncatedIssues?: boolean
  onApplyUfStandard: (mismatches: AliquotaMismatch[]) => void
}

function downloadMismatchesCsv(mismatches: AliquotaMismatch[], uf: string, expected: number) {
  const header = 'linha;codigo;nome;codigobarras;codigogrupo;aliquota_atual;aliquota_esperada_uf;uf'
  const lines = mismatches.map((m) =>
    [
      m.row,
      m.codigo,
      `"${m.nome.replace(/"/g, '""')}"`,
      m.codigobarras,
      m.codigogrupo,
      m.currentRaw || formatAliquotaCsv(m.current),
      formatAliquotaCsv(expected),
      uf,
    ].join(';')
  )
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `aliquotas-diferenciadas-${uf}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Mostra divergências de alíquota × UF: primeiro visualizar, depois escolher ação.
 * Não altera nada até o usuário confirmar "Aplicar padrão da UF".
 */
export function AliquotaUfReviewPanel({
  rows,
  clientUf,
  truncatedIssues,
  onApplyUfStandard,
}: AliquotaUfReviewPanelProps) {
  const [open, setOpen] = useState(false)
  const [confirmApply, setConfirmApply] = useState(false)

  const review = useMemo(() => findAliquotaMismatches(rows, clientUf), [rows, clientUf])
  const ufEntry = getUfIcms(clientUf)

  if (!review || review.mismatches.length === 0 || !ufEntry) return null

  const { mismatches, expected } = review
  const summary = summarizeAliquotaMismatches(mismatches)
  const preview = mismatches.slice(0, PREVIEW_LIMIT)
  const expectedLabel = formatAliquotaCsv(expected)

  const handleKeep = () => {
    setConfirmApply(false)
    setOpen(false)
  }

  const handleAskApply = () => setConfirmApply(true)

  const handleConfirmApply = () => {
    onApplyUfStandard(mismatches)
    setConfirmApply(false)
    setOpen(false)
  }

  return (
    <>
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
        <CardContent className="space-y-3 p-4 text-sm text-amber-900 dark:text-amber-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-medium">
                <Percent className="h-4 w-4 shrink-0" />
                Alíquota × UF {clientUf}
              </p>
              <p>
                Padrão da UF:{' '}
                <span className="font-mono font-medium">{expectedLabel}%</span>
                {ufEntry.note ? ` (${ufEntry.note})` : ''}. Há{' '}
                <span className="font-medium">{formatNumber(mismatches.length)}</span> produto(s)
                com alíquota diferente
                {truncatedIssues ? ' (avisos de validação podem estar truncados)' : ''}. Isso não
                bloqueia o envio — revise antes de alterar.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Search className="h-4 w-4" />
              Verificar alíquotas diferenciadas
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setConfirmApply(false)
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>Alíquotas diferenciadas — UF {clientUf}</DialogTitle>
            <DialogDescription>
              Esperado: <span className="font-mono">{expectedLabel}%</span>
              {ufEntry.note ? ` (${ufEntry.note})` : ''}. Revise a lista e escolha a ação.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Resumo por alíquota atual</p>
              <div className="flex flex-wrap gap-2">
                {summary.map((s) => (
                  <Badge key={s.label} variant="secondary" className="font-mono text-xs">
                    {s.label}% → {formatNumber(s.count)} item(ns)
                  </Badge>
                ))}
                <Badge variant="outline" className="font-mono text-xs">
                  padrão UF {expectedLabel}%
                </Badge>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Linha</TableHead>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead className="min-w-[140px]">Cód. barras</TableHead>
                    <TableHead className="w-20">Grupo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-28 text-right">Atual</TableHead>
                    <TableHead className="w-28 text-right">Esperada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((m) => (
                    <TableRow key={`${m.row}-${m.codigo}`}>
                      <TableCell className="font-mono text-xs">{m.row}</TableCell>
                      <TableCell className="font-mono text-xs">{m.codigo || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{m.codigobarras || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{m.codigogrupo || '—'}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-sm" title={m.nome}>
                        {m.nome || '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-amber-700 dark:text-amber-300">
                        {m.currentRaw || formatAliquotaCsv(m.current)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {expectedLabel}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {mismatches.length > PREVIEW_LIMIT && (
              <p className="text-xs text-muted-foreground">
                Mostrando {formatNumber(PREVIEW_LIMIT)} de {formatNumber(mismatches.length)}. Use
                &quot;Exportar CSV&quot; para a lista completa.
              </p>
            )}

            {confirmApply && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
                <p className="font-medium">Confirmar alteração?</p>
                <p className="mt-1">
                  Aplicar <span className="font-mono">{expectedLabel}%</span> em{' '}
                  <strong>{formatNumber(mismatches.length)}</strong> produto(s). Os avisos de
                  alíquota × UF serão removidos da validação atual. Isso não pode ser desfeito
                  automaticamente — use Revalidar se precisar comparar de novo.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => downloadMismatchesCsv(mismatches, clientUf, expected)}
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              {!confirmApply ? (
                <>
                  <Button type="button" variant="outline" onClick={handleKeep}>
                    Manter como estão
                  </Button>
                  <Button type="button" onClick={handleAskApply}>
                    Aplicar padrão da UF ({expectedLabel}%)
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setConfirmApply(false)}>
                    Voltar
                  </Button>
                  <Button type="button" onClick={handleConfirmApply}>
                    Confirmar aplicação
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
