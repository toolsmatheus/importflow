export function lookupExistenceId(
  map: Map<string, number>,
  value: string
): number | undefined {
  const raw = value.trim()
  if (!raw) return undefined
  if (map.has(raw)) return map.get(raw)
  const n = Number(raw)
  if (Number.isInteger(n) && map.has(String(n))) return map.get(String(n))
  return undefined
}

export function claimExistenceKey(
  map: Map<string, number>,
  value: string,
  placeholderId = -1
): boolean {
  const raw = value.trim()
  if (!raw) return true
  if (lookupExistenceId(map, raw) !== undefined) return false
  map.set(raw, placeholderId)
  const n = Number(raw)
  if (Number.isInteger(n)) map.set(String(n), placeholderId)
  return true
}

export function releaseExistenceKey(map: Map<string, number>, value: string) {
  const raw = value.trim()
  if (!raw) return
  if (map.get(raw) === -1) map.delete(raw)
  const n = Number(raw)
  if (Number.isInteger(n) && map.get(String(n)) === -1) map.delete(String(n))
}

export function confirmExistenceKey(
  map: Map<string, number>,
  value: string,
  id: number
) {
  const raw = value.trim()
  if (!raw) return
  map.set(raw, id)
  const n = Number(raw)
  if (Number.isInteger(n)) map.set(String(n), id)
}
