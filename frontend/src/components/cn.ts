import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Junta classes condicionais e resolve conflitos de utilitários Tailwind. */
export function cn(...entradas: ClassValue[]) {
  return twMerge(clsx(entradas))
}
