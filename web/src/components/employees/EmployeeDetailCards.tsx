import { Link } from 'react-router'
import { formatDate, formatMoney, label } from '../../lib/format'
import type { EmployeeDetail } from '../../types/employee'
import { Card, DetailList } from '../ui/Card'

const since = (date: string | null) => (date ? ` (since ${formatDate(date)})` : '')

export function EmploymentCard({ employee }: { employee: EmployeeDetail }) {
  const { employment } = employee
  const leaving = employee.status !== 'active'
  return (
    <Card title="Employment">
      <DetailList items={[
        { label: 'Legal entity', value: employee.legalEntity.name },
        { label: 'Country', value: `${employee.country.isoCode} (${employee.country.currency})` },
        { label: 'Type', value: label('employmentType', employee.employmentType) },
        { label: 'Hire date', value: formatDate(employee.hireDate) },
        { label: 'Position', value: employee.position?.name },
        { label: 'Grade', value: employee.grade && `${employee.grade.code}${since(employment.assignmentEffectiveFrom)}` },
        {
          label: 'Manager',
          value: employee.manager && (
            <Link to={`/employees/${employee.manager.employmentId}`}>{employee.manager.displayName}</Link>
          ),
        },
        { label: 'Work email', value: employee.workEmail },
        { label: 'Notice period', value: employment.noticePeriodDays != null && `${employment.noticePeriodDays} days` },
        ...(leaving ? [
          { label: 'Resignation date', value: formatDate(employment.resignationDate) },
          { label: 'Last working day', value: formatDate(employee.lastWorkingDate) },
          { label: 'Separation', value: employment.separationType && label('separationType', employment.separationType) },
          { label: 'Reason', value: employment.separationReason },
          { label: 'Eligible for rehire', value: employment.eligibleForRehire == null ? null : employment.eligibleForRehire ? 'Yes' : 'No' },
        ] : []),
      ]} />
    </Card>
  )
}

export function PayCard({ employee }: { employee: EmployeeDetail }) {
  return (
    <Card title="Pay">
      <DetailList items={[
        { label: 'Annual salary', value: formatMoney(employee.annualSalary) },
        { label: 'Pay frequency', value: employee.payFrequency && label('payFrequency', employee.payFrequency) },
        { label: 'Since', value: employee.employment.compensationEffectiveFrom && formatDate(employee.employment.compensationEffectiveFrom) },
      ]} />
    </Card>
  )
}
