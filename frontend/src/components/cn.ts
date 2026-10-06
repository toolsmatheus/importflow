import { clsx, type ClassValue } from 'clsx'

/** Junta classes condicionais. As variantes não geram utilitários conflitantes, então não há merge de Tailwind. */
export function cn(...entradas: ClassValue[]) {
  return clsx(entradas)
}
