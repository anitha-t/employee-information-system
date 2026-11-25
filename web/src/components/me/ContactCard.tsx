import { formatDate, label } from '../../lib/format'
import type { Profile } from '../../types/me'
import { Card, DetailList } from '../ui/Card'

export function ContactCard({ profile }: { profile: Profile }) {
  return (
    <Card title="Personal details">
      <DetailList items={[
        { label: 'Legal name', value: profile.fullName },
        { label: 'Preferred name', value: profile.preferredName },
        { label: 'Personal email', value: profile.email },
        { label: 'Phone', value: profile.phoneNumber },
        { label: 'Date of birth', value: profile.dob && formatDate(profile.dob) },
        { label: 'Gender', value: profile.gender && label('gender', profile.gender) },
      ]} />
    </Card>
  )
}
