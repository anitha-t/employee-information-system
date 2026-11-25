import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import type { Country } from '../../types/reference'
import { Button } from '../ui/Button'
import { SelectField, TextField } from '../ui/fields'
import { newAddress, type ProfileValues } from './profileSchema'

interface Props {
  control: Control<ProfileValues>
  register: UseFormRegister<ProfileValues>
  errors: FieldErrors<ProfileValues>['addresses']
  countries: Country[]
  /** Preselected country for a new address. */
  defaultCountryId: string
}

const TYPES = [{ value: 'home', label: 'Home' }, { value: 'mailing', label: 'Mailing' }]

export function AddressFields({ control, register, errors, countries, defaultCountryId }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: 'addresses' })
  const countryOptions = countries.map((country) => ({ value: country.id, label: country.name }))

  return (
    <fieldset className="form-section">
      <legend>Addresses</legend>
      {fields.length === 0 && <p className="muted">No addresses yet.</p>}
      {fields.map((field, index) => {
        const rowErrors = errors?.[index]
        return (
          <div key={field.id} className="repeat-row" role="group" aria-label={`Address ${index + 1}`}>
            <div className="form-grid">
              <SelectField label="Type" required options={TYPES} error={rowErrors?.addressType?.message}
                {...register(`addresses.${index}.addressType`)} />
              <TextField label="Line 1" required error={rowErrors?.line1?.message} {...register(`addresses.${index}.line1`)} />
              <TextField label="Line 2" error={rowErrors?.line2?.message} {...register(`addresses.${index}.line2`)} />
              <TextField label="City" required error={rowErrors?.city?.message} {...register(`addresses.${index}.city`)} />
              <TextField label="State" error={rowErrors?.state?.message} {...register(`addresses.${index}.state`)} />
              <TextField label="Postal code" error={rowErrors?.postalCode?.message} {...register(`addresses.${index}.postalCode`)} />
              <SelectField label="Country" required placeholder="Select…" options={countryOptions}
                error={rowErrors?.countryId?.message} {...register(`addresses.${index}.countryId`)} />
            </div>
            <div className="repeat-row-actions">
              <Button variant="ghost" onClick={() => remove(index)}>Remove address {index + 1}</Button>
            </div>
          </div>
        )
      })}
      <Button variant="secondary" onClick={() => append(newAddress(defaultCountryId))}>+ Add address</Button>
    </fieldset>
  )
}
