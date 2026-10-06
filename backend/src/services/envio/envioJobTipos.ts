/**
 * Tipos de envio — reexporta models/dto (compat com imports internos da pasta envio/).
 */
export type {
  StatusEnvioJob,
  ModoEnvio,
  FaseEnvioJob,
  ProductSkipReason,
  ErroEnvioJob,
  ProdutoIgnoradoEnvioJob,
  LinhaEnvioAuxiliar,
  EnvioJobInterno,
  ProdutoEnvioPreparado,
} from '../../models/envio.model.js'

export {
  AUX_LABEL,
  MAX_STORED_ERRORS,
  MAX_SNAPSHOT_SKIPPED,
  JOB_TTL_MS,
} from '../../models/envio.model.js'

export type { SnapshotEnvioJobDto as SnapshotEnvioJob } from '../../dto/envio.dto.js'
