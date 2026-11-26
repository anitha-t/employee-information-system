import { NavLink } from 'react-router'

/** Employees | Reports on the HR dashboard. Links, so each tab has a URL; Employees is the default. */
export function HrTabs() {
  return (
    <nav className="tabs" aria-label="Dashboard">
      <NavLink to="/dashboard" end className="tab">Employees</NavLink>
      <NavLink to="/dashboard/reports" className="tab">Reports</NavLink>
    </nav>
  )
}
