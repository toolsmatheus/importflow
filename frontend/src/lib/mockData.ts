import type { ConnectionConfig } from '@/types'

/** Valores pré-preenchidos no formulário de conexão para facilitar os testes locais. */
export const mockConnection: ConnectionConfig = {
  name: 'Farmácia São João',
  host: '127.0.0.1',
  port: 3306,
  database: 'toolspharma',
  user: 'root',
  password: 'root',
}
