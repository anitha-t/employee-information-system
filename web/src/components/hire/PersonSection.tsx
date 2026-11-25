import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { LABELS } from '../../lib/format'
import { SelectField, TextField } from '../ui/fields'
import type { HireValues } from './hireSchema'

interface Props {
  register: UseFormRegister<HireValues>
  errors: FieldErrors<HireValues>['person']
}

const GENDERS = Object.entries(LABELS.gender).map(([value, label]) => ({ value, label }))

export function PersonSection({ register, errors }: Props) {
  return (
    <fieldset className="form-section">
      <legend>Person</legend>
      <div className="form-grid">
        <TextField label="First name" required autoComplete="off" error={errors?.firstName?.message} {...register('person.firstName')} />
        <TextField label="Last name" autoComplete="off" error={errors?.lastName?.message} {...register('person.lastName')} />
        <TextField label="Preferred name" autoComplete="off" error={errors?.preferredName?.message} {...register('person.preferredName')} />
        <TextField label="Personal email" type="email" autoComplete="off" error={errors?.email?.message} {...register('person.email')} />
        <TextField label="Phone" type="tel" placeholder="+919800000000" error={errors?.phoneNumber?.message} {...register('person.phoneNumber')} />
        <TextField label="Date of birth" type="date" error={errors?.dob?.message} {...register('person.dob')} />
        <SelectField label="Gender" placeholder="Select…" options={GENDERS} error={errors?.gender?.message} {...register('person.gender')} />
      </div>
    </fieldset>
  )
}
