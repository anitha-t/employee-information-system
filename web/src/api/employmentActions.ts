import type { EmploymentAction, HirePayload } from '../types/employmentAction'
import { api } from './client'

/** POST /employment_actions. 201 with optional `warnings`, or 422 with field details. */
export function createHire(payload: HirePayload): Promise<EmploymentAction> {
  return api.post<EmploymentAction>('/employment_actions', payload)
}
