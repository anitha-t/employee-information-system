import { useId, type FormEvent, type ReactNode } from 'react'
import { Button } from '../ui/Button'

interface Props {
  title: string
  /** e.g. "as of 25 Nov 2026", shown once the report has run. */
  subtitle?: ReactNode
  /** This report's own filter controls; Go runs the report with them. */
  filters: ReactNode
  onGo: () => void
  loading: boolean
  children: ReactNode
}

/** One report: a heading, its own filter row with Go, and its results. */
export function ReportSection({ title, subtitle, filters, onGo, loading, children }: Props) {
  const headingId = useId()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onGo()
  }
  return (
    <section className="report card" aria-labelledby={headingId}>
      <header className="card-header">
        <h2 id={headingId}>{title} {subtitle && <span className="muted">· {subtitle}</span>}</h2>
      </header>
      <div className="card-body">
        <form className="filters report-filters" onSubmit={submit} aria-label={`${title} filters`}>
          {filters}
          <Button type="submit" loading={loading} className="filters-go">Go</Button>
        </form>
        {children}
      </div>
    </section>
  )
}

/** Shown until a report has been run. */
export function NotRunYet() {
  return <p className="muted not-run">Choose the filters and press Go.</p>
}
