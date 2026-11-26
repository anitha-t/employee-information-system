// Increment / promotion / transfer form: values, per-type validation and payload (docs/web-design.md §7.2).
import { z } from 'zod'
import { formatDate } from '../../lib/format'
import type { EmployeeDetail } from '../../types/employee'
import type { ChangePayload, ChangeType } from '../../types/employmentAction'
import { AMOUNT_PATTERN, toDecimalString } from '../hire/hireSchema'

export const CHANGE_TYPES: { type: ChangeType; label: string; verb: string }[] = [
  { type: 'salary_change', label: 'Increment', verb: 'Increment' },
  { type: 'promotion', label: 'Promotion', verb: 'Promotion' },
  { type: 'transfer', label: 'Internal transfer', verb: 'Transfer' },
]

export const isChangeType = (value: string | null): value is ChangeType =>
  CHANGE_TYPES.some((entry) => entry.type === value)

export interface ChangeContext {
  type: ChangeType
  current: EmployeeDetail
  /** Changes must be dated after these (latest assignment / compensation start). */
  latestAssignment: string | null
  latestCompensation: string | null
}

const changeValues = z.object({
  effectiveDate: z.iso.date('Enter an effective date'),
  reason: z.string(),
  assignment: z.object({ positionId: z.string(), gradeId: z.string(), reportsToEmploymentId: z.string() }),
  compensation: z.object({ amount: z.string().trim() }),
})

export type ChangeValues = z.infer<typeof changeValues>

export const CHANGE_FIELDS = [
  'effectiveDate', 'reason', 'assignment.positionId', 'assignment.gradeId', 'assignment.reportsToEmploymentId', 'compensation.amount',
] as const

export const CHANGE_ERROR_ALIASES: Record<string, string> = {
  'compensation.annualSalary': 'compensation.amount',
  'compensation.annualSalaryCents': 'compensation.amount',
  'assignment.effectiveFrom': 'effectiveDate',
  'compensation.effectiveFrom': 'effectiveDate',
}

export function initialChangeValues(current: EmployeeDetail, date: string): ChangeValues {
  return {
    effectiveDate: date,
    reason: '',
    assignment: { positionId: current.position?.id ?? '', gradeId: current.grade?.id ?? '', reportsToEmploymentId: '' },
    compensation: { amount: '' },
  }
}

const later = (a: string | null, b: string | null) => (a && b ? (a > b ? a : b) : a ?? b)

/** The date a change must come after, and what it is. Null when there's nothing to compare with. */
export function minimumDate(context: ChangeContext, sendsPay: boolean): { date: string; what: string } | null {
  const role = context.type === 'salary_change' ? null : context.latestAssignment
  const pay = sendsPay || context.type === 'salary_change' ? context.latestCompensation : null // an increment always sends pay
  const date = later(role, pay)
  if (!date) return null
  return { date, what: date === pay && date !== role ? 'last pay change' : date === role && date !== pay ? 'last role change' : 'last change' }
}

/** The zod schema for one change type, with its rules (docs/web-design.md §7.2 table). */
export function changeSchema(context: ChangeContext) {
  const { type, current } = context
  return changeValues.superRefine((values, ctx) => {
    const amount = values.compensation.amount
    const sendsPay = amount !== ''
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })

    if (type === 'salary_change' && !sendsPay) issue(['compensation', 'amount'], 'Enter the new annual salary')
    if (sendsPay) {
      if (!AMOUNT_PATTERN.test(amount)) issue(['compensation', 'amount'], 'Enter an amount like 1850000 or 1850000.50')
      else if (Number(amount) <= 0) issue(['compensation', 'amount'], 'Enter an amount above zero')
      else if (type === 'salary_change' && current.annualSalary && Number(amount) === Number(current.annualSalary.amount)) {
        issue(['compensation', 'amount'], 'This is the current salary')
      }
    }

    const { positionId, gradeId } = values.assignment
    if (type !== 'salary_change') {
      if (!positionId) issue(['assignment', 'positionId'], 'Choose a position')
      if (!gradeId) issue(['assignment', 'gradeId'], 'Choose a grade')
    }
    if (type === 'promotion' && positionId === current.position?.id && gradeId === current.grade?.id) {
      issue(['assignment', 'gradeId'], 'Change the grade or the position')
    }
    if (type === 'transfer' && positionId && positionId === current.position?.id) {
      issue(['assignment', 'positionId'], 'Choose a different position')
    }

    const minimum = minimumDate(context, sendsPay)
    if (minimum && values.effectiveDate && values.effectiveDate <= minimum.date) {
      issue(['effectiveDate'], `Must be after ${formatDate(minimum.date)} (${minimum.what})`)
    }
  })
}

const blank = (value: string) => value.trim() === ''

/** The POST body: only what changed; the API copies the rest from the current row. */
export function toChangePayload(values: ChangeValues, context: ChangeContext): ChangePayload {
  const { type, current } = context
  const { positionId, gradeId, reportsToEmploymentId } = values.assignment
  const assignment: NonNullable<ChangePayload['assignment']> = {}
  if (type !== 'salary_change') {
    if (type === 'transfer' || positionId !== current.position?.id) assignment.positionId = positionId
    if (gradeId !== current.grade?.id) assignment.gradeId = gradeId
    if (type === 'transfer' && reportsToEmploymentId && reportsToEmploymentId !== current.manager?.employmentId) {
      assignment.reportsToEmploymentId = reportsToEmploymentId
    }
  }
  const amount = values.compensation.amount
  return {
    actionType: type,
    employmentId: current.employmentId,
    effectiveDate: values.effectiveDate,
    ...(blank(values.reason) ? {} : { reason: values.reason.trim() }),
    ...(Object.keys(assignment).length > 0 ? { assignment } : {}),
    ...(blank(amount) ? {} : { compensation: { annualSalary: { amount: toDecimalString(amount), currency: current.country.currency } } }),
  }
}

/** "+15.7%" between two decimal strings, or null. */
export function percentChange(from: string | undefined, to: string): string | null {
  const before = Number(from)
  const after = Number(to)
  if (!from || !to || !Number.isFinite(after) || !(before > 0) || !(after > 0)) return null
  const change = ((after - before) / before) * 100
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
}
