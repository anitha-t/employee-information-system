import { ApiError } from '../api/client'

export const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404
