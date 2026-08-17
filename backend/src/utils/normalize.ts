export function normalizeColumnName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function extractTokens(name: string): string[] {
  const withoutAccents = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return withoutAccents
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

export function getMatchScore(csvName: string, mysqlName: string): number {
  const normalizedCsv = normalizeColumnName(csvName)
  const normalizedMysql = normalizeColumnName(mysqlName)

  if (!normalizedCsv || !normalizedMysql) return 0

  if (normalizedCsv === normalizedMysql) {
    return 100
  }

  if (normalizedMysql.includes(normalizedCsv) || normalizedCsv.includes(normalizedMysql)) {
    const shorter = Math.min(normalizedCsv.length, normalizedMysql.length)
    const longer = Math.max(normalizedCsv.length, normalizedMysql.length)
    const ratio = shorter / longer
    return 60 + ratio * 35
  }

  const csvTokens = extractTokens(csvName)
  if (csvTokens.length === 0) return 0

  const matchedTokens = csvTokens.filter((token) => {
    if (token.length < 3 && !normalizedMysql.startsWith(token)) {
      return normalizedMysql.includes(token) && token.length >= 3
    }
    return normalizedMysql.includes(token)
  })

  if (matchedTokens.length === 0) return 0

  const coverage = matchedTokens.length / csvTokens.length
  if (coverage >= 1) {
    return 75
  }

  if (coverage >= 0.5 && matchedTokens.some((token) => token.length >= 4)) {
    return 55 + coverage * 20
  }

  return 0
}
