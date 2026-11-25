import { Link, useNavigate, useParams } from 'react-router'
import { PageSpinner } from '../components/ui/Spinner'
import { ErrorState } from '../components/ui/states'
import { useEmployee } from '../hooks/useEmployees'
import { usePersonProfile } from '../hooks/useProfile'
import { isNotFound } from '../lib/errors'
import { EmployeeNotFound } from './EmployeeNotFound'
import { ProfileEditor } from './ProfileEditor'

/** /employees/:employmentId/edit (HR): edit an employee's profile, legal details included. */
export function EmployeeEditPage() {
  const { employmentId = '' } = useParams()
  const navigate = useNavigate()
  const employee = useEmployee(employmentId)
  const profile = usePersonProfile(employee.data?.person.id)
  const back = `/employees/${employmentId}`

  if (employee.isError) {
    return isNotFound(employee.error) ? <EmployeeNotFound /> : (
      <ErrorState message="We couldn't load this employee." onRetry={() => employee.refetch()} />
    )
  }

  return (
    <div className="page">
      <p className="breadcrumb"><Link to={back}>← {employee.data?.person.displayName ?? 'Employee'}</Link></p>
      <h1>Edit profile{employee.data && `: ${employee.data.person.fullName}`}</h1>
      {employee.isPending || profile.isPending ? <PageSpinner /> : profile.isError ? (
        <ErrorState message="We couldn't load this profile." onRetry={() => profile.refetch()} />
      ) : (
        <ProfileEditor
          key={profile.data.lockVersion}
          profile={profile.data}
          target={{ kind: 'person', personId: profile.data.id }}
          canEditLegal
          defaultCountryIso={employee.data.country.isoCode}
          savedMessage={(saved) => `Saved ${saved.fullName}'s profile.`}
          onDone={() => navigate(back)}
          onReload={() => profile.refetch()}
        />
      )}
    </div>
  )
}
