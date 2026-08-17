import { z } from 'zod'

export const suggestMappingSchema = z.object({
  csvColumns: z.array(z.string().min(1)).min(1),
  mysqlColumns: z.array(
    z.object({
      name: z.string().min(1),
    })
  ).min(1),
})

export type SuggestMappingInput = z.infer<typeof suggestMappingSchema>

export interface ColumnMappingItem {
  csvColumn: string
  mysqlColumn: string | null
  suggested: boolean
}
