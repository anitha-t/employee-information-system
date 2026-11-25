import type { Paginated } from '../types/api'
import type { Employee, EmployeeDetail, EmployeeFilters, EmployeesMeta } from '../types/employee'
import { api } from './client'

export function listEmployees(filters: EmployeeFilters, signal?: AbortSignal): Promise<Paginated<Employee, EmployeesMeta>> {
  return api.get('/employees', { query: { ...filters }, signal })
}

/** HR: one employment, with job and pay as of today. 404 for an unknown id. */
export function getEmployee(employmentId: string): Promise<EmployeeDetail> {
  return api.get(`/employees/${encodeURIComponent(employmentId)}`)
}
