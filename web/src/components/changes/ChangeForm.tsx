import type { ReactNode } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { formatMoney } from '../../lib/format'
import type { EmployeeDetail } from '../../types/employee'
import type { ChangeType } from '../../types/employmentAction'
import type { Grade, Position, SalaryBand } from '../../types/reference'
import { RoleSection } from '../hire/RoleSection'
import { Button } from '../ui/Button'
import { TextAreaField, TextField } from '../ui/fields'
import { FormErrorSummary } from '../ui/states'
import { CHANGE_TYPES, percentChange, type ChangeValues } from './changeSchema'

export interface ChangeFormProps {
  form: UseFormReturn<ChangeValues>
  type: ChangeType
  current: EmployeeDetail
  onSubmit: (values: ChangeValues) => Promise<void>
  onCancel: () => void
  errorMessages: string[]
  /** "Must be after 1 Apr 2025 (last pay change)". */
  dateHint: string | null
  positions: Position[]
  positionsLoading: boolean
  grades: Grade[]
  gradeRange: string | null
  gradeHint?: string
  band: SalaryBand | null | undefined
  managerPicker: ReactNode
}

/** Increment, promotion or transfer (docs/web-design.md §7.2). EmploymentChangePage loads the options. */
export function ChangeForm(props: ChangeFormProps) {
  const { form, type, current, onSubmit, onCancel, errorMessages } = props
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = form
  const amount = useWatch({ control, name: 'compensation.amount' })
  const change = percentChange(current.annualSalary?.amount, amount.trim())
  const verb = CHANGE_TYPES.find((entry) => entry.type === type)?.verb ?? 'change'
  const payHints = [
    change && `${change} from ${formatMoney(current.annualSalary)}`,
    props.band && `Band for ${props.band.grade.code}: ${formatMoney(props.band.min)} – ${formatMoney(props.band.max)}`,
    type !== 'salary_change' && !amount.trim() && 'Leave empty to keep the current salary',
  ].filter(Boolean).join('. ')

  return (
    <form className="change-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormErrorSummary messages={errorMessages} />
      <fieldset className="form-section">
        <legend>When</legend>
        <div className="form-grid">
          <TextField label="Effective date" type="date" required hint={props.dateHint ?? undefined}
            error={errors.effectiveDate?.message} {...register('effectiveDate')} />
        </div>
      </fieldset>
      {type !== 'salary_change' && (
        <RoleSection legend="Role" positionField={register('assignment.positionId')} gradeField={register('assignment.gradeId')}
          errors={errors.assignment} entityChosen positions={props.positions} positionsLoading={props.positionsLoading}
          grades={props.grades} gradeRange={props.gradeRange} gradeHint={props.gradeHint}
          managerPicker={type === 'transfer' ? props.managerPicker : undefined} />
      )}
      <fieldset className="form-section">
        <legend>Pay</legend>
        <div className="form-grid">
          <TextField label={`New annual salary (${current.country.currency})`} required={type === 'salary_change'}
            inputMode="decimal" placeholder={current.annualSalary?.amount.replace(/\.00$/, '')}
            hint={payHints || undefined} error={errors.compensation?.amount?.message} {...register('compensation.amount')} />
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend>Notes</legend>
        <TextAreaField label="Reason" rows={2} placeholder="e.g. FY26 review cycle" {...register('reason')} />
      </fieldset>
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>Save {verb.toLowerCase()}</Button>
      </div>
    </form>
  )
}
