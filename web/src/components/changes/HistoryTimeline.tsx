import { formatDate } from '../../lib/format'
import type { EmploymentActionDetail } from '../../types/employmentAction'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/states'
import { describeHistory } from './history'

/** Every employment action, newest first, with what each one changed. */
export function HistoryTimeline({ actions }: { actions: EmploymentActionDetail[] }) {
  return (
    <Card title="History">
      {actions.length === 0 ? <EmptyState>No changes recorded.</EmptyState> : (
        <ol className="timeline">
          {describeHistory(actions).map(({ action, title, changes }) => (
            <li key={action.id}>
              <div className="timeline-head">
                <strong>{title}</strong>
                <time dateTime={action.effectiveDate}>{formatDate(action.effectiveDate)}</time>
              </div>
              {changes.length > 0 && <ul className="timeline-changes">{changes.map((change) => <li key={change}>{change}</li>)}</ul>}
              <div className="muted small">
                {[action.reason, action.createdBy && `by ${action.createdBy.displayName}`].filter(Boolean).join(' · ')}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
