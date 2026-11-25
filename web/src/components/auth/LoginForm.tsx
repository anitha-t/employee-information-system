import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '../ui/Button'
import { TextField } from '../ui/fields'
import { FormErrorSummary } from '../ui/states'

const schema = z.object({
  emailAddress: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

export type LoginValues = z.infer<typeof schema>

interface Props {
  onSubmit: (values: LoginValues) => Promise<unknown>
  /** Message for a failed attempt (wrong password, rate limited…). */
  error: string | null
}

export function LoginForm({ onSubmit, error }: Props) {
  const { register, handleSubmit, resetField, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { emailAddress: '', password: '' },
  })

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch {
      resetField('password')
    }
  })

  return (
    <form onSubmit={submit} noValidate>
      <h1>Sign in</h1>
      <FormErrorSummary messages={error ? [error] : []} />
      <TextField label="Work email" type="email" autoComplete="username" autoFocus
        error={errors.emailAddress?.message} {...register('emailAddress')} />
      <TextField label="Password" type="password" autoComplete="current-password"
        error={errors.password?.message} {...register('password')} />
      <Button type="submit" loading={isSubmitting} className="btn-block">Sign in</Button>
      <p className="form-footer"><Link to="/forgot-password">Forgot password?</Link></p>
    </form>
  )
}
