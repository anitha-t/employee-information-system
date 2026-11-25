// Profile form values, validation and the PATCH payload (docs/web-design.md §5.1).
import { z } from 'zod'
import type { AddressChange, EmergencyContactChange, Gender, Profile, ProfileUpdate } from '../../types/me'

const PHONE = /^\+[1-9]\d{6,14}$/
const PHONE_MESSAGE = 'Use international format, e.g. +919800000000'
const required = (message: string) => z.string({ error: message }).trim().min(1, message)

const addressSchema = z.object({
  // The saved record's id; '' for a new row. (Not "id": React Hook Form uses that for row keys.)
  recordId: z.string(),
  addressType: z.enum(['home', 'mailing'], { error: 'Choose a type' }),
  line1: required('Enter the first line'),
  line2: z.string(),
  city: required('Enter a city'),
  state: z.string(),
  postalCode: z.string(),
  countryId: required('Choose a country'),
})

const contactSchema = z.object({
  recordId: z.string(),
  name: required('Enter a name'),
  relationship: z.string(),
  phoneNumber: required('Enter a phone number').regex(PHONE, PHONE_MESSAGE),
  isPrimary: z.boolean(),
})

export const profileSchema = z.object({
  firstName: required('Enter a first name'),
  lastName: z.string(),
  preferredName: z.string(),
  dob: z.union([z.literal(''), z.iso.date('Enter a valid date')]),
  gender: z.enum(['', 'female', 'male', 'non_binary', 'undisclosed']),
  email: z.union([z.literal(''), z.email('Enter a valid email address')]),
  phoneNumber: z.union([z.literal(''), z.string().regex(PHONE, PHONE_MESSAGE)]),
  addresses: z.array(addressSchema),
  emergencyContacts: z.array(contactSchema).refine(
    (contacts) => contacts.filter((contact) => contact.isPrimary).length <= 1,
    'Only one contact can be primary',
  ),
})

export type ProfileValues = z.infer<typeof profileSchema>
export type AddressValues = ProfileValues['addresses'][number]
export type ContactValues = ProfileValues['emergencyContacts'][number]

export const newAddress = (countryId = ''): AddressValues => ({
  recordId: '', addressType: 'home', line1: '', line2: '', city: '', state: '', postalCode: '', countryId,
})

export const newContact = (isPrimary = false): ContactValues => ({
  recordId: '', name: '', relationship: '', phoneNumber: '', isPrimary,
})

export function toProfileValues(profile: Profile): ProfileValues {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName ?? '',
    preferredName: profile.preferredName ?? '',
    dob: profile.dob ?? '',
    gender: profile.gender ?? '',
    email: profile.email ?? '',
    phoneNumber: profile.phoneNumber ?? '',
    addresses: profile.addresses.map((address) => ({
      recordId: address.id,
      addressType: address.addressType === 'mailing' ? 'mailing' : 'home',
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      state: address.state ?? '',
      postalCode: address.postalCode ?? '',
      countryId: address.country.id,
    })),
    emergencyContacts: profile.emergencyContacts.map((contact) => ({
      recordId: contact.id,
      name: contact.name,
      relationship: contact.relationship ?? '',
      phoneNumber: contact.phoneNumber ?? '',
      isPrimary: contact.isPrimary,
    })),
  }
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim())

/**
 * The PATCH body. Rows on screen go first, in screen order, so the API's
 * error index ("addresses[1]") is also the row's index on screen; removed
 * rows follow as {id, _destroy}. Legal details are sent only when allowed,
 * because the API rejects fields the user may not change.
 */
export function toProfileUpdate(values: ProfileValues, original: Profile, { canEditLegal }: { canEditLegal: boolean }): ProfileUpdate {
  const keptAddresses = new Set(values.addresses.map((address) => address.recordId).filter(Boolean))
  const keptContacts = new Set(values.emergencyContacts.map((contact) => contact.recordId).filter(Boolean))

  const addresses: AddressChange[] = [
    ...values.addresses.map((address) => ({
      ...(address.recordId ? { id: address.recordId } : {}),
      addressType: address.addressType,
      line1: address.line1.trim(),
      line2: orNull(address.line2),
      city: address.city.trim(),
      state: orNull(address.state),
      postalCode: orNull(address.postalCode),
      countryId: address.countryId,
    })),
    ...original.addresses.filter((address) => !keptAddresses.has(address.id)).map((address) => ({ id: address.id, _destroy: true as const })),
  ]
  const emergencyContacts: EmergencyContactChange[] = [
    ...values.emergencyContacts.map((contact) => ({
      ...(contact.recordId ? { id: contact.recordId } : {}),
      name: contact.name.trim(),
      relationship: orNull(contact.relationship),
      phoneNumber: contact.phoneNumber.trim(),
      isPrimary: contact.isPrimary,
    })),
    ...original.emergencyContacts.filter((contact) => !keptContacts.has(contact.id)).map((contact) => ({ id: contact.id, _destroy: true as const })),
  ]

  return {
    lockVersion: original.lockVersion,
    preferredName: orNull(values.preferredName),
    email: orNull(values.email),
    phoneNumber: orNull(values.phoneNumber),
    ...(canEditLegal ? {
      firstName: values.firstName.trim(),
      lastName: orNull(values.lastName),
      dob: orNull(values.dob),
      gender: (values.gender || null) as Gender | null,
    } : {}),
    addresses,
    emergencyContacts,
  }
}

/**
 * Field paths for mapping server errors, for the rows currently on screen.
 * The API's "addresses[0].country" lands on "addresses.0.countryId" (applyServerErrors adds "Id").
 */
export function profileFields(values: ProfileValues): string[] {
  return [
    'firstName', 'lastName', 'preferredName', 'dob', 'gender', 'email', 'phoneNumber',
    ...values.addresses.flatMap((_, index) =>
      ['addressType', 'line1', 'line2', 'city', 'state', 'postalCode', 'countryId'].map((field) => `addresses.${index}.${field}`)),
    ...values.emergencyContacts.flatMap((_, index) =>
      ['name', 'relationship', 'phoneNumber', 'isPrimary'].map((field) => `emergencyContacts.${index}.${field}`)),
  ]
}
