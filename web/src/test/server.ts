import { http, HttpResponse, type JsonBodyType } from 'msw'
import { setupServer } from 'msw/node'
import { apiError, countries, employeesPage, grades, jobs, legalEntities, profile } from './fixtures'

export const API = '/api/v1'

/** Defaults: signed out, with reference data available. Tests override per case. */
export const server = setupServer(
  http.get(`${API}/me`, () => HttpResponse.json(apiError('unauthenticated', 'Sign in to continue'), { status: 401 })),
  http.get(`${API}/me/profile`, () => HttpResponse.json(profile)),
  http.get(`${API}/countries`, () => HttpResponse.json({ data: countries })),
  http.get(`${API}/legal_entities`, () => HttpResponse.json({ data: legalEntities })),
  http.get(`${API}/grades`, () => HttpResponse.json({ data: grades })),
  http.get(`${API}/jobs`, () => HttpResponse.json({ data: jobs })),
  http.get(`${API}/employees`, () => HttpResponse.json(employeesPage([]))),
  http.delete(`${API}/session`, () => new HttpResponse(null, { status: 204 })),
)

/** Makes GET /me return `me` (i.e. signs that user in). */
export function signInAs(me: JsonBodyType) {
  server.use(http.get(`${API}/me`, () => HttpResponse.json(me)))
}
