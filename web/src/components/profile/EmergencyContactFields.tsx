import { useId } from 'react'
import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from 'react-hook-form'
import { Button } from '../ui/Button'
import { TextField } from '../ui/fields'
import { newContact, type ProfileValues } from './profileSchema'

interface Props {
  control: Control<ProfileValues>
  register: UseFormRegister<ProfileValues>
  setValue: UseFormSetValue<ProfileValues>
  errors: FieldErrors<ProfileValues>['emergencyContacts']
}

export function EmergencyContactFields({ control, register, setValue, errors }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: 'emergencyContacts' })
  const contacts = useWatch({ control, name: 'emergencyContacts' })
  const radioName = useId()
  // A list-level error ("Only one contact can be primary") arrives on the array itself.
  const listError = errors?.root?.message ?? (errors as { message?: string } | undefined)?.message

  // One primary at most: choosing a contact clears the others.
  const makePrimary = (chosen: number) => {
    contacts.forEach((_, index) => setValue(`emergencyContacts.${index}.isPrimary`, index === chosen, { shouldDirty: true }))
  }

  return (
    <fieldset className="form-section">
      <legend>Emergency contacts</legend>
      {listError && <div className="field-error" role="alert">{listError}</div>}
      {fields.length === 0 && <p className="muted">No emergency contacts yet.</p>}
      {fields.map((field, index) => {
        const rowErrors = errors?.[index]
        return (
          <div key={field.id} className="repeat-row" role="group" aria-label={`Contact ${index + 1}`}>
            <div className="form-grid">
              <TextField label="Name" required error={rowErrors?.name?.message} {...register(`emergencyContacts.${index}.name`)} />
              <TextField label="Relationship" placeholder="e.g. spouse" error={rowErrors?.relationship?.message}
                {...register(`emergencyContacts.${index}.relationship`)} />
              <TextField label="Phone" type="tel" required placeholder="+919800000000" error={rowErrors?.phoneNumber?.message}
                {...register(`emergencyContacts.${index}.phoneNumber`)} />
            </div>
            <div className="repeat-row-actions">
              <label className="inline-choice">
                <input type="radio" name={radioName} checked={contacts[index]?.isPrimary ?? false}
                  onChange={() => makePrimary(index)} />
                Primary contact
              </label>
              <Button variant="ghost" onClick={() => remove(index)}>Remove contact {index + 1}</Button>
            </div>
          </div>
        )
      })}
      <Button variant="secondary" onClick={() => append(newContact(contacts.length === 0))}>+ Add contact</Button>
    </fieldset>
  )
}
