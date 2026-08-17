const SAMPLE_SIZE = 64 * 1024

export function detectEncoding(buffer: Buffer): string {
  if (buffer.length === 0) return 'UTF-8'

  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'UTF-8'
  }

  const utf8Text = buffer.toString('utf8')
  if (!utf8Text.includes('\uFFFD')) {
    const roundTrip = Buffer.from(utf8Text, 'utf8')
    if (roundTrip.length <= buffer.length) {
      return 'UTF-8'
    }
  }

  return 'ISO-8859-1'
}

export function decodeBuffer(buffer: Buffer, encoding: string): string {
  const normalized = encoding.toUpperCase().replace('LATIN1', 'ISO-8859-1')

  if (normalized === 'UTF-8') {
    return buffer.toString('utf8')
  }

  return buffer.toString('latin1')
}

function countDelimiterOutsideQuotes(line: string, delimiter: string): number {
  let count = 0
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && char === delimiter) {
      count++
    }
  }

  return count
}

export function detectDelimiter(sample: string): string {
  const lines = sample
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)

  if (lines.length === 0) return ';'

  const scoreDelimiter = (delimiter: string): number => {
    const counts = lines.map((line) => countDelimiterOutsideQuotes(line, delimiter))
    const max = Math.max(...counts)
    if (max === 0) return 0

    const consistent = counts.filter((c) => c === max).length
    return max * consistent
  }

  const semicolonScore = scoreDelimiter(';')
  const commaScore = scoreDelimiter(',')

  return semicolonScore >= commaScore ? ';' : ','
}

function isNumericValue(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return /^-?\d+([.,]\d+)?$/.test(trimmed)
}

export function detectHasHeader(firstRow: string[], secondRow: string[] | null): boolean {
  if (firstRow.length === 0) return true

  const firstRowNumeric = firstRow.filter((v) => isNumericValue(v)).length
  const firstRowRatio = firstRowNumeric / firstRow.length

  if (!secondRow || secondRow.length === 0) {
    return firstRowRatio < 0.5
  }

  const secondRowNumeric = secondRow.filter((v) => isNumericValue(v)).length
  const secondRowRatio = secondRowNumeric / secondRow.length

  const uniqueFirst = new Set(firstRow.map((v) => v.trim().toLowerCase())).size
  const mostlyUnique = uniqueFirst / firstRow.length >= 0.8

  return mostlyUnique && firstRowRatio <= secondRowRatio
}

export function parseSampleLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && char === delimiter) {
      result.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  result.push(current.trim())
  return result
}

export { SAMPLE_SIZE }
