import type { Me, User } from '../types/me'
import { ApiError, api } from './client'

/** POST /session. The API sets the httpOnly session cookie; the token in the body is ignored. */
export async function signIn(credentials: { emailAddress: string; password: string }): Promise<User> {
  const response = await api.post<{ user: User }>('/session', credentials, { redirectOn401: false })
  return response.user
}

export function signOut(): Promise<null> {
  return api.delete<null>('/session', { redirectOn401: false })
}

/** GET /me, or null when signed out. */
export async function getCurrentUser(): Promise<Me | null> {
  try {
    return await api.get<Me>('/me', { redirectOn401: false })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

/** POST /passwords: always 202, whether or not the account exists. */
export function requestPasswordReset(emailAddress: string): Promise<null> {
  return api.post<null>('/passwords', { emailAddress })
}

/** PUT /passwords/:token: 204, or 422 invalid_token. */
export function resetPassword(token: string, password: string): Promise<null> {
  return api.put<null>(`/passwords/${encodeURIComponent(token)}`, { password })
}
