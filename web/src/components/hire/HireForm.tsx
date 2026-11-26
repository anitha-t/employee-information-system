import type { ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { Grade, LegalEntity, Position, SalaryBand } from '../../types/reference'
import { Button } from '../ui/Button'
import { TextAreaField } from '../ui/fields'
import { FormErrorSummary } from '../ui/states'
import { EmploymentSection } from './EmploymentSection'
import type { HireValues } from './hireSchema'
import { PaySection } from './PaySection'
import { PersonSection } from './PersonSection'
import { RoleSection } from './RoleSection'

export interface HireFormProps {
  form: UseFormReturn<HireValues>
  onSubmit: (values: HireValues) => Promise<void>
  onCancel: () => void
  /** Errors that don't belong to one field. */
  errorMessages: string[]
  legalEntities: LegalEntity[]
  onLegalEntityChange: () => void
  positions: Position[]
  positionsLoading: boolean
  grades: Grade[]
  gradeRange: string | null
  currency: string | null
  countryName: string | null
  band: SalaryBand | null | undefined
  managerPicker: ReactNode
}

/** The new-hire form. NewHirePage owns the form state and loads the options. */
export function HireForm(props: HireFormProps) {
  const { form, onSubmit, onCancel, errorMessages } = props
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form

  return (
    <form className="hire-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormErrorSummary messages={errorMessages} />
      <PersonSection register={register} errors={errors.person} />
      <EmploymentSection register={register} errors={errors} legalEntities={props.legalEntities}
        onLegalEntityChange={props.onLegalEntityChange} />
      <RoleSection positionField={register('assignment.positionId')} gradeField={register('assignment.gradeId')}
        errors={errors.assignment} entityChosen={Boolean(props.currency)}
        positions={props.positions} positionsLoading={props.positionsLoading}
        grades={props.grades} gradeRange={props.gradeRange} managerPicker={props.managerPicker} />
      <PaySection register={register} errors={errors.compensation} currency={props.currency} band={props.band}
        countryName={props.countryName} />
      <fieldset className="form-section">
        <legend>Notes</legend>
        <TextAreaField label="Reason" rows={2} placeholder="e.g. Backfill for…" error={errors.reason?.message} {...register('reason')} />
      </fieldset>
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>Create hire</Button>
      </div>
    </form>
  )
}
