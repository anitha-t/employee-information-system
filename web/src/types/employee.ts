import type { Money, PageMeta } from './api'
import type { EmploymentStatus } from './me'

export type EmploymentType = 'full_time' | 'part_time' | 'contractor' | 'intern'
export type PayFrequency = 'monthly' | 'semi_monthly' | 'bi_weekly' | 'weekly'

/** One row of GET /employees. */
export interface Employee {
  employmentId: string
  employeeNumber: string
  status: EmploymentStatus
  employmentType: EmploymentType
  hireDate: string
  lastWorkingDate: string | null
  workEmail: string | null
  person: { id: string; fullName: string; displayName: string; email: string | null }
  legalEntity: { id: string; name: string }
  country: { id: string; isoCode: string; currency: string }
  position: { id: string; name: string } | null
  job: { id: string; title: string; level: string | null } | null
  team: { id: string; name: string } | null
  grade: { id: string; code: string } | null
  manager: { employmentId: string; displayName: string } | null
  annualSalary: Money | null
  payFrequency: PayFrequency | null
}

export interface EmployeesMeta extends PageMeta {
  asOf: string
}

/** Query-string filters for GET /employees. All optional. */
export interface EmployeeFilters {
  q?: string
  country?: string
  status?: string
  employmentType?: string
  page?: number
  perPage?: number
}
