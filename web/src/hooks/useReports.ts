import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getSalaryByJob, getSalarySpend, getSalaryStats } from '../api/reports'
import type { StatsFilters } from '../types/reports'
import { queryKeys } from './queryKeys'

// Reports keep the previous figures on screen (dimmed) while new filters load.
const options = { placeholderData: keepPreviousData, staleTime: 60_000 }

export const useSalaryStats = (filters: StatsFilters) =>
  useQuery({ queryKey: queryKeys.salaryStats(filters), queryFn: () => getSalaryStats(filters), ...options })

export const useSalaryByJob = (filters: StatsFilters) =>
  useQuery({ queryKey: queryKeys.salaryByJob(filters), queryFn: () => getSalaryByJob(filters), ...options })

export const useSalarySpend = (filters: { country?: string; year?: number }) =>
  useQuery({ queryKey: queryKeys.salarySpend(filters), queryFn: () => getSalarySpend(filters), ...options })
