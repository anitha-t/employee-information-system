import type { Paginated } from '../types/api'
import type { ChangePayload, EmploymentAction, EmploymentActionDetail, HirePayload } from '../types/employmentAction'
import { api } from './client'

/** POST /employment_actions. 201 with optional `warnings`, or 422 with field details. */
export function createHire(payload: HirePayload): Promise<EmploymentAction> {
  return api.post<EmploymentAction>('/employment_actions', payload)
}

/** An increment, promotion or transfer. Same endpoint and responses as a hire. */
export function createChange(payload: ChangePayload): Promise<EmploymentAction> {
  return api.post<EmploymentAction>('/employment_actions', payload)
}

/** Every action on one employment, newest effective date first. */
export function listEmploymentActions(employmentId: string): Promise<Paginated<EmploymentActionDetail>> {
  return api.get('/employment_actions', { query: { employmentId, perPage: 100 } })
}
