import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  loading?: boolean
}

export function Button({ variant = 'primary', loading = false, disabled, children, className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={['btn', `btn-${variant}`, className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner size="small" />}
      {children}
    </button>
  )
}
