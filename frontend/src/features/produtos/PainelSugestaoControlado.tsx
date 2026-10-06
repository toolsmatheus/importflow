import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ShieldAlert } from 'lucide-react'
import { produtoServico } from '@/api/produto'
import { formatNumber } from '@/lib/utils'
import type { AuxiliaryEntity, ControladoSuggestion, ControladoSuggestResult } from '@/types'
import { Button, Badge, Card, Checkbox, GridTh, GridCell } from '@/components'
interface PainelSugestaoControladoProps {
  rows: Record<string, string>[]
  auxiliary: Partial<Record<AuxiliaryEntity, string>>
  /** Só consulta/visualiza — não aplica alterações nas linhas. */
  readOnly?: boolean
  /** Indica que a revalidação após aplicar está em andamento. */
  isApplying?: boolean
  onApply?: (nextRows: Record<string, string>[]) => void | Promise<void>
}

const KIND_LABEL: Record<ControladoSuggestion['kind'], string> = {
  empty: 'Preencher',
  conflict: 'Conflito',
  confirm: 'Confirmar',
}

export function PainelSugestaoControlado({
  rows,
  auxiliary,
  readOnly = false,
  isApplying = false,
  onApply,
}: PainelSugestaoControladoProps) {
  const [result, setResult] = useState<ControladoSuggestResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [applying, setApplying] = useState(false)

  const suggestMutation = useMutation({
    mutationFn: () =>
      produtoServico.suggestControlados(rows, {
        dcb: auxiliary.dcb,
      }),
    onSuccess: (data) => {
      setResult(data)
      if (!readOnly) {
        const defaults = new Set(
          data.suggestions.filter((s) => s.kind === 'empty').map((s) => s.rowIndex)
        )
        setSelected(defaults)
      } else {
        setSelected(new Set())
      }
      if (!data.available) {
        toast.warning(data.message ?? 'Sugestão indisponível')
      } else if (data.suggestions.length === 0) {
        toast.message('Nenhuma sugestão de controlado para estas linhas')
      } else {
        toast.success(`${formatNumber(data.suggestions.length)} sugestão(ões) de controlado`)
      }
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao sugerir controlados'),
  })

  const busy = suggestMutation.isPending || isApplying || applying

  useEffect(() => {
    setResult(null)
    setSelected(new Set())
  }, [rows])

  const byKind = useMemo(() => {
    const counts = { empty: 0, conflict: 0, confirm: 0 }
    for (const s of result?.suggestions ?? []) counts[s.kind]++
    return counts
  }, [result])

  const toggle = (rowIndex: number) => {
    if (readOnly || busy) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(rowIndex)) next.delete(rowIndex)
      else next.add(rowIndex)
      return next
    })
  }

  const selectAll = () => {
    setSelected(new Set((result?.suggestions ?? []).map((s) => s.rowIndex)))
  }

  const selectEmptyOnly = () => {
    setSelected(
      new Set((result?.suggestions ?? []).filter((s) => s.kind === 'empty').map((s) => s.rowIndex))
    )
  }

  const clearSelection = () => setSelected(new Set())

  const applySelected = async () => {
    if (readOnly || !onApply || busy) return
    if (!result || selected.size === 0) {
      toast.message('Selecione ao menos uma sugestão')
      return
    }

    const byRow = new Map(
      result.suggestions.filter((s) => selected.has(s.rowIndex)).map((s) => [s.rowIndex, s])
    )

    const next = rows.map((row, index) => {
      const suggestion = byRow.get(index)
      if (!suggestion) return row
      const updated: Record<string, string> = {
        ...row,
        listacontrole: suggestion.suggestedLista,
      }
      if (suggestion.suggestedDcb) {
        updated.dcb = suggestion.suggestedDcb
      }
      if (suggestion.registro) {
        updated.registroms = suggestion.registro
      }
      return updated
    })

    setApplying(true)
    try {
      await onApply(next)
      setResult(null)
      setSelected(new Set())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao aplicar sugestões')
    } finally {
      setApplying(false)
    }
  }

  return (
    <Card variant="panel" className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg-strong">
          <ShieldAlert className="h-5 w-5" />
          Sugestão de controlados (CMED + Portaria 344)
        </h2>
        <p className="text-sm text-fg-muted">
          {readOnly
            ? 'Somente consulta: compare o CSV com a CMED. Diferenças devem ser corrigidas na origem dos dados.'
            : 'Confira as sugestões e aplique. Após aplicar, a validação roda de novo e atualiza erros/alertas.'}
        </p>
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => suggestMutation.mutate()}
            disabled={busy || rows.length === 0}
          >
            {(suggestMutation.isPending || isApplying || applying) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {isApplying || applying ? 'Revalidando…' : 'Buscar sugestões'}
          </Button>
          {!readOnly && result?.available && result.suggestions.length > 0 && (
            <>
              <Button variant="secondary" size="sm" onClick={selectAll} disabled={busy}>
                Marcar todas
              </Button>
              <Button variant="secondary" size="sm" onClick={selectEmptyOnly} disabled={busy}>
                Só vazias
              </Button>
              <Button variant="secondary" size="sm" onClick={clearSelection} disabled={busy}>
                Limpar seleção
              </Button>
              <Button size="sm" onClick={() => void applySelected()} disabled={selected.size === 0 || busy}>
                {(isApplying || applying) && <Loader2 className="h-4 w-4 animate-spin" />}
                Aplicar selecionadas ({formatNumber(selected.size)})
              </Button>
            </>
          )}
        </div>

        {result?.available && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="neutral">
              CMED {formatNumber(result.foundInCmed)}/{formatNumber(result.withEan)} EAN
            </Badge>
            <Badge variant="neutral">{formatNumber(byKind.empty)} a preencher</Badge>
            <Badge variant="neutral">{formatNumber(byKind.conflict)} conflito(s)</Badge>
            {result.cmedSource && (
              <span className="text-fg-muted">{result.cmedSource}</span>
            )}
          </div>
        )}

        {result?.available && result.suggestions.length > 0 && (
          <div className="max-h-[320px] overflow-auto rounded-md border">
            <table className="w-full border-collapse font-data text-sm">
              <thead>
                <tr>
                  {!readOnly && <GridTh className="w-10" />}
                  <GridTh>Linha</GridTh>
                  <GridTh>Produto</GridTh>
                  <GridTh>Tipo</GridTh>
                  <GridTh>Atual</GridTh>
                  <GridTh>Sugerido</GridTh>
                  <GridTh>Motivo</GridTh>
                </tr>
              </thead>
              <tbody>
                {result.suggestions.map((s) => (
                  <tr key={s.rowIndex}>
                    {!readOnly && (
                      <GridCell>
                        <Checkbox
                          checked={selected.has(s.rowIndex)}
                          onCheckedChange={() => toggle(s.rowIndex)}
                          aria-label={`Selecionar linha ${s.row}`}
                        />
                      </GridCell>
                    )}
                    <GridCell className="font-mono text-xs">{s.row}</GridCell>
                    <GridCell className="max-w-[180px] truncate text-sm" title={s.nome}>
                      <span className="font-mono text-xs text-fg-muted">{s.codigo}</span>{' '}
                      {s.nome || s.produtoCmed}
                    </GridCell>
                    <GridCell>
                      <Badge variant={s.kind === 'conflict' ? 'negative' : 'neutral'}>
                        {KIND_LABEL[s.kind]}
                      </Badge>
                    </GridCell>
                    <GridCell className="font-mono text-xs">
                      {s.currentLista || '-'}
                      {s.currentDcb ? ` / DCB ${s.currentDcb}` : ''}
                      {s.currentRegistro ? ` / MS ${s.currentRegistro}` : ''}
                    </GridCell>
                    <GridCell className="font-mono text-xs">
                      {s.suggestedLista}
                      {s.suggestedDcb
                        ? ` / DCB ${s.suggestedDcb}`
                        : s.suggestedDcbNome
                          ? ` / ${s.suggestedDcbNome}`
                          : ' / DCB ?'}
                      {s.registro ? ` / MS ${s.registro}` : ''}
                    </GridCell>
                    <GridCell
                      className="max-w-[280px] truncate text-xs text-fg-muted"
                      title={s.reason}
                    >
                      {s.reason}
                    </GridCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  )
}
