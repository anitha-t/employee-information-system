import { formatMoney } from '../../lib/format'
import type { Employee } from '../../types/employee'
import { StatusBadge } from '../ui/StatusBadge'

interface Props {
  employees: Employee[]
  /** True while a new page or search loads; the old rows stay, dimmed. */
  stale?: boolean
}

export function EmployeeTable({ employees, stale = false }: Props) {
  return (
    <div className={`table-wrap${stale ? ' is-stale' : ''}`} aria-busy={stale || undefined}>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Emp #</th>
            <th scope="col">Name</th>
            <th scope="col">Job · Team</th>
            <th scope="col">Country</th>
            <th scope="col">Manager</th>
            <th scope="col">Status</th>
            <th scope="col" className="numeric">Annual salary</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.employmentId}>
              <td className="mono">{employee.employeeNumber}</td>
              <td>
                <div>{employee.person.displayName}</div>
                {employee.person.displayName !== employee.person.fullName && (
                  <div className="muted small">{employee.person.fullName}</div>
                )}
              </td>
              <td>
                <div>{employee.job?.title ?? '—'}</div>
                <div className="muted small">{employee.team?.name}</div>
              </td>
              <td>{employee.country.isoCode}</td>
              <td>{employee.manager?.displayName ?? '—'}</td>
              <td><StatusBadge status={employee.status} /></td>
              <td className="numeric">{formatMoney(employee.annualSalary)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EmployeeTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="table-wrap" aria-busy="true" aria-label="Loading employees">
      <table className="table">
        <tbody>
          {Array.from({ length: rows }, (_, index) => (
            // Placeholder rows have no identity; the index is the only key.
            <tr key={`skeleton-${index}`}>
              {Array.from({ length: 7 }, (__, cell) => <td key={cell}><span className="skeleton" /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
