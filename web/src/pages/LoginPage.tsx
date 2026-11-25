import { useSearchParams } from 'react-router'
import { ApiError } from '../api/client'
import { LoginForm } from '../components/auth/LoginForm'
import { Alert } from '../components/ui/states'
import { useSignIn } from '../hooks/useAuth'

function signInError(error: unknown): string | null {
  if (!error) return null
  if (error instanceof ApiError && error.status === 401) return 'Email or password is incorrect.'
  if (error instanceof ApiError && error.status === 429) return 'Too many sign-in attempts. Try again in a few minutes.'
  return 'Something went wrong. Try again.'
}

/** On success, RedirectIfSignedIn sends the user to ?next= or the dashboard. */
export function LoginPage() {
  const [searchParams] = useSearchParams()
  const signIn = useSignIn()

  return (
    <>
      {searchParams.get('reset') === '1' && (
        <Alert tone="success">Password updated. Sign in with your new password.</Alert>
      )}
      <LoginForm onSubmit={(values) => signIn.mutateAsync(values)} error={signInError(signIn.error)} />
    </>
  )
}
