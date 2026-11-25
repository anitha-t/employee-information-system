import type { EmergencyContact } from '../../types/me'
import { Card } from '../ui/Card'
import { Badge } from '../ui/StatusBadge'
import { EmptyState } from '../ui/states'

export function EmergencyContactList({ contacts }: { contacts: EmergencyContact[] }) {
  return (
    <Card title="Emergency contacts">
      {contacts.length === 0 ? <EmptyState>No emergency contacts yet.</EmptyState> : (
        <ul className="stack-list">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <strong>{contact.name}</strong>
              {contact.relationship && <span className="muted"> · {contact.relationship}</span>}
              {contact.isPrimary && <> <Badge>Primary</Badge></>}
              <div>{contact.phoneNumber ?? '—'}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
