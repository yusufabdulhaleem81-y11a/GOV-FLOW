/** Thin API client. Attaches the Supabase access token and the active
 * organization header; normalizes the API error envelope into ApiError. */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type TokenGetter = () => Promise<string | null>

let getToken: TokenGetter = async () => null
let organizationId: string | null = null
let baseUrl = '/api/v1'

export function configureApi(options: { getToken: TokenGetter; baseUrl: string }): void {
  getToken = options.getToken
  baseUrl = options.baseUrl.replace(/\/$/, '')
}

export function setActiveOrganization(id: string | null): void {
  organizationId = id
}

export function getActiveOrganization(): string | null {
  return organizationId
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  const body: unknown = text ? JSON.parse(text) : null
  if (!response.ok) {
    const err = (body as { error?: { code?: string; message?: string; details?: unknown } })?.error
    throw new ApiError(
      response.status,
      err?.code ?? 'REQUEST_FAILED',
      err?.message ?? `Request failed (${response.status})`,
      err?.details,
    )
  }
  return body as T
}

export async function api<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; query?: Record<string, string | number | boolean | undefined> } = {},
): Promise<T> {
  const token = await getToken()
  const url = new URL(`${baseUrl}${path}`, window.location.origin)
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (organizationId) headers['X-Organization-Id'] = organizationId

  const response = await fetch(url.pathname + url.search, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  return parseResponse<T>(response)
}

/** Downloads a CSV export via the browser (so auth headers apply). */
export async function downloadCsv(path: string, query: Record<string, string>): Promise<void> {
  const token = await getToken()
  const url = new URL(`${baseUrl}${path}`, window.location.origin)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)

  const response = await fetch(url.pathname + url.search, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(organizationId ? { 'X-Organization-Id': organizationId } : {}),
    },
  })
  if (!response.ok) {
    throw new ApiError(response.status, 'EXPORT_FAILED', 'Could not export the report')
  }
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filename = disposition.match(/filename="(.+)"/)?.[1] ?? 'govflow-export.csv'
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
