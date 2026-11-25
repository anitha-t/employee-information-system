import { useCurrentUser } from '../hooks/useAuth'
import { HrDashboard } from './HrDashboard'
import { MyInfo } from './MyInfo'

function greeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** /dashboard: HR get employee search; employees get their own details. */
export function DashboardPage() {
  const { data: me } = useCurrentUser()
  if (!me) return null // RequireAuth renders this route only once /me has loaded.
  if (me.user.role === 'hr') return <HrDashboard me={me} />

  return (
    <div className="page">
      <h1>{greeting()}, {me.person.displayName}</h1>
      <MyInfo me={me} />
    </div>
  )
}
