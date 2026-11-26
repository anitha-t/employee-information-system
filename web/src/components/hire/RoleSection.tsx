import type { ReactNode } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import type { Grade, Position } from '../../types/reference'
import { SelectField } from '../ui/fields'

interface Props {
  /** register('assignment.positionId') and register('assignment.gradeId') from either form. */
  positionField: UseFormRegisterReturn
  gradeField: UseFormRegisterReturn
  errors?: { positionId?: { message?: string }; gradeId?: { message?: string } }
  entityChosen: boolean
  positions: Position[]
  positionsLoading: boolean
  /** Grades allowed for the chosen position's job; empty until one is chosen. */
  grades: Grade[]
  gradeRange: string | null
  /** Extra hint under the grade, e.g. "Usually a promotion moves to a higher grade". */
  gradeHint?: string
  managerPicker?: ReactNode
  legend?: string
}

function positionLabel(position: Position) {
  const open = position.vacancies === 1 ? '1 open' : `${position.vacancies} open`
  return `${position.name} · ${position.isRemote ? 'Remote' : position.location?.city ?? ''} · ${open}`
}

/** Position and grade, shared by the new-hire and employment-change forms. */
export function RoleSection(props: Props) {
  const { positionField, gradeField, errors, entityChosen, positions, positionsLoading, grades, gradeRange, gradeHint, managerPicker } = props
  const positionPlaceholder = !entityChosen ? 'Choose a legal entity first' : positionsLoading ? 'Loading…' : 'Select…'
  const rangeHint = gradeRange ? `Allowed for this job: ${gradeRange}` : undefined

  return (
    <fieldset className="form-section">
      <legend>{props.legend ?? 'Role'}</legend>
      <div className="form-grid">
        <SelectField label="Position" required placeholder={positionPlaceholder}
          disabled={!entityChosen || positionsLoading}
          options={positions.map((position) => ({ value: position.id, label: positionLabel(position) }))}
          hint={entityChosen && !positionsLoading && positions.length === 0 ? 'No open positions at this entity on the start date.' : undefined}
          error={errors?.positionId?.message}
          {...positionField} />
        <SelectField label="Grade" required placeholder={grades.length ? 'Select…' : 'Choose a position first'}
          disabled={grades.length === 0}
          options={grades.map((grade) => ({ value: grade.id, label: `${grade.code} · ${grade.name}` }))}
          hint={[rangeHint, gradeHint].filter(Boolean).join('. ') || undefined}
          error={errors?.gradeId?.message}
          {...gradeField} />
      </div>
      {managerPicker}
    </fieldset>
  )
}
