import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { LABELS } from '../../lib/format'
import type { LegalEntity } from '../../types/reference'
import { SelectField, TextField } from '../ui/fields'
import type { HireValues } from './hireSchema'

interface Props {
  register: UseFormRegister<HireValues>
  errors: FieldErrors<HireValues>
  legalEntities: LegalEntity[]
  onLegalEntityChange: () => void
}

const TYPES = Object.entries(LABELS.employmentType).map(([value, label]) => ({ value, label }))

export function EmploymentSection({ register, errors, legalEntities, onLegalEntityChange }: Props) {
  const entityOptions = legalEntities.map((entity) => ({
    value: entity.id,
    label: `${entity.name} (${entity.country.isoCode} · ${entity.country.currency})`,
  }))

  return (
    <fieldset className="form-section">
      <legend>Employment</legend>
      <div className="form-grid">
        <SelectField label="Legal entity" required placeholder="Select…" options={entityOptions}
          hint="Sets the country and salary currency."
          error={errors.employment?.legalEntityId?.message}
          {...register('employment.legalEntityId', { onChange: onLegalEntityChange })} />
        <TextField label="Start date" type="date" required error={errors.effectiveDate?.message} {...register('effectiveDate')} />
        <SelectField label="Employment type" required options={TYPES} error={errors.employment?.employmentType?.message}
          {...register('employment.employmentType')} />
        <TextField label="Notice period (days)" inputMode="numeric" error={errors.employment?.noticePeriodDays?.message}
          {...register('employment.noticePeriodDays')} />
        <TextField label="Work email" type="email" autoComplete="off" error={errors.employment?.workEmail?.message}
          {...register('employment.workEmail')} />
      </div>
    </fieldset>
  )
}
