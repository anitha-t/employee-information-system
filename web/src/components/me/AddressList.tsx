import { label } from '../../lib/format'
import type { Address } from '../../types/me'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/states'

export function AddressList({ addresses }: { addresses: Address[] }) {
  return (
    <Card title="Addresses">
      {addresses.length === 0 ? <EmptyState>No addresses yet.</EmptyState> : (
        <ul className="stack-list">
          {addresses.map((address) => (
            <li key={address.id}>
              <strong>{label('addressType', address.addressType)}</strong>
              <address>
                {[address.line1, address.line2].filter(Boolean).join(', ')}<br />
                {[address.city, address.state, address.postalCode].filter(Boolean).join(' ')}<br />
                {address.country.name}
              </address>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
