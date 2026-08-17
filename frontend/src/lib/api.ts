const API_BASE = '/api'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface ApiRequestOptions extends RequestInit {
  sessionId?: string
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { sessionId, headers, ...fetchOptions } = options

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
      ...headers,
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(data?.message ?? 'Erro na requisição', response.status)
  }

  return data as T
}
