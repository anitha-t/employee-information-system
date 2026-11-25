import { type QueryClient, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCurrentUser, requestPasswordReset, resetPassword, signIn, signOut } from '../api/auth'
import { queryKeys } from './queryKeys'

export const currentUserQuery = queryOptions({
  queryKey: queryKeys.me,
  queryFn: getCurrentUser,
  staleTime: 5 * 60_000,
})

/** The signed-in user (GET /me), or null when signed out. */
export function useCurrentUser() {
  return useQuery(currentUserQuery)
}

/** Signs in, then loads /me so protected routes see the new session immediately. */
export function useSignIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: signIn,
    onSuccess: () => queryClient.fetchQuery({ ...currentUserQuery, staleTime: 0 }),
  })
}

/**
 * Forgets every cached query and records "signed out", so guards redirect
 * to /login without asking the server again. Used on sign-out and on a 401.
 */
export function forgetSession(queryClient: QueryClient) {
  queryClient.clear()
  queryClient.setQueryData(queryKeys.me, null)
}

/** Signs out on the server, then forgets the session locally, even if the call failed. */
export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: signOut,
    onSettled: () => forgetSession(queryClient),
  })
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: requestPasswordReset })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) => resetPassword(token, password),
  })
}
