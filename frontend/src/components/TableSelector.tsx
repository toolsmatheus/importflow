import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { TableColumn } from '@/types'

interface TableSelectorProps {
  tables: string[]
  selectedTable: string | null
  onTableSelect: (table: string) => void
  columns: TableColumn[]
  isLoadingTables?: boolean
  isLoadingColumns?: boolean
}

export function TableSelector({
  tables,
  selectedTable,
  onTableSelect,
  columns,
  isLoadingTables,
  isLoadingColumns,
}: TableSelectorProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tabela de destino</CardTitle>
          <CardDescription>Selecione a tabela MySQL onde os dados serão importados.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTables ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="space-y-2">
              <Label>Tabela</Label>
              <Select value={selectedTable ?? undefined} onValueChange={onTableSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma tabela" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTable && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Colunas da tabela <span className="text-primary">{selectedTable}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingColumns ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {columns.map((col) => (
                  <Badge key={col.name} variant="outline" className="font-mono text-xs">
                    {col.name}
                    {col.key === 'PRI' && <span className="ml-1 text-primary">PK</span>}
                    {col.key === 'UNI' && <span className="ml-1 text-amber-600 dark:text-amber-400">UNI</span>}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
