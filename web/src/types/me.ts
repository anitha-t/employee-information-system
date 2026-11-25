export type Role = 'hr' | 'employee'
export type EmploymentStatus = 'active' | 'on_notice' | 'separated'
export type Gender = 'female' | 'male' | 'non_binary' | 'undisclosed'

export interface User {
  id: string
  emailAddress: string
  role: Role
}

/** GET /me */
export interface Me {
  user: User
  person: { id: string; fullName: string; preferredName: string | null; displayName: string }
  employment: {
    id: string
    employeeNumber: string
    status: EmploymentStatus
    legalEntity: string
    country: string
    jobTitle: string | null
    team: string | null
    manager: string | null
  } | null
}

export interface Address {
  id: string
  addressType: 'home' | 'mailing' | 'registered'
  line1: string
  line2: string | null
  city: string
  state: string | null
  postalCode: string | null
  country: { id: string; isoCode: string; name: string }
}

export interface EmergencyContact {
  id: string
  name: string
  relationship: string | null
  phoneNumber: string | null
  isPrimary: boolean
}

/** GET /me/profile */
export interface Profile {
  id: string
  lockVersion: number
  firstName: string
  lastName: string | null
  fullName: string
  preferredName: string | null
  email: string | null
  phoneNumber: string | null
  dob: string | null
  gender: Gender | null
  addresses: Address[]
  emergencyContacts: EmergencyContact[]
}

/** PATCH /me/profile and /people/:id/profile (docs/api-design.md §3.1). */
export interface ProfileUpdate {
  lockVersion: number
  preferredName?: string | null
  email?: string | null
  phoneNumber?: string | null
  // HR only:
  firstName?: string
  lastName?: string | null
  dob?: string | null
  gender?: Gender | null
  addresses?: AddressChange[]
  emergencyContacts?: EmergencyContactChange[]
}

/** No id: create. With id: update. With id and _destroy: remove. */
export type AddressChange =
  | { id: string; _destroy: true }
  | {
      id?: string
      addressType: 'home' | 'mailing'
      line1: string
      line2: string | null
      city: string
      state: string | null
      postalCode: string | null
      countryId: string
    }

export type EmergencyContactChange =
  | { id: string; _destroy: true }
  | { id?: string; name: string; relationship: string | null; phoneNumber: string; isPrimary: boolean }
