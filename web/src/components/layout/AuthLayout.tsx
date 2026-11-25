import { Outlet } from 'react-router'

/** Centred card for the signed-out pages. */
export function AuthLayout() {
  return (
    <main className="auth-layout">
      <div className="auth-card">
        <p className="brand">Employee Information System</p>
        <Outlet />
      </div>
    </main>
  )
}
