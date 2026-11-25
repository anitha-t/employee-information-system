import { Link } from 'react-router'
import { useCurrentUser } from '../hooks/useAuth'
import { MyInfo } from './MyInfo'

/** /profile: my details, for every role (HR reach it from the user menu). */
export function ProfilePage() {
  const { data: me } = useCurrentUser()
  if (!me) return null
  return (
    <div className="page">
      <div className="page-header">
        <h1>My profile</h1>
        <Link to="/profile/edit" className="btn btn-secondary">Edit profile</Link>
      </div>
      <MyInfo me={me} />
    </div>
  )
}
