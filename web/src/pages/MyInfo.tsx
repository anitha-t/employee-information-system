import { AddressList } from '../components/me/AddressList'
import { ContactCard } from '../components/me/ContactCard'
import { EmergencyContactList } from '../components/me/EmergencyContactList'
import { EmploymentSummaryCard } from '../components/me/EmploymentSummaryCard'
import { Card } from '../components/ui/Card'
import { PageSpinner } from '../components/ui/Spinner'
import { ErrorState } from '../components/ui/states'
import { useMyProfile } from '../hooks/useProfile'
import type { Me } from '../types/me'

/** The signed-in person's employment and profile cards (read-only for now). */
export function MyInfo({ me }: { me: Me }) {
  const profile = useMyProfile()

  return (
    <div className="card-grid">
      <EmploymentSummaryCard employment={me.employment} />
      {profile.isPending ? (
        <Card title="Personal details"><PageSpinner /></Card>
      ) : profile.isError ? (
        <Card title="Personal details">
          <ErrorState message="We couldn't load your details." onRetry={() => profile.refetch()} />
        </Card>
      ) : (
        <>
          <ContactCard profile={profile.data} />
          <AddressList addresses={profile.data.addresses} />
          <EmergencyContactList contacts={profile.data.emergencyContacts} />
        </>
      )}
    </div>
  )
}
