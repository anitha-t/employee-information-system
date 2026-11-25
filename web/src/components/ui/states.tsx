import type { ReactNode } from 'react'
import { Button } from './Button'

export function ErrorState({ message = "We couldn't load this.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <p>{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  )
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="state state-empty">
      <p>{children}</p>
      {action}
    </div>
  )
}

/** A form-level error box: messages that don't belong to a single field. */
export function FormErrorSummary({ messages, title = 'Please fix the following' }: { messages: string[]; title?: string }) {
  if (messages.length === 0) return null
  return (
    <div className="alert alert-error" role="alert">
      {messages.length === 1 ? <p>{messages[0]}</p> : (
        <>
          <p><strong>{title}</strong></p>
          <ul>{messages.map((message) => <li key={message}>{message}</li>)}</ul>
        </>
      )}
    </div>
  )
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning' | 'error'; children: ReactNode }) {
  return <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}
