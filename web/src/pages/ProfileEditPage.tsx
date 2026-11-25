import { Link, useNavigate } from 'react-router'
import { PageSpinner } from '../components/ui/Spinner'
import { ErrorState } from '../components/ui/states'
import { useCurrentUser } from '../hooks/useAuth'
import { useMyProfile } from '../hooks/useProfile'
import { ProfileEditor } from './ProfileEditor'

/** /profile/edit: edit my own profile. HR may also change their legal details. */
export function ProfileEditPage() {
  const navigate = useNavigate()
  const { data: me } = useCurrentUser()
  const profile = useMyProfile()
  if (!me) return null

  return (
    <div className="page">
      <p className="breadcrumb"><Link to="/profile">← My profile</Link></p>
      <h1>Edit profile</h1>
      {profile.isPending ? <PageSpinner /> : profile.isError ? (
        <ErrorState message="We couldn't load your profile." onRetry={() => profile.refetch()} />
      ) : (
        <ProfileEditor
          // A reload after a conflict brings a new lock_version: start a fresh form.
          key={profile.data.lockVersion}
          profile={profile.data}
          target={{ kind: 'me' }}
          canEditLegal={me.user.role === 'hr'}
          defaultCountryIso={me.employment?.country}
          savedMessage={() => 'Profile saved.'}
          onDone={() => navigate('/profile')}
          onReload={() => profile.refetch()}
        />
      )}
    </div>
  )
}
