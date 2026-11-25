import { useState } from 'react'
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
  const [generation, setGeneration] = useState(0)
  if (!me) return null

  return (
    <div className="page">
      <p className="breadcrumb"><Link to="/profile">← My profile</Link></p>
      <h1>Edit profile</h1>
      {profile.isPending ? <PageSpinner /> : profile.isError ? (
        <ErrorState message="We couldn't load your profile." onRetry={() => profile.refetch()} />
      ) : (
        <ProfileEditor
          // Remount only on an explicit reload, never because the cache changed (e.g. after saving).
          key={generation}
          profile={profile.data}
          target={{ kind: 'me' }}
          canEditLegal={me.user.role === 'hr'}
          defaultCountryIso={me.employment?.country}
          savedMessage={() => 'Profile saved.'}
          onDone={() => navigate('/profile')}
          onReload={async () => { await profile.refetch(); setGeneration((n) => n + 1) }}
        />
      )}
    </div>
  )
}
