import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '../ui/Button'
import { TextField } from '../ui/fields'

export const MIN_PASSWORD_LENGTH = 12

const schema = z.object({
  password: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: "Passwords don't match",
})

export type ResetPasswordValues = z.infer<typeof schema>

interface Props {
  onSubmit: (values: ResetPasswordValues) => Promise<unknown>
  /** The server's message for the password field, if it rejected it. */
  passwordError?: string
}

export function ResetPasswordForm({ onSubmit, passwordError }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  return (
    <form onSubmit={handleSubmit(async (values) => { await onSubmit(values).catch(() => {}) })} noValidate>
      <h1>Choose a new password</h1>
      <TextField label="New password" type="password" autoComplete="new-password" autoFocus
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={errors.password?.message ?? passwordError} {...register('password')} />
      <TextField label="Confirm new password" type="password" autoComplete="new-password"
        error={errors.confirmPassword?.message} {...register('confirmPassword')} />
      <Button type="submit" loading={isSubmitting} className="btn-block">Set password</Button>
    </form>
  )
}
