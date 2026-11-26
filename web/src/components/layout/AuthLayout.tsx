import { Outlet } from 'react-router'
import { Logo } from './Logo'

/** Centred card for the signed-out pages. */
export function AuthLayout() {
  return (
    <main className="auth-layout">
      <div className="auth-card">
        <p className="auth-logo"><Logo size="large" /></p>
        <Outlet />
      </div>
    </main>
  )
}
