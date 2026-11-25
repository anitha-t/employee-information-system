// Shapes shared by every endpoint (docs/api-design.md §1). Keys are camelCase:
// api/client.ts converts them from the API's snake_case.

/** Money as the API sends it. `amount` is a decimal string, never a float. */
export interface Money {
  amount: string
  currency: string
}

export interface PageMeta {
  page: number
  perPage: number
  totalCount: number
}

export interface Paginated<T, M extends PageMeta = PageMeta> {
  data: T[]
  meta: M
}

export interface ListResponse<T> {
  data: T[]
}

/** `{"error": {"code", "message", "details"}}`; details keys are field paths. */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
}
