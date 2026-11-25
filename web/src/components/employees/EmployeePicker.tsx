import { useId } from 'react'
import type { Employee } from '../../types/employee'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'

interface Props {
  label: string
  query: string
  onQueryChange: (query: string) => void
  results: Employee[]
  loading: boolean
  selected: { employmentId: string; label: string } | null
  onSelect: (employee: Employee | null) => void
  error?: string
}

/** Search-as-you-type employee picker. The parent runs the search. */
export function EmployeePicker({ label, query, onQueryChange, results, loading, selected, onSelect, error }: Props) {
  const id = useId()

  return (
    <div className={`field${error ? ' field-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {selected ? (
        <div className="picked">
          <span id={id}>{selected.label}</span>
          <Button variant="ghost" onClick={() => onSelect(null)}>Change</Button>
        </div>
      ) : (
        <div className="picker">
          <input id={id} type="search" value={query} placeholder="Search by name or employee number…" autoComplete="off"
            aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onQueryChange(event.target.value)} />
          {loading && <Spinner size="small" label="Searching" />}
          {query.trim().length >= 2 && !loading && (
            <ul className="picker-results" aria-label={`${label} results`}>
              {results.length === 0 && <li className="muted">No matches</li>}
              {results.map((employee) => (
                <li key={employee.employmentId}>
                  <button type="button" onClick={() => onSelect(employee)}>
                    <span>{employee.person.displayName}</span>
                    <span className="muted small"> {employee.employeeNumber} · {employee.job?.title ?? 'No job'} · {employee.country.isoCode}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <div className="field-error" id={`${id}-error`} role="alert">{error}</div>}
    </div>
  )
}
