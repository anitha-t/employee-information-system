import type { Money } from './api'

/** Min, max, average and median salary; money is null when headcount is 0. */
export interface SalaryStats {
  country: string
  currency: string
  headcount: number
  min: Money | null
  max: Money | null
  average: Money | null
  median: Money | null
}

export interface JobSalaryStats extends SalaryStats {
  jobTitle: string
}

export interface StatsReport<T> {
  asOf: string
  data: T[]
}

export interface CountrySpend {
  country: string
  currency: string
  employeeCount: number
  totalSpend: Money
  breakdown?: { month: string; spend: Money }[]
}

/** GET /reports/salary_spend. `to` is null for a future year; `partial` for the current one. */
export interface SpendReport {
  year: number
  from: string
  to: string | null
  partial: boolean
  data: CountrySpend[]
}

export interface StatsFilters {
  country?: string
  asOf?: string
  employmentType?: string
}
