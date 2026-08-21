/** Converte números no formato BR (`1.234,56`, `8,90`, `R$ 12,50`) para number. */
export function parseBrazilianNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, '').replace(/^R\$/i, '')
  if (!cleaned) return null

  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  const thousandsPattern = /^-?\d{1,3}(\.\d{3})+$/

  let normalized: string

  if (hasComma && hasDot) {
    normalized =
      cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '')
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.')
  } else if (hasDot && thousandsPattern.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '')
  } else {
    normalized = cleaned
  }

  if (!/^-?\d*\.?\d+$/.test(normalized)) return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function isBlank(value: string | undefined | null): boolean {
  return value === undefined || value === null || String(value).trim() === ''
}

export function isOnlyDigits(value: string): boolean {
  return /^\d+$/.test(value.trim())
}

export function isOnlyLettersAndSpaces(value: string): boolean {
  return /^[\p{L}\s]+$/u.test(value.trim())
}

/** Nome não pode ser vazio nem somente números. */
export function isValidProductName(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^\d+$/.test(trimmed)) return false
  return true
}

/** Código de migração: só dígitos, sem letras. */
export function isValidMigrationCode(value: string): boolean {
  return /^\d+$/.test(value.trim())
}

export function isValidNcm(value: string): boolean {
  return /^\d{8}$/.test(value.trim())
}

export function isValidCfop(value: string): boolean {
  return /^\d{4}$/.test(value.trim())
}

export function isValidIntegerId(value: string): boolean {
  return /^\d+$/.test(value.trim())
}

/**
 * Valida dígito verificador EAN-13.
 * Aceita também EAN-8 / UPC-A (12 dígitos) com o mesmo algoritmo de peso.
 */
export function isValidEanCheckDigit(raw: string): boolean {
  const digits = raw.trim()
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(digits)) return false

  const body = digits.slice(0, -1)
  const check = Number(digits.slice(-1))
  let sum = 0

  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i])
    sum += i % 2 === 0 ? digit * 3 : digit
  }

  const expected = (10 - (sum % 10)) % 10
  return expected === check
}

/**
 * Confere venda ≈ custo * (1 + markup/100).
 * Tolerância de 1 centavo para arredondamento.
 */
export function markupMatchesSale(custo: number, markup: number, venda: number): boolean {
  const expected = custo * (1 + markup / 100)
  return Math.abs(expected - venda) <= 0.01
}
