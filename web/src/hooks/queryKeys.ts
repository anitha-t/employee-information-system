// Every query key in one place (AGENTS.md §5).
import type { EmployeeFilters } from '../types/employee'
import type { StatsFilters } from '../types/reports'

export const queryKeys = {
  me: ['me'] as const,
  myProfile: ['me', 'profile'] as const,
  personProfile: (personId: string) => ['people', personId, 'profile'] as const,
  employees: ['employees'] as const,
  employeeList: (filters: EmployeeFilters) => ['employees', 'list', filters] as const,
  employee: (employmentId: string) => ['employees', 'detail', employmentId] as const,
  salaryStats: (filters: StatsFilters) => ['reports', 'salary_stats', filters] as const,
  salaryByJob: (filters: StatsFilters) => ['reports', 'salary_by_job', filters] as const,
  salarySpend: (filters: { country?: string; year?: number }) => ['reports', 'salary_spend', filters] as const,
  countries: ['countries'] as const,
  legalEntities: ['legal_entities'] as const,
  grades: ['grades'] as const,
  jobs: ['jobs'] as const,
  allPositions: ['positions'] as const,
  positions: (query: { legalEntityId: string; asOf?: string }) => ['positions', query] as const,
  salaryBands: (query: { country: string; gradeId: string; asOf?: string }) => ['salary_bands', query] as const,
}
