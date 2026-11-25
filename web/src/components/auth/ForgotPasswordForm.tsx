import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '../ui/Button'
import { TextField } from '../ui/fields'
import { Alert, FormErrorSummary } from '../ui/states'

const schema = z.object({ emailAddress: z.email('Enter a valid email address') })
export type ForgotPasswordValues = z.infer<typeof schema>

interface Props {
  onSubmit: (values: ForgotPasswordValues) => Promise<unknown>
  sent: boolean
  error: string | null
}

export function ForgotPasswordForm({ onSubmit, sent, error }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { emailAddress: '' },
  })

  if (sent) {
    return (
      <div>
        <h1>Check your email</h1>
        {/* Same message whether or not the account exists. */}
        <Alert tone="success">If an account exists for that email, we've sent a reset link. It expires in 1 hour.</Alert>
        <p className="form-footer"><Link to="/login">Back to sign in</Link></p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(async (values) => { await onSubmit(values).catch(() => {}) })} noValidate>
      <h1>Reset your password</h1>
      <p className="muted">Enter your work email and we'll send you a link to set a new password.</p>
      <FormErrorSummary messages={error ? [error] : []} />
      <TextField label="Work email" type="email" autoComplete="username" autoFocus
        error={errors.emailAddress?.message} {...register('emailAddress')} />
      <Button type="submit" loading={isSubmitting} className="btn-block">Send reset link</Button>
      <p className="form-footer"><Link to="/login">Back to sign in</Link></p>
    </form>
  )
}
