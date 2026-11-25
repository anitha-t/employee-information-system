import { describe, expect, it } from 'vitest'
import { toCamel } from '../../api/client'
import { profile as apiProfile } from '../../test/fixtures'
import type { Profile } from '../../types/me'
import { newAddress, newContact, profileFields, profileSchema, toProfileUpdate, toProfileValues } from './profileSchema'

const profile = toCamel({
  ...apiProfile,
  addresses: [...apiProfile.addresses, { ...apiProfile.addresses[0], id: 'a2', address_type: 'mailing', line1: 'PO Box 1' }],
}) as Profile

describe('toProfileUpdate', () => {
  it('keeps screen order, appends removed rows as _destroy, and turns blanks into null', () => {
    const values = toProfileValues(profile)
    values.addresses = [values.addresses[1]!, { ...newAddress('c-in'), line1: ' 5 New St ', city: 'Pune' }] // a1 removed
    values.emergencyContacts = [{ ...newContact(true), name: 'Sam', phoneNumber: '+919800000001' }] // ec1 removed
    values.preferredName = '  '

    const update = toProfileUpdate(values, profile, { canEditLegal: false })

    expect(update).toEqual({
      lockVersion: 3, preferredName: null, email: 'anu@example.com', phoneNumber: '+919800000000',
      addresses: [
        { id: 'a2', addressType: 'mailing', line1: 'PO Box 1', line2: null, city: 'Bengaluru', state: 'KA', postalCode: '560001', countryId: 'c-in' },
        { addressType: 'home', line1: '5 New St', line2: null, city: 'Pune', state: null, postalCode: null, countryId: 'c-in' },
        { id: 'a1', _destroy: true },
      ],
      emergencyContacts: [
        { name: 'Sam', relationship: null, phoneNumber: '+919800000001', isPrimary: true },
        { id: 'ec1', _destroy: true },
      ],
    })
  })

  it('sends legal details only when allowed', () => {
    const values = { ...toProfileValues(profile), lastName: '', gender: '' as const }
    expect(toProfileUpdate(values, profile, { canEditLegal: true }))
      .toMatchObject({ firstName: 'Priya', lastName: null, dob: '1990-05-01', gender: null })
  })
})

describe('profileSchema', () => {
  it('accepts a loaded profile and rejects bad rows', () => {
    const values = toProfileValues(profile)
    expect(profileSchema.safeParse(values).success).toBe(true)

    const result = profileSchema.safeParse({
      ...values,
      phoneNumber: '98000',
      addresses: [{ ...newAddress(), line1: '' }],
      emergencyContacts: [{ ...newContact(true), name: 'A', phoneNumber: '+919800000001' }, { ...newContact(true), name: 'B', phoneNumber: '+919800000002' }],
    })
    const paths = result.error?.issues.map((issue) => issue.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['phoneNumber', 'addresses.0.line1', 'addresses.0.city', 'addresses.0.countryId', 'emergencyContacts']))
  })

  it('lists field paths for the rows on screen', () => {
    const fields = profileFields(toProfileValues(profile))
    expect(fields).toContain('addresses.1.countryId')
    expect(fields).toContain('emergencyContacts.0.phoneNumber')
    expect(fields).not.toContain('addresses.2.line1')
  })
})
