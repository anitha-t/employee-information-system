import type { FormEvent } from 'react'
import { LABELS } from '../../lib/format'
import type { Country } from '../../types/reference'
import { Button } from '../ui/Button'

/** The filters that go to the API; they apply only when the user presses Go. */
export interface ReportFilterValues {
  country: string
  asOf: string
  employmentType: string
}

interface Props {
  draft: ReportFilterValues
  countries: Country[]
  onDraftChange: (name: keyof ReportFilterValues, value: string) => void
  onGo: () => void
  loading: boolean
  /** Client-side job-title filter: instant, no request. */
  job: string
  onJobChange: (value: string) => void
}

/** One row above all reports. Edit the filters, then Go runs every report against the same slice. */
export function ReportFilters({ draft, countries, onDraftChange, onGo, loading, job, onJobChange }: Props) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onGo()
  }
  return (
    <form className="filters report-filters" onSubmit={submit} aria-label="Report filters">
      <label>
        Country
        <select value={draft.country} onChange={(event) => onDraftChange('country', event.target.value)}>
          <option value="">All countries</option>
          {countries.map((country) => <option key={country.id} value={country.isoCode}>{country.name}</option>)}
        </select>
      </label>
      <label>
        As of
        <input type="date" value={draft.asOf} required onChange={(event) => onDraftChange('asOf', event.target.value)} />
      </label>
      <label>
        Type
        <select value={draft.employmentType} onChange={(event) => onDraftChange('employmentType', event.target.value)}>
          <option value="">All types</option>
          {Object.entries(LABELS.employmentType).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </label>
      <Button type="submit" loading={loading} className="filters-go">Go</Button>
      <label className="filters-job">
        Job title
        <input type="search" value={job} placeholder="Filter job titles…" onChange={(event) => onJobChange(event.target.value)} />
      </label>
    </form>
  )
}
