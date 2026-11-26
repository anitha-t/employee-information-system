import { LABELS } from '../../lib/format'

interface Control {
  value: string
  onChange: (value: string) => void
}

export function AsOfFilter({ value, onChange }: Control) {
  return (
    <label>
      As of
      <input type="date" value={value} required onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

export function TypeFilter({ value, onChange }: Control) {
  return (
    <label>
      Type
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All types</option>
        {Object.entries(LABELS.employmentType).map(([type, text]) => <option key={type} value={type}>{text}</option>)}
      </select>
    </label>
  )
}

export function SelectFilter({ label, value, onChange, options, allLabel }: Control & {
  label: string
  options: { value: string; label: string }[]
  /** The "no filter" option; omit to require a choice. */
  allLabel?: string
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}
