import type { ReactNode } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import type { Grade, Position } from '../../types/reference'
import { SelectField } from '../ui/fields'
import type { HireValues } from './hireSchema'

interface Props {
  register: UseFormRegister<HireValues>
  errors: FieldErrors<HireValues>['assignment']
  entityChosen: boolean
  positions: Position[]
  positionsLoading: boolean
  /** Grades allowed for the chosen position's job; empty until one is chosen. */
  grades: Grade[]
  gradeRange: string | null
  managerPicker: ReactNode
}

function positionLabel(position: Position) {
  const open = position.vacancies === 1 ? '1 open' : `${position.vacancies} open`
  return `${position.name} · ${position.isRemote ? 'Remote' : position.location?.city ?? ''} · ${open}`
}

export function RoleSection(props: Props) {
  const { register, errors, entityChosen, positions, positionsLoading, grades, gradeRange, managerPicker } = props
  const positionPlaceholder = !entityChosen ? 'Choose a legal entity first' : positionsLoading ? 'Loading…' : 'Select…'

  return (
    <fieldset className="form-section">
      <legend>Role</legend>
      <div className="form-grid">
        <SelectField label="Position" required placeholder={positionPlaceholder}
          disabled={!entityChosen || positionsLoading}
          options={positions.map((position) => ({ value: position.id, label: positionLabel(position) }))}
          hint={entityChosen && !positionsLoading && positions.length === 0 ? 'No open positions at this entity on the start date.' : undefined}
          error={errors?.positionId?.message}
          {...register('assignment.positionId')} />
        <SelectField label="Grade" required placeholder={grades.length ? 'Select…' : 'Choose a position first'}
          disabled={grades.length === 0}
          options={grades.map((grade) => ({ value: grade.id, label: `${grade.code} · ${grade.name}` }))}
          hint={gradeRange ? `Allowed for this job: ${gradeRange}` : undefined}
          error={errors?.gradeId?.message}
          {...register('assignment.gradeId')} />
      </div>
      {managerPicker}
    </fieldset>
  )
}
