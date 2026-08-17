import type { TableColumnRow } from '../repositories/mysqlRepository.js'

export type IssueSeverity = 'error' | 'warning'

export interface ValueIssue {
  severity: IssueSeverity
  message: string
}

export interface CoercionResult {
  value: string | number | null
  issues: ValueIssue[]
}

const INTEGER_TYPES = new Set(['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint'])
const DECIMAL_TYPES = new Set(['decimal', 'numeric', 'float', 'double'])
const STRING_TYPES = new Set([
  'char',
  'varchar',
  'tinytext',
  'text',
  'mediumtext',
  'longtext',
  'json',
])
const DATE_TYPES = new Set(['date', 'datetime', 'timestamp'])

const INTEGER_RANGES: Record<string, { min: number; max: number; unsignedMax: number }> = {
  tinyint: { min: -128, max: 127, unsignedMax: 255 },
  smallint: { min: -32768, max: 32767, unsignedMax: 65535 },
  mediumint: { min: -8388608, max: 8388607, unsignedMax: 16777215 },
  int: { min: -2147483648, max: 2147483647, unsignedMax: 4294967295 },
  integer: { min: -2147483648, max: 2147483647, unsignedMax: 4294967295 },
  bigint: {
    min: Number.MIN_SAFE_INTEGER,
    max: Number.MAX_SAFE_INTEGER,
    unsignedMax: Number.MAX_SAFE_INTEGER,
  },
}

const TRUE_VALUES = new Set(['1', 's', 'sim', 'true', 't', 'y', 'yes', 'verdadeiro', 'v'])
const FALSE_VALUES = new Set(['0', 'n', 'nao', 'não', 'false', 'f', 'no', 'falso'])

const THOUSANDS_PATTERN = /^-?\d{1,3}(\.\d{3})+$/

export function parseNumericValue(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, '').replace(/^R\$/i, '')
  if (!cleaned) return null

  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')

  let normalized: string

  if (hasComma && hasDot) {
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.')
  } else if (hasDot && THOUSANDS_PATTERN.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '')
  } else {
    normalized = cleaned
  }

  if (!/^-?\d*\.?\d+$/.test(normalized)) return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseBooleanValue(raw: string): 0 | 1 | null {
  const normalized = raw.trim().toLowerCase()
  if (TRUE_VALUES.has(normalized)) return 1
  if (FALSE_VALUES.has(normalized)) return 0
  return null
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0')
}

export function parseDateValue(raw: string, includeTime: boolean): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const match = trimmed.match(
    /^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  )

  if (!match) return null

  const [, first, second, third, hourRaw, minuteRaw, secondRaw] = match

  let year: number
  let month: number
  let day: number

  if (first.length === 4) {
    year = Number(first)
    month = Number(second)
    day = Number(third)
  } else if (third.length === 4) {
    day = Number(first)
    month = Number(second)
    year = Number(third)
  } else {
    day = Number(first)
    month = Number(second)
    year = 2000 + Number(third)
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const hour = hourRaw !== undefined ? Number(hourRaw) : 0
  const minute = minuteRaw !== undefined ? Number(minuteRaw) : 0
  const second2 = secondRaw !== undefined ? Number(secondRaw) : 0

  if (hour > 23 || minute > 59 || second2 > 59) return null

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second2))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  const datePart = `${year}-${pad(month)}-${pad(day)}`
  if (!includeTime) return datePart

  return `${datePart} ${pad(hour)}:${pad(minute)}:${pad(second2)}`
}

function getEnumValues(columnType: string): string[] {
  const match = columnType.match(/^(?:enum|set)\((.*)\)$/)
  if (!match) return []

  return match[1]
    .split(',')
    .map((part) => part.trim().replace(/^'(.*)'$/, '$1'))
}

function countDecimals(value: number): number {
  const text = String(value)
  const dotIndex = text.indexOf('.')
  return dotIndex === -1 ? 0 : text.length - dotIndex - 1
}

function isBooleanColumn(column: TableColumnRow): boolean {
  return column.type === 'tinyint' && column.columnType.startsWith('tinyint(1)')
}

function coerceEmpty(column: TableColumnRow): CoercionResult {
  if (column.nullable) {
    return { value: null, issues: [] }
  }

  if (column.autoIncrement) {
    return { value: null, issues: [] }
  }

  if (column.defaultValue !== null) {
    return {
      value: column.defaultValue,
      issues: [
        {
          severity: 'warning',
          message: `Valor vazio; será usado o padrão da coluna (${column.defaultValue}).`,
        },
      ],
    }
  }

  return {
    value: null,
    issues: [{ severity: 'error', message: 'Valor obrigatório não informado.' }],
  }
}

export function coerceValue(raw: string | null | undefined, column: TableColumnRow): CoercionResult {
  const text = raw === null || raw === undefined ? '' : String(raw).trim()

  if (text === '') {
    return coerceEmpty(column)
  }

  const issues: ValueIssue[] = []
  const unsigned = column.columnType.includes('unsigned')

  if (isBooleanColumn(column)) {
    const parsed = parseBooleanValue(text)
    if (parsed === null) {
      return {
        value: null,
        issues: [{ severity: 'error', message: 'Valor deve ser 0/1, Sim/Não ou equivalente.' }],
      }
    }
    if (!/^[01]$/.test(text)) {
      issues.push({ severity: 'warning', message: `Valor "${text}" convertido para ${parsed}.` })
    }
    return { value: parsed, issues }
  }

  if (INTEGER_TYPES.has(column.type)) {
    const parsed = parseNumericValue(text)
    if (parsed === null) {
      return {
        value: null,
        issues: [{ severity: 'error', message: 'Valor deve ser numérico.' }],
      }
    }

    let integer = parsed
    if (!Number.isInteger(parsed)) {
      integer = Math.round(parsed)
      issues.push({ severity: 'warning', message: `Valor decimal arredondado para ${integer}.` })
    }

    const range = INTEGER_RANGES[column.type]
    if (range) {
      const min = unsigned ? 0 : range.min
      const max = unsigned ? range.unsignedMax : range.max
      if (integer < min || integer > max) {
        return {
          value: null,
          issues: [
            {
              severity: 'error',
              message: `Valor fora do intervalo permitido (${min} a ${max}).`,
            },
          ],
        }
      }
    }

    return { value: integer, issues }
  }

  if (DECIMAL_TYPES.has(column.type)) {
    const parsed = parseNumericValue(text)
    if (parsed === null) {
      return {
        value: null,
        issues: [{ severity: 'error', message: 'Valor deve ser numérico.' }],
      }
    }

    if (unsigned && parsed < 0) {
      return {
        value: null,
        issues: [{ severity: 'error', message: 'Valor não pode ser negativo.' }],
      }
    }

    let result = parsed

    if (column.numericScale !== null && countDecimals(parsed) > column.numericScale) {
      const factor = 10 ** column.numericScale
      result = Math.round(parsed * factor) / factor
      issues.push({
        severity: 'warning',
        message: `Valor arredondado para ${column.numericScale} casas decimais (${result}).`,
      })
    }

    if (column.numericPrecision !== null && column.numericScale !== null) {
      const maxIntegerDigits = column.numericPrecision - column.numericScale
      const integerDigits = String(Math.trunc(Math.abs(result))).length
      if (integerDigits > maxIntegerDigits) {
        return {
          value: null,
          issues: [
            {
              severity: 'error',
              message: `Valor excede a precisão da coluna (máximo ${maxIntegerDigits} dígitos inteiros).`,
            },
          ],
        }
      }
    }

    return { value: result, issues }
  }

  if (DATE_TYPES.has(column.type)) {
    const includeTime = column.type !== 'date'
    const parsed = parseDateValue(text, includeTime)
    if (parsed === null) {
      return {
        value: null,
        issues: [{ severity: 'error', message: 'Data inválida. Use DD/MM/AAAA ou AAAA-MM-DD.' }],
      }
    }
    return { value: parsed, issues }
  }

  if (column.type === 'time') {
    if (!/^\d{1,3}:\d{2}(:\d{2})?$/.test(text)) {
      return {
        value: null,
        issues: [{ severity: 'error', message: 'Hora inválida. Use HH:MM ou HH:MM:SS.' }],
      }
    }
    return { value: text, issues }
  }

  if (column.type === 'year') {
    const parsed = parseNumericValue(text)
    if (parsed === null || !Number.isInteger(parsed) || parsed < 1901 || parsed > 2155) {
      return {
        value: null,
        issues: [{ severity: 'error', message: 'Ano inválido (1901 a 2155).' }],
      }
    }
    return { value: parsed, issues }
  }

  if (column.type === 'enum' || column.type === 'set') {
    const allowed = getEnumValues(column.columnType)
    const match = allowed.find((option) => option.toLowerCase() === text.toLowerCase())
    if (!match) {
      return {
        value: null,
        issues: [
          {
            severity: 'error',
            message: `Valor não permitido. Opções: ${allowed.join(', ')}.`,
          },
        ],
      }
    }
    if (match !== text) {
      issues.push({ severity: 'warning', message: `Valor ajustado para "${match}".` })
    }
    return { value: match, issues }
  }

  if (STRING_TYPES.has(column.type)) {
    if (column.maxLength !== null && text.length > column.maxLength) {
      return {
        value: null,
        issues: [
          {
            severity: 'error',
            message: `Texto excede o tamanho máximo de ${column.maxLength} caracteres (atual: ${text.length}).`,
          },
        ],
      }
    }
    return { value: text, issues }
  }

  return { value: text, issues }
}

export function isRequiredColumn(column: TableColumnRow): boolean {
  return !column.nullable && column.defaultValue === null && !column.autoIncrement
}
