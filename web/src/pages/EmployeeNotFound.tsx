import { Link } from 'react-router'

export function EmployeeNotFound() {
  return (
    <div className="page">
      <h1>Employee not found</h1>
      <p>This employee doesn't exist, or the link is wrong.</p>
      <p><Link to="/dashboard">Back to employees</Link></p>
    </div>
  )
}
