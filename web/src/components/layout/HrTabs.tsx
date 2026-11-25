import { NavLink } from 'react-router'

/** Reports | Employees on the HR dashboard. Links, so each tab has a URL. */
export function HrTabs() {
  return (
    <nav className="tabs" aria-label="Dashboard">
      <NavLink to="/dashboard/reports" className="tab">Reports</NavLink>
      <NavLink to="/dashboard" end className="tab">Employees</NavLink>
    </nav>
  )
}
