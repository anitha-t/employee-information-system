import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Me } from '../../types/me'
import { Logo } from './Logo'
import { UserMenu } from './UserMenu'

interface Props {
  me: Me
  onSignOut: () => void
  signingOut: boolean
  children: ReactNode
}

export function AppShell({ me, onSignOut, signingOut, children }: Props) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/dashboard" className="brand" aria-label="Employee Information: dashboard"><Logo /></Link>
        <UserMenu me={me} onSignOut={onSignOut} signingOut={signingOut} />
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
