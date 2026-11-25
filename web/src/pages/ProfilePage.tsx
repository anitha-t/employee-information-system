import { useCurrentUser } from '../hooks/useAuth'
import { MyInfo } from './MyInfo'

/** /profile: my details, for every role (HR reach it from the user menu). */
export function ProfilePage() {
  const { data: me } = useCurrentUser()
  if (!me) return null
  return (
    <div className="page">
      <h1>My profile</h1>
      <MyInfo me={me} />
    </div>
  )
}
