// The only place that calls fetch() (AGENTS.md §4).
//
// - Sends the httpOnly session cookie (credentials: "include") and the
//   X-Requested-With header the API requires for cookie-authenticated writes.
// - Converts snake_case JSON to camelCase on the way in and back on the way out.
// - Throws ApiError for non-2xx responses and returns null for 204.
// - Calls the registered unauthorized handler on 401 (clear cache, go to /login).
import type { ApiErrorBody } from '../types/api'

const BASE_URL = `${import.meta.env.VITE_API_URL ?? '/api'}/v1`

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Field path → messages, with camelCase paths (e.g. "person.firstName"). */
  readonly details: Record<string, string[]>

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error.message ?? `Request failed (${status})`)
    this.name = 'ApiError'
    this.status = status
    this.code = body?.error.code ?? 'http_error'
    this.details = body?.error.details ?? {}
  }
}

type Query = Record<string, string | number | boolean | undefined | null>

export interface RequestOptions {
  query?: Query
  body?: unknown
  /** Set false where a 401 is an expected answer (sign-in, "am I signed in?"). */
  redirectOn401?: boolean
  signal?: AbortSignal
}

let onUnauthorized: () => void = () => {}

/** Registered once at startup (main.tsx): what to do when the session is gone. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { query, body, redirectOn401 = true, signal } = options
  const response = await fetch(buildUrl(path, query), {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(toSnake(body)),
    signal,
  })

  if (response.status === 204) return null as T

  const json = await parseJson(response)
  if (!response.ok) {
    if (response.status === 401 && redirectOn401) onUnauthorized()
    throw new ApiError(response.status, isErrorBody(json) ? (toCamel(json) as ApiErrorBody) : null)
  }
  return toCamel(json) as T
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
}

function buildUrl(path: string, query?: Query) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(snakeKey(key), String(value))
  }
  const search = params.toString()
  return `${BASE_URL}${path}${search ? `?${search}` : ''}`
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'error' in value
}

// --- key conversion ---------------------------------------------------------

const camelKey = (key: string) => key.replace(/(?<=[a-z0-9])_([a-z0-9])/g, (_, char: string) => char.toUpperCase())
const snakeKey = (key: string) => key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)

function convertKeys(value: unknown, convert: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => convertKeys(item, convert))
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [convert(key), convertKeys(item, convert)]))
  }
  return value
}

/** snake_case → camelCase keys, deeply. Error detail paths become "person.firstName". */
export const toCamel = (value: unknown) => convertKeys(value, camelKey)
/** camelCase → snake_case keys, deeply. `_destroy` is left as is. */
export const toSnake = (value: unknown) => convertKeys(value, snakeKey)
