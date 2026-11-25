import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { ResetPasswordForm } from '../components/auth/ResetPasswordForm'
import { Alert } from '../components/ui/states'
import { useResetPassword } from '../hooks/useAuth'

/** /reset-password/:token, the link in the reset email. */
export function ResetPasswordPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const reset = useResetPassword()
  const error = reset.error

  if (error instanceof ApiError && error.code === 'invalid_token') {
    return (
      <div>
        <h1>Link expired</h1>
        <Alert tone="error">This reset link is invalid or has expired.</Alert>
        <p className="form-footer"><Link to="/forgot-password">Send a new link</Link></p>
      </div>
    )
  }

  return (
    <>
      {error && !(error instanceof ApiError && error.details.password) && (
        <Alert tone="error">Something went wrong. Try again.</Alert>
      )}
      <ResetPasswordForm
        passwordError={error instanceof ApiError ? error.details.password?.join(', ') : undefined}
        onSubmit={async ({ password }) => {
          await reset.mutateAsync({ token, password })
          navigate('/login?reset=1', { replace: true })
        }}
      />
    </>
  )
}
