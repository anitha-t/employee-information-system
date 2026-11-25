import type { ReactNode } from 'react'

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      {(title || actions) && (
        <header className="card-header">
          {title && <h2>{title}</h2>}
          {actions}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  )
}

/** Label/value rows inside a card. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="detail-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
