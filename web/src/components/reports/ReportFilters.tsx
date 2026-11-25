import { LABELS } from '../../lib/format'
import type { Country } from '../../types/reference'

export interface ReportFilterValues {
  country: string
  asOf: string
  employmentType: string
  year: string
  job: string
}

interface Props {
  values: ReportFilterValues
  countries: Country[]
  years: number[]
  onChange: (name: keyof ReportFilterValues, value: string) => void
}

/** One row above all reports; every report re-renders against the same slice. */
export function ReportFilters({ values, countries, years, onChange }: Props) {
  return (
    <div className="filters report-filters">
      <label>
        Country
        <select value={values.country} onChange={(event) => onChange('country', event.target.value)}>
          <option value="">All countries</option>
          {countries.map((country) => <option key={country.id} value={country.isoCode}>{country.name}</option>)}
        </select>
      </label>
      <label>
        As of
        <input type="date" value={values.asOf} required onChange={(event) => onChange('asOf', event.target.value)} />
      </label>
      <label>
        Type
        <select value={values.employmentType} onChange={(event) => onChange('employmentType', event.target.value)}>
          <option value="">All types</option>
          {Object.entries(LABELS.employmentType).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </label>
      <label>
        Spend year
        <select value={values.year} onChange={(event) => onChange('year', event.target.value)}>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </label>
      <label>
        Job title
        <input type="search" value={values.job} placeholder="Filter job titles…" onChange={(event) => onChange('job', event.target.value)} />
      </label>
    </div>
  )
}
