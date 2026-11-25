// HR salary reports (docs/api-design.md §2.7). One entry per country, in its currency.
import type { JobSalaryStats, SalaryStats, SpendReport, StatsFilters, StatsReport } from '../types/reports'
import { api } from './client'

export function getSalaryStats(filters: StatsFilters): Promise<StatsReport<SalaryStats>> {
  return api.get('/reports/salary_stats', { query: { ...filters } })
}

export function getSalaryByJob(filters: StatsFilters): Promise<StatsReport<JobSalaryStats>> {
  return api.get('/reports/salary_by_job', { query: { ...filters } })
}

/** Always asks for the monthly breakdown. */
export function getSalarySpend(filters: { country?: string; year?: number }): Promise<SpendReport> {
  return api.get('/reports/salary_spend', { query: { ...filters, breakdown: 'month' } })
}
