import { z } from 'zod'

export const connectionConfigSchema = z.object({
  name: z.string().min(1, 'Nome da conexão é obrigatório'),
  host: z.string().min(1, 'Host é obrigatório'),
  port: z.coerce.number().int().min(1).max(65535).default(3306),
  database: z.string().min(1, 'Banco de dados é obrigatório'),
  user: z.string().min(1, 'Usuário é obrigatório'),
  password: z.string(),
})

export type ConnectionConfig = z.infer<typeof connectionConfigSchema>
