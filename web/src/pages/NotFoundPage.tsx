import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="page narrow">
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <p><Link to="/dashboard">Go to the dashboard</Link></p>
    </main>
  )
}
