import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getSalaryByJob, getSalarySpend, getSalaryStats } from '../api/reports'
import type { JobStatsFilters, SpendFilters, StatsFilters } from '../types/reports'
import { queryKeys } from './queryKeys'

// Each report runs only after its Go (`enabled`), and keeps its previous figures on screen (dimmed) while new ones load.
const options = (enabled: boolean) => ({ enabled, placeholderData: keepPreviousData, staleTime: 60_000 })

export const useSalaryStats = (filters: StatsFilters, enabled = true) =>
  useQuery({ queryKey: queryKeys.salaryStats(filters), queryFn: () => getSalaryStats(filters), ...options(enabled) })

export const useSalaryByJob = (filters: JobStatsFilters, enabled = true) =>
  useQuery({ queryKey: queryKeys.salaryByJob(filters), queryFn: () => getSalaryByJob(filters), ...options(enabled) })

export const useSalarySpend = (filters: SpendFilters, enabled = true) =>
  useQuery({ queryKey: queryKeys.salarySpend(filters), queryFn: () => getSalarySpend(filters), ...options(enabled) })
