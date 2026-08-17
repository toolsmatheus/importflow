import { apiRequest } from '@/lib/api'
import type { ColumnMapping, TableColumn } from '@/types'

interface SuggestMappingResponse {
  mappings: ColumnMapping[]
}

export const mappingService = {
  async suggestMappings(csvColumns: string[], mysqlColumns: TableColumn[]): Promise<ColumnMapping[]> {
    const response = await apiRequest<SuggestMappingResponse>('/mapping/suggest', {
      method: 'POST',
      body: JSON.stringify({
        csvColumns,
        mysqlColumns: mysqlColumns.map((col) => ({ name: col.name })),
      }),
    })

    return response.mappings
  },
}
