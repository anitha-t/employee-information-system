import { formatMoney } from '../../lib/format'
import type { EmployeeDetail } from '../../types/employee'

/** One line: what the employee has today, which the change starts from. */
export function CurrentSummary({ employee }: { employee: EmployeeDetail }) {
  const parts = [
    employee.position?.name,
    employee.grade?.code,
    formatMoney(employee.annualSalary),
    employee.manager ? `Manager ${employee.manager.displayName}` : 'No manager',
  ].filter(Boolean)
  return <p className="current-summary"><span className="muted">Current:</span> {parts.join(' · ')}</p>
}
