import { z } from 'zod'
import { AUXILIARY_ENTITIES } from '../../models/produto.model.js'
import { UF_ICMS_TABLE } from '../../utils/icmsByUf.js'

export type {
  IssueSeverity,
  IssueValidacao,
  ValidationCheckSummaryItem,
  IssueCounters,
} from '../../models/validacao.model.js'

export {
  MAX_ISSUES_PER_CHECK,
  MAX_PREVIEW_ROWS,
  SN_FIELDS,
  INTEGER_OPTIONAL_FIELDS,
  DECIMAL_OPTIONAL_FIELDS,
  KNOWN_HEADERS,
  LEGACY_IGNORED_HEADERS,
  cell,
  hasColumn,
} from '../../models/validacao.model.js'

export type { ResultadoValidacaoProdutoDto as ResultadoValidacaoProduto } from '../../dto/produto.dto.js'

const brazilianUfSchema = z.enum(
  UF_ICMS_TABLE.map((e) => e.uf) as [string, ...string[]]
)

export const validateBodySchema = z.object({
  fileId: z.string().uuid(),
  delimiter: z.string().min(1).max(1).optional(),
  encoding: z.string().min(1).optional(),
  clientUf: brazilianUfSchema.optional(),
  auxiliary: z
    .record(z.enum(AUXILIARY_ENTITIES), z.string().uuid())
    .optional(),
})

export const validarLinhasBodySchema = z.object({
  rows: z.array(z.record(z.string())).min(1),
  clientUf: brazilianUfSchema.optional(),
  auxiliary: z.record(z.enum(AUXILIARY_ENTITIES), z.string().uuid()).optional(),
})

export type ValidateProductInput = z.infer<typeof validateBodySchema>
export type ValidateRowsInput = z.infer<typeof validarLinhasBodySchema>
