import type { Paginated } from '../types/api'
import type { Employee, EmployeeFilters, EmployeesMeta } from '../types/employee'
import { api } from './client'

export function listEmployees(filters: EmployeeFilters, signal?: AbortSignal): Promise<Paginated<Employee, EmployeesMeta>> {
  return api.get('/employees', { query: { ...filters }, signal })
}
