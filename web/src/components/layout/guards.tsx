import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import { useCurrentUser } from '../../hooks/useAuth'
import { safeNext } from '../../lib/navigation'
import type { Role } from '../../types/me'
import { PageSpinner } from '../ui/Spinner'
import { ErrorState } from '../ui/states'

/** Renders its routes only for a signed-in user; otherwise sends them to /login?next=… */
export function RequireAuth() {
  const location = useLocation()
  const { data: me, isPending, isError, refetch } = useCurrentUser()

  if (isPending) return <PageSpinner />
  if (isError) return <ErrorState message="We couldn't reach the server." onRetry={() => refetch()} />
  if (!me) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}

/** Hides HR-only pages from employees. The API enforces roles; this is for UX. */
export function RequireRole({ role, children }: { role: Role; children?: ReactNode }) {
  const { data: me } = useCurrentUser()
  if (me?.user.role !== role) {
    return (
      <div className="page">
        <h1>You don't have access to this page</h1>
        <p>This page is for {role === 'hr' ? 'HR' : 'employees'} only.</p>
      </div>
    )
  }
  return children ?? <Outlet />
}

/**
 * Signed-out pages send a signed-in user on: to ?next= (after signing in)
 * or the dashboard. Signing in only has to load /me; this does the redirect.
 */
export function RedirectIfSignedIn() {
  const [searchParams] = useSearchParams()
  const { data: me, isPending } = useCurrentUser()
  if (isPending) return <PageSpinner />
  if (me) return <Navigate to={safeNext(searchParams.get('next'))} replace />
  return <Outlet />
}
