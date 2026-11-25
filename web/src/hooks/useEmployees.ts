import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { listEmployees } from '../api/employees'
import type { EmployeeFilters } from '../types/employee'
import { queryKeys } from './queryKeys'

/** GET /employees. Keeps the previous page on screen while the next one loads. */
export function useEmployees(filters: EmployeeFilters, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.employeeList(filters),
    queryFn: ({ signal }) => listEmployees(filters, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  })
}
