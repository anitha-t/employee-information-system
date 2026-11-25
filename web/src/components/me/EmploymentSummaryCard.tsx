import type { Me } from '../../types/me'
import { Card, DetailList } from '../ui/Card'
import { StatusBadge } from '../ui/StatusBadge'
import { EmptyState } from '../ui/states'

export function EmploymentSummaryCard({ employment }: { employment: Me['employment'] }) {
  return (
    <Card title="Employment">
      {employment ? (
        <>
          <p className="card-lead">
            <span className="mono">{employment.employeeNumber}</span> <StatusBadge status={employment.status} />
          </p>
          <DetailList items={[
            { label: 'Job', value: employment.jobTitle },
            { label: 'Team', value: employment.team },
            { label: 'Legal entity', value: employment.legalEntity },
            { label: 'Country', value: employment.country },
            { label: 'Manager', value: employment.manager },
          ]} />
        </>
      ) : (
        <EmptyState>No current employment on record.</EmptyState>
      )}
    </Card>
  )
}
