export function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(name) && name.length > 0 && name.length <= 64
}

export function getSessionIdFromRequest(headers: Record<string, unknown>): string | null {
  const sessionId = headers['x-session-id']
  if (typeof sessionId === 'string' && sessionId.trim()) {
    return sessionId.trim()
  }
  return null
}
