import { LABELS } from '../../lib/format'
import type { Country } from '../../types/reference'

export interface EmployeeFilterValues {
  country: string
  status: string
  employmentType: string
}

interface Props {
  values: EmployeeFilterValues
  countries: Country[]
  onChange: (name: keyof EmployeeFilterValues, value: string) => void
}

// "" = the API default (active and on notice).
const STATUS_OPTIONS = [
  { value: '', label: 'Active & on notice' },
  { value: 'active', label: 'Active' },
  { value: 'on_notice', label: 'On notice' },
  { value: 'separated', label: 'Separated' },
  { value: 'all', label: 'All' },
]

export function EmployeeFilters({ values, countries, onChange }: Props) {
  return (
    <div className="filters">
      <label>
        Country
        <select value={values.country} onChange={(event) => onChange('country', event.target.value)}>
          <option value="">All countries</option>
          {countries.map((country) => <option key={country.id} value={country.isoCode}>{country.name}</option>)}
        </select>
      </label>
      <label>
        Status
        <select value={values.status} onChange={(event) => onChange('status', event.target.value)}>
          {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label>
        Type
        <select value={values.employmentType} onChange={(event) => onChange('employmentType', event.target.value)}>
          <option value="">All types</option>
          {Object.entries(LABELS.employmentType).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </label>
    </div>
  )
}
