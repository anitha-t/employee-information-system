import { QueryClient } from '@tanstack/react-query'
import type { createBrowserRouter } from 'react-router'
import { setUnauthorizedHandler } from './api/client'
import { forgetSession } from './hooks/useAuth'
import { PUBLIC_PATHS } from './routes'

export type Router = ReturnType<typeof createBrowserRouter>

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: (count, error) => count < 2 && !(error as { status?: number }).status, refetchOnWindowFocus: false },
    },
  })
}

/**
 * On any 401 (session expired or revoked): forget everything and send the user
 * to /login, coming back here after signing in (AGENTS.md §3).
 */
export function handleUnauthorized(queryClient: QueryClient, router: Router) {
  setUnauthorizedHandler(() => {
    const { pathname, search } = router.state.location
    forgetSession(queryClient)
    if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) return
    void router.navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true })
  })
}
