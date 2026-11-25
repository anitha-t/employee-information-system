import type { Money } from './api'
import type { EmploymentType, PayFrequency } from './employee'
import type { EmploymentStatus, Gender } from './me'

/** POST /employment_actions with action_type "hire" (docs/api-design.md §3.2). */
export interface HirePayload {
  actionType: 'hire'
  effectiveDate: string
  reason?: string
  person: {
    firstName: string
    lastName?: string
    preferredName?: string
    email?: string
    phoneNumber?: string
    dob?: string
    gender?: Gender
  }
  employment: {
    legalEntityId: string
    employmentType: EmploymentType
    noticePeriodDays?: number
    workEmail?: string
  }
  assignment: {
    positionId: string
    gradeId: string
    reportsToEmploymentId?: string
  }
  compensation: {
    annualSalary: Money
    payFrequency: PayFrequency
  }
}

/** The parts of an employment action response the web app uses. */
export interface EmploymentAction {
  id: string
  actionType: string
  effectiveDate: string
  employment: {
    id: string
    employeeNumber: string
    status: EmploymentStatus
    person: { id: string; displayName: string }
  }
  warnings?: string[]
}
