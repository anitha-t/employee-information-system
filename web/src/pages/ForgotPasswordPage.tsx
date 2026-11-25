import { ApiError } from '../api/client'
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm'
import { useRequestPasswordReset } from '../hooks/useAuth'

export function ForgotPasswordPage() {
  const request = useRequestPasswordReset()
  const error = request.error instanceof ApiError && request.error.status === 429
    ? 'Too many requests. Try again later.'
    : request.error ? 'Something went wrong. Try again.' : null

  return (
    <ForgotPasswordForm
      onSubmit={({ emailAddress }) => request.mutateAsync(emailAddress)}
      sent={request.isSuccess}
      error={error}
    />
  )
}
