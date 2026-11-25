import type { UseFormReturn } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import type { Country } from '../../types/reference'
import { Button } from '../ui/Button'
import { FormErrorSummary } from '../ui/states'
import { AddressFields } from './AddressFields'
import { EmergencyContactFields } from './EmergencyContactFields'
import { PersonalDetailsFields } from './PersonalDetailsFields'
import type { ProfileValues } from './profileSchema'

export interface ProfileFormProps {
  form: UseFormReturn<ProfileValues>
  onSubmit: (values: ProfileValues) => Promise<void>
  onCancel: () => void
  errorMessages: string[]
  countries: Country[]
  defaultCountryId: string
  canEditLegal: boolean
}

/** Personal details, addresses and emergency contacts (docs/web-design.md §5.1). */
export function ProfileForm({ form, onSubmit, onCancel, errorMessages, countries, defaultCountryId, canEditLegal }: ProfileFormProps) {
  const { control, register, setValue, handleSubmit, formState: { errors, isSubmitting } } = form
  const gender = useWatch({ control, name: 'gender' })

  return (
    <form className="profile-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormErrorSummary messages={errorMessages} />
      <PersonalDetailsFields register={register} errors={errors} canEditLegal={canEditLegal} gender={gender} />
      <AddressFields control={control} register={register} errors={errors.addresses} countries={countries}
        defaultCountryId={defaultCountryId} />
      <EmergencyContactFields control={control} register={register} setValue={setValue} errors={errors.emergencyContacts} />
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>Save</Button>
      </div>
    </form>
  )
}
