import { useMemo, useState } from 'react'
import { Download, Percent, Search } from 'lucide-react'
import {
  findAliquotaMismatches,
  formatAliquotaCsv,
  getUfIcms,
  summarizeAliquotaMismatches,
  type AliquotaMismatch,
} from '@/lib/icmsByUf'
import { formatNumber } from '@/lib/utils'
import { Button, Badge, Card, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, GridTh, GridCell } from '@/components'
const PREVIEW_LIMIT = 200

interface PainelRevisaoAliquotaUfProps {
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
export function PainelRevisaoAliquotaUf({
  rows,
  clientUf,
  truncatedIssues,
  onApplyUfStandard,
}: PainelRevisaoAliquotaUfProps) {
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
      <Card variant="panel" className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
        <div className="space-y-3 p-4 text-sm text-amber-900 dark:text-amber-100">
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
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              <Search className="h-4 w-4" />
              Verificar alíquotas diferenciadas
            </Button>
          </div>
        </div>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setConfirmApply(false)
        }}
      >
        <DialogContent className="flex h-[min(92vh,880px)] w-[min(96vw,80rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 text-left sm:px-6 sm:py-4">
            <DialogTitle>Alíquotas diferenciadas — UF {clientUf}</DialogTitle>
            <DialogDescription>
              Esperado: <span className="font-mono">{expectedLabel}%</span>
              {ufEntry.note ? ` (${ufEntry.note})` : ''}. Revise a lista e escolha a ação.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
            <div className="shrink-0">
              <p className="mb-2 text-sm font-medium text-fg-strong">Resumo por alíquota atual</p>
              <div className="flex flex-wrap gap-2">
                {summary.map((s) => (
                  <Badge key={s.label} variant="neutral" className="font-mono text-xs">
                    {s.label}% → {formatNumber(s.count)} item(ns)
                  </Badge>
                ))}
                <Badge variant="neutral" className="font-mono text-xs">
                  padrão UF {expectedLabel}%
                </Badge>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-md border">
              <table className="w-full min-w-[44rem] border-collapse font-data text-sm">
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr>
                    <GridTh className="w-14 whitespace-nowrap">Linha</GridTh>
                    <GridTh className="w-20 whitespace-nowrap">Código</GridTh>
                    <GridTh className="hidden whitespace-nowrap md:table-cell md:w-36">
                      Cód. barras
                    </GridTh>
                    <GridTh className="hidden w-16 whitespace-nowrap sm:table-cell">Grupo</GridTh>
                    <GridTh className="min-w-[10rem]">Nome</GridTh>
                    <GridTh className="w-20 whitespace-nowrap text-right">Atual</GridTh>
                    <GridTh className="w-24 whitespace-nowrap text-right">Esperada</GridTh>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((m) => (
                    <tr key={`${m.row}-${m.codigo}`}>
                      <GridCell className="whitespace-nowrap font-mono text-xs">{m.row}</GridCell>
                      <GridCell className="whitespace-nowrap font-mono text-xs">
                        {m.codigo || '—'}
                      </GridCell>
                      <GridCell className="hidden whitespace-nowrap font-mono text-xs md:table-cell">
                        {m.codigobarras || '—'}
                      </GridCell>
                      <GridCell className="hidden whitespace-nowrap font-mono text-xs sm:table-cell">
                        {m.codigogrupo || '—'}
                      </GridCell>
                      <GridCell className="max-w-[14rem] truncate text-sm sm:max-w-[22rem] lg:max-w-none lg:whitespace-normal" title={m.nome}>
                        {m.nome || '—'}
                      </GridCell>
                      <GridCell className="whitespace-nowrap text-right font-mono text-sm text-amber-700 dark:text-amber-300">
                        {m.currentRaw || formatAliquotaCsv(m.current)}%
                      </GridCell>
                      <GridCell className="whitespace-nowrap text-right font-mono text-sm">
                        {expectedLabel}%
                      </GridCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {mismatches.length > PREVIEW_LIMIT && (
              <p className="shrink-0 text-xs text-fg-muted">
                Mostrando {formatNumber(PREVIEW_LIMIT)} de {formatNumber(mismatches.length)}. Use
                &quot;Exportar CSV&quot; para a lista completa.
              </p>
            )}

            {confirmApply && (
              <div className="shrink-0 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
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

          <DialogFooter className="shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => downloadMismatchesCsv(mismatches, clientUf, expected)}
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              {!confirmApply ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={handleKeep}
                  >
                    Manter como estão
                  </Button>
                  <Button type="button" className="w-full sm:w-auto" onClick={handleAskApply}>
                    Aplicar padrão da UF ({expectedLabel}%)
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => setConfirmApply(false)}
                  >
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={handleConfirmApply}
                  >
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
