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

export type ChangeType = 'salary_change' | 'promotion' | 'transfer'

/** POST /employment_actions for a change to an existing employment (api-design.md §3.2). */
export interface ChangePayload {
  actionType: ChangeType
  employmentId: string
  effectiveDate: string
  reason?: string
  assignment?: { positionId?: string; gradeId?: string; reportsToEmploymentId?: string }
  compensation?: { annualSalary: Money }
}

/** The assignment row an action created. */
export interface ActionAssignment {
  id: string
  effectiveFrom: string
  effectiveTo: string | null
  position: { id: string; code: string; name: string }
  job: { id: string; title: string }
  team: { id: string; name: string }
  grade: { id: string; code: string }
  reportsTo: { employmentId: string; displayName: string } | null
}

/** The compensation row an action created. */
export interface ActionCompensation {
  id: string
  effectiveFrom: string
  effectiveTo: string | null
  annualSalary: Money
  payFrequency: PayFrequency
}

/** One item of GET /employment_actions. */
export interface EmploymentActionDetail extends EmploymentAction {
  lockVersion: number
  reason: string | null
  assignment: ActionAssignment | null
  compensation: ActionCompensation | null
  separation: { resignationDate: string | null; lastWorkingDate: string; separationType: string | null; separationReason: string | null } | null
  createdBy: { id: string; displayName: string } | null
  createdAt: string
}
