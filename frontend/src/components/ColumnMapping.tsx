import { ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ColumnMapping, TableColumn } from '@/types'

interface ColumnMappingProps {
  mappings: ColumnMapping[]
  mysqlColumns: TableColumn[]
  onMappingChange: (csvColumn: string, mysqlColumn: string | null) => void
  onSuggestMappings?: () => void
  isSuggesting?: boolean
}

export function ColumnMappingComponent({
  mappings,
  mysqlColumns,
  onMappingChange,
  onSuggestMappings,
  isSuggesting = false,
}: ColumnMappingProps) {
  const suggestedCount = mappings.filter((m) => m.suggested && m.mysqlColumn).length

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Mapeamento de colunas</CardTitle>
            <CardDescription>
              Associe cada coluna do CSV à coluna correspondente no MySQL.
            </CardDescription>
          </div>
          {onSuggestMappings && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSuggestMappings}
              disabled={isSuggesting}
            >
              {isSuggesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Sugerir mapeamento
            </Button>
          )}
        </div>
        {suggestedCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {suggestedCount} correspondência{suggestedCount > 1 ? 's' : ''} sugerida{suggestedCount > 1 ? 's' : ''} automaticamente.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-[1fr,auto,1fr] gap-4 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Coluna do CSV</span>
          <span />
          <span>Coluna do MySQL</span>
        </div>

        <div className="space-y-3">
          {mappings.map((mapping) => (
            <div
              key={mapping.csvColumn}
              className="grid grid-cols-[1fr,auto,1fr] items-center gap-4 rounded-lg border border-border bg-muted/20 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{mapping.csvColumn}</span>
                {mapping.suggested && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Sparkles className="h-3 w-3" />
                    Correspondência sugerida
                  </Badge>
                )}
              </div>

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

              <Select
                value={mapping.mysqlColumn ?? '__skip__'}
                onValueChange={(value) =>
                  onMappingChange(mapping.csvColumn, value === '__skip__' ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__skip__">Não importar</SelectItem>
                  {mysqlColumns.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
