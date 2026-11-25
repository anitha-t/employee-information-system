import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { formatMoney, LABELS } from '../../lib/format'
import type { SalaryBand } from '../../types/reference'
import { SelectField, TextField } from '../ui/fields'
import type { HireValues } from './hireSchema'

interface Props {
  register: UseFormRegister<HireValues>
  errors: FieldErrors<HireValues>['compensation']
  /** The legal entity's currency; null until an entity is chosen. */
  currency: string | null
  band: SalaryBand | null | undefined
  countryName: string | null
}

const FREQUENCIES = Object.entries(LABELS.payFrequency).map(([value, label]) => ({ value, label }))

export function PaySection({ register, errors, currency, band, countryName }: Props) {
  const bandHint = band
    ? `Band for ${band.grade.code}${countryName ? ` in ${countryName}` : ''}: ${formatMoney(band.min)} – ${formatMoney(band.max)}. Outside the band is allowed, with a warning.`
    : undefined

  return (
    <fieldset className="form-section">
      <legend>Pay</legend>
      <div className="form-grid">
        <div className="money-field">
          <TextField label={`Annual salary${currency ? ` (${currency})` : ''}`} required inputMode="decimal"
            placeholder="1850000"
            hint={bandHint} error={errors?.amount?.message} {...register('compensation.amount')} />
        </div>
        <SelectField label="Pay frequency" required options={FREQUENCIES} error={errors?.payFrequency?.message}
          {...register('compensation.payFrequency')} />
      </div>
    </fieldset>
  )
}
