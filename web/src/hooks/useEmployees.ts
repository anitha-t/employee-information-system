import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getEmployee, listEmployees } from '../api/employees'
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

/** HR: one employee (GET /employees/:employmentId). */
export function useEmployee(employmentId: string) {
  return useQuery({
    queryKey: queryKeys.employee(employmentId),
    queryFn: () => getEmployee(employmentId),
  })
}
