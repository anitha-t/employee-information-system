import { label } from '../../lib/format'
import type { EmploymentStatus } from '../../types/me'

export function StatusBadge({ status }: { status: EmploymentStatus }) {
  return <span className={`badge badge-${status}`}>{label('status', status)}</span>
}

export function Badge({ children }: { children: string }) {
  return <span className="badge">{children}</span>
}
