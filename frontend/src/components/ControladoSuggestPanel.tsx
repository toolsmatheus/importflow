import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { productService } from '@/services/productService'
import { formatNumber } from '@/lib/utils'
import type { AuxiliaryEntity, ControladoSuggestion, ControladoSuggestResult } from '@/types'

interface ControladoSuggestPanelProps {
  rows: Record<string, string>[]
  auxiliary: Partial<Record<AuxiliaryEntity, string>>
  onApply: (nextRows: Record<string, string>[]) => void
}

const KIND_LABEL: Record<ControladoSuggestion['kind'], string> = {
  empty: 'Preencher',
  conflict: 'Conflito',
  confirm: 'Confirmar',
}

export function ControladoSuggestPanel({ rows, auxiliary, onApply }: ControladoSuggestPanelProps) {
  const [result, setResult] = useState<ControladoSuggestResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const suggestMutation = useMutation({
    mutationFn: () =>
      productService.suggestControlados(rows, {
        dcb: auxiliary.dcb,
      }),
    onSuccess: (data) => {
      setResult(data)
      const defaults = new Set(
        data.suggestions.filter((s) => s.kind === 'empty').map((s) => s.rowIndex)
      )
      setSelected(defaults)
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

  const applySelected = () => {
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
      return updated
    })

    onApply(next)
    toast.success(`Aplicado em ${formatNumber(selected.size)} linha(s). Revise na prévia.`)
    setResult(null)
    setSelected(new Set())
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Sugestão de controlados (CMED + Portaria 344)
        </CardTitle>
        <CardDescription>
          Apenas sugestão: confira e aplique em todas ou só nas marcadas. Nada é gravado até você
          aplicar. DCB usa o auxiliar dcb.csv quando disponível.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => suggestMutation.mutate()}
            disabled={suggestMutation.isPending || rows.length === 0}
          >
            {suggestMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Buscar sugestões
          </Button>
          {result?.available && result.suggestions.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={selectAll}>
                Marcar todas
              </Button>
              <Button variant="outline" size="sm" onClick={selectEmptyOnly}>
                Só vazias
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Limpar seleção
              </Button>
              <Button size="sm" onClick={applySelected} disabled={selected.size === 0}>
                Aplicar selecionadas ({formatNumber(selected.size)})
              </Button>
            </>
          )}
        </div>

        {result?.available && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">
              CMED {formatNumber(result.foundInCmed)}/{formatNumber(result.withEan)} EAN
            </Badge>
            <Badge variant="secondary">{formatNumber(byKind.empty)} a preencher</Badge>
            <Badge variant="warning">{formatNumber(byKind.conflict)} conflito(s)</Badge>
            {result.cmedSource && (
              <span className="text-muted-foreground">{result.cmedSource}</span>
            )}
          </div>
        )}

        {result?.available && result.suggestions.length > 0 && (
          <div className="max-h-[320px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Linha</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Atual</TableHead>
                  <TableHead>Sugerido</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.suggestions.map((s) => (
                  <TableRow key={s.rowIndex}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(s.rowIndex)}
                        onCheckedChange={() => toggle(s.rowIndex)}
                        aria-label={`Selecionar linha ${s.row}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.row}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm" title={s.nome}>
                      <span className="font-mono text-xs text-muted-foreground">{s.codigo}</span>{' '}
                      {s.nome || s.produtoCmed}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.kind === 'conflict' ? 'destructive' : 'secondary'}>
                        {KIND_LABEL[s.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.currentLista || '-'}
                      {s.currentDcb ? ` / DCB ${s.currentDcb}` : ''}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.suggestedLista}
                      {s.suggestedDcb
                        ? ` / DCB ${s.suggestedDcb}`
                        : s.suggestedDcbNome
                          ? ` / ${s.suggestedDcbNome}`
                          : ' / DCB ?'}
                    </TableCell>
                    <TableCell
                      className="max-w-[280px] truncate text-xs text-muted-foreground"
                      title={s.reason}
                    >
                      {s.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
