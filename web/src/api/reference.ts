// Read-only reference data (docs/api-design.md §2.6).
import type { ListResponse, Paginated } from '../types/api'
import type { Country, Grade, Job, LegalEntity, Position, PositionsMeta, SalaryBand } from '../types/reference'
import { api } from './client'

const list = async <T>(path: string, query?: Record<string, string | undefined>) =>
  (await api.get<ListResponse<T>>(path, { query })).data

export const listCountries = () => list<Country>('/countries')
export const listLegalEntities = () => list<LegalEntity>('/legal_entities')
export const listGrades = () => list<Grade>('/grades')
export const listJobs = () => list<Job>('/jobs')

export function listPositions(query: { legalEntityId: string; asOf?: string }): Promise<Paginated<Position, PositionsMeta>> {
  return api.get('/positions', { query: { ...query, perPage: 100 } })
}

/** HR only. */
export const listSalaryBands = (query: { country: string; gradeId: string; asOf?: string }) =>
  list<SalaryBand>('/salary_bands', query)
