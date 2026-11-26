import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getSalaryByJob, getSalarySpend, getSalaryStats } from '../api/reports'
import type { StatsFilters } from '../types/reports'
import { queryKeys } from './queryKeys'

// Reports run only when asked (`enabled`), and keep the previous figures on screen (dimmed) while new ones load.
const options = (enabled: boolean) => ({ enabled, placeholderData: keepPreviousData, staleTime: 60_000 })

export const useSalaryStats = (filters: StatsFilters, enabled = true) =>
  useQuery({ queryKey: queryKeys.salaryStats(filters), queryFn: () => getSalaryStats(filters), ...options(enabled) })

export const useSalaryByJob = (filters: StatsFilters, enabled = true) =>
  useQuery({ queryKey: queryKeys.salaryByJob(filters), queryFn: () => getSalaryByJob(filters), ...options(enabled) })

/** The current year's spend (the API defaults `year` to this year). */
export const useSalarySpend = (filters: { country?: string }, enabled = true) =>
  useQuery({ queryKey: queryKeys.salarySpend(filters), queryFn: () => getSalarySpend(filters), ...options(enabled) })
