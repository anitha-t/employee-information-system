import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { label, LABELS } from '../../lib/format'
import { SelectField, TextField } from '../ui/fields'
import type { ProfileValues } from './profileSchema'

interface Props {
  register: UseFormRegister<ProfileValues>
  errors: FieldErrors<ProfileValues>
  /** HR can change legal name, date of birth and gender; employees see them read-only. */
  canEditLegal: boolean
  gender: string
}

const GENDERS = Object.entries(LABELS.gender).map(([value, text]) => ({ value, label: text }))

export function PersonalDetailsFields({ register, errors, canEditLegal, gender }: Props) {
  const legalHint = canEditLegal ? undefined : 'Contact HR to change this.'
  return (
    <fieldset className="form-section">
      <legend>Personal details</legend>
      <div className="form-grid">
        <TextField label="First name" required={canEditLegal} readOnly={!canEditLegal} hint={legalHint}
          error={errors.firstName?.message} {...register('firstName')} />
        <TextField label="Last name" readOnly={!canEditLegal} hint={legalHint} error={errors.lastName?.message} {...register('lastName')} />
        <TextField label="Preferred name" hint="Shown instead of your first name across the app."
          error={errors.preferredName?.message} {...register('preferredName')} />
        <TextField label="Date of birth" type="date" readOnly={!canEditLegal} hint={legalHint}
          error={errors.dob?.message} {...register('dob')} />
        {canEditLegal ? (
          <SelectField label="Gender" placeholder="Not specified" options={GENDERS} error={errors.gender?.message} {...register('gender')} />
        ) : (
          <TextField label="Gender" readOnly value={label('gender', gender)} hint={legalHint} />
        )}
        <TextField label="Personal email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <TextField label="Phone" type="tel" autoComplete="tel" placeholder="+919800000000"
          error={errors.phoneNumber?.message} {...register('phoneNumber')} />
      </div>
    </fieldset>
  )
}
