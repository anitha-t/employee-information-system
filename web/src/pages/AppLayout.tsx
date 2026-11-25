import { Outlet, useNavigate } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { useCurrentUser, useSignOut } from '../hooks/useAuth'

/** The signed-in frame: header, user menu and sign-out. */
export function AppLayout() {
  const navigate = useNavigate()
  const { data: me } = useCurrentUser()
  const signOut = useSignOut()
  if (!me) return null

  return (
    <AppShell me={me} signingOut={signOut.isPending}
      onSignOut={() => signOut.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })}>
      <Outlet />
    </AppShell>
  )
}
