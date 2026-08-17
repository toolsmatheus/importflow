/**
 * Mensagens para erros de execução de comando (não de conexão), usadas no
 * relatório de erros da importação.
 */
export function getFriendlyMysqlStatementError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Erro ao gravar o registro no banco.'
  }

  const err = error as { code?: string; message?: string }

  switch (err.code) {
    case 'ER_DUP_ENTRY': {
      const match = err.message?.match(/Duplicate entry '(.*)' for key '(.*)'/)
      return match
        ? `Registro duplicado: o valor "${match[1]}" já existe na chave "${match[2]}".`
        : 'Registro duplicado: o valor já existe em uma coluna única.'
    }
    case 'ER_DATA_TOO_LONG':
      return 'Valor maior que o tamanho permitido pela coluna.'
    case 'ER_BAD_NULL_ERROR':
      return 'A coluna não aceita valor vazio.'
    case 'ER_NO_DEFAULT_FOR_FIELD':
      return 'Coluna obrigatória sem valor informado e sem padrão definido no banco.'
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
      return 'Formato do valor incompatível com o tipo da coluna.'
    case 'ER_WARN_DATA_OUT_OF_RANGE':
      return 'Valor fora do intervalo aceito pela coluna.'
    case 'ER_NO_REFERENCED_ROW_2':
      return 'Valor não existe na tabela relacionada (chave estrangeira).'
    case 'ER_LOCK_WAIT_TIMEOUT':
      return 'Tempo de espera por bloqueio esgotado. A tabela está em uso por outra operação.'
    case 'ER_LOCK_DEADLOCK':
      return 'Conflito de bloqueio no banco (deadlock). Tente novamente.'
    case 'ER_NO_SUCH_TABLE':
      return 'Tabela não encontrada no banco.'
    case 'ER_TABLEACCESS_DENIED_ERROR':
    case 'ER_COLUMNACCESS_DENIED_ERROR':
      return 'O usuário informado não tem permissão para gravar nesta tabela.'
    default:
      return 'Erro ao gravar o registro no banco.'
  }
}

export function getFriendlyMysqlError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Não foi possível conectar ao banco. Verifique os dados informados.'
  }

  const err = error as { code?: string; errno?: number; message?: string }

  switch (err.code) {
    case 'ECONNREFUSED':
      return 'Não foi possível conectar ao servidor. Verifique o host e a porta.'
    case 'ETIMEDOUT':
    case 'ENOTFOUND':
      return 'Servidor não encontrado ou tempo de conexão esgotado. Verifique o host.'
    case 'ER_ACCESS_DENIED_ERROR':
      return 'Usuário ou senha incorretos.'
    case 'ER_BAD_DB_ERROR':
      return 'Banco de dados não encontrado.'
    case 'PROTOCOL_CONNECTION_LOST':
      return 'Conexão perdida com o servidor MySQL.'
    case 'ER_HOST_NOT_PRIVILEGED':
      return 'Este host não tem permissão para conectar ao MySQL.'
    default:
      return 'Não foi possível conectar ao banco. Verifique os dados informados.'
  }
}
