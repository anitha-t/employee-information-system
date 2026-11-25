import { Link, useParams } from 'react-router'
import { EmploymentCard, PayCard } from '../components/employees/EmployeeDetailCards'
import { AddressList } from '../components/me/AddressList'
import { ContactCard } from '../components/me/ContactCard'
import { EmergencyContactList } from '../components/me/EmergencyContactList'
import { Card } from '../components/ui/Card'
import { PageSpinner } from '../components/ui/Spinner'
import { StatusBadge } from '../components/ui/StatusBadge'
import { ErrorState } from '../components/ui/states'
import { useEmployee } from '../hooks/useEmployees'
import { usePersonProfile } from '../hooks/useProfile'
import { isNotFound } from '../lib/errors'
import { EmployeeNotFound } from './EmployeeNotFound'

/** /employees/:employmentId (HR): employment, pay and the person's profile (docs/web-design.md §5.2). */
export function EmployeeDetailPage() {
  const { employmentId = '' } = useParams()
  const employee = useEmployee(employmentId)
  const profile = usePersonProfile(employee.data?.person.id)

  if (employee.isPending) return <PageSpinner />
  if (employee.isError) {
    return isNotFound(employee.error) ? <EmployeeNotFound /> : (
      <ErrorState message="We couldn't load this employee." onRetry={() => employee.refetch()} />
    )
  }

  const data = employee.data
  const role = [data.job?.title, data.team?.name].filter(Boolean).join(', ')

  return (
    <div className="page">
      <p className="breadcrumb"><Link to="/dashboard">← Employees</Link></p>
      <div className="page-header">
        <div>
          <h1>{data.person.displayName}</h1>
          <p className="card-lead">
            <span className="mono">{data.employeeNumber}</span> <StatusBadge status={data.status} />
            {role && <span className="muted">{role}</span>}
          </p>
        </div>
        <Link to={`/employees/${employmentId}/edit`} className="btn btn-primary">Edit profile</Link>
      </div>
      <div className="card-grid">
        <EmploymentCard employee={data} />
        <PayCard employee={data} />
        {profile.isPending ? (
          <Card title="Personal details"><PageSpinner /></Card>
        ) : profile.isError ? (
          <Card title="Personal details">
            <ErrorState message="We couldn't load this profile." onRetry={() => profile.refetch()} />
          </Card>
        ) : (
          <>
            <ContactCard profile={profile.data} />
            <AddressList addresses={profile.data.addresses} />
            <EmergencyContactList contacts={profile.data.emergencyContacts} />
          </>
        )}
      </div>
    </div>
  )
}
