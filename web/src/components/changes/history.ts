// Turns GET /employment_actions items into "what changed" lines (docs/web-design.md §7.1).
import { formatDate, formatMoney, label } from '../../lib/format'
import type { EmploymentActionDetail } from '../../types/employmentAction'
import { percentChange } from './changeSchema'

export const ACTION_LABELS: Record<string, string> = {
  hire: 'Hire', promotion: 'Promotion', transfer: 'Internal transfer', manager_change: 'Manager change',
  regrade: 'Regrade', salary_change: 'Increment', separation: 'Separation',
}

/** Latest start dates of assignment and compensation rows (changes must come after them). */
export function latestRowDates(actions: EmploymentActionDetail[]) {
  const max = (dates: (string | undefined)[]) => dates.filter(Boolean).sort().at(-1) ?? null
  return {
    latestAssignment: max(actions.map((action) => action.assignment?.effectiveFrom)),
    latestCompensation: max(actions.map((action) => action.compensation?.effectiveFrom)),
  }
}

export interface HistoryEntry {
  action: EmploymentActionDetail
  title: string
  changes: string[]
}

/** Newest first, as the API sends them; each row is compared with the previous row of its kind. */
export function describeHistory(actions: EmploymentActionDetail[]): HistoryEntry[] {
  return actions.map((action, index) => {
    const older = actions.slice(index + 1)
    const previousAssignment = older.find((candidate) => candidate.assignment)?.assignment
    const previousPay = older.find((candidate) => candidate.compensation)?.compensation
    const changes: string[] = []
    const { assignment, compensation, separation } = action

    if (assignment && (!previousAssignment || action.actionType === 'hire')) {
      changes.push(`${assignment.position.name} · ${assignment.grade.code}`)
      if (assignment.reportsTo) changes.push(`Manager ${assignment.reportsTo.displayName}`)
    } else if (assignment && previousAssignment) {
      if (assignment.position.id !== previousAssignment.position.id) {
        changes.push(`Position ${previousAssignment.position.name} → ${assignment.position.name}`)
      }
      if (assignment.grade.id !== previousAssignment.grade.id) changes.push(`Grade ${previousAssignment.grade.code} → ${assignment.grade.code}`)
      if (assignment.reportsTo?.employmentId !== previousAssignment.reportsTo?.employmentId) {
        changes.push(`Manager ${previousAssignment.reportsTo?.displayName ?? 'none'} → ${assignment.reportsTo?.displayName ?? 'none'}`)
      }
    }
    if (compensation && previousPay && action.actionType !== 'hire') {
      const change = percentChange(previousPay.annualSalary.amount, compensation.annualSalary.amount)
      changes.push(`Salary ${formatMoney(previousPay.annualSalary)} → ${formatMoney(compensation.annualSalary)}${change ? ` (${change})` : ''}`)
    } else if (compensation) {
      changes.push(`Salary ${formatMoney(compensation.annualSalary)}, ${label('payFrequency', compensation.payFrequency).toLowerCase()}`)
    }
    if (separation) {
      changes.push(`Last working day ${formatDate(separation.lastWorkingDate)}`)
      if (separation.separationType) changes.push(label('separationType', separation.separationType))
    }
    return { action, title: ACTION_LABELS[action.actionType] ?? action.actionType, changes }
  })
}
