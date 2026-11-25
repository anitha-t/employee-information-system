// Each API function against MSW: success, 422 and 401 (AGENTS.md §9).
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiError, employeeMe, employee, employeesPage, hireResponse, legalEntities, position, profile, salaryBand } from '../test/fixtures'
import { API, server } from '../test/server'
import { getCurrentUser, requestPasswordReset, resetPassword, signIn, signOut } from './auth'
import { setUnauthorizedHandler } from './client'
import { listEmployees } from './employees'
import { createHire } from './employmentActions'
import { getMyProfile } from './profile'
import { listLegalEntities, listPositions, listSalaryBands } from './reference'

const unauthorized = () => HttpResponse.json(apiError('unauthenticated', 'Sign in to continue'), { status: 401 })
const onUnauthorized = vi.fn()
setUnauthorizedHandler(onUnauthorized)
afterEach(() => onUnauthorized.mockClear())

describe('auth', () => {
  it('signs in and returns the user', async () => {
    let body: unknown
    server.use(http.post(`${API}/session`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ token: 'ignored', expires_at: '2026-12-09T00:00:00Z', user: employeeMe.user }, { status: 201 })
    }))

    await expect(signIn({ emailAddress: 'priya@acme.example', password: 'pw' }))
      .resolves.toEqual({ id: 'u-emp', emailAddress: 'priya@acme.example', role: 'employee' })
    expect(body).toEqual({ email_address: 'priya@acme.example', password: 'pw' })
  })

  it('rejects bad credentials without triggering the sign-in redirect', async () => {
    server.use(http.post(`${API}/session`, () =>
      HttpResponse.json(apiError('invalid_credentials', 'Email or password is incorrect'), { status: 401 })))

    await expect(signIn({ emailAddress: 'x@y.z', password: 'bad' })).rejects.toMatchObject({ status: 401, code: 'invalid_credentials' })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('reads the current user, or null when signed out', async () => {
    await expect(getCurrentUser()).resolves.toBeNull()
    server.use(http.get(`${API}/me`, () => HttpResponse.json(employeeMe)))
    await expect(getCurrentUser()).resolves.toMatchObject({ person: { displayName: 'Anu' }, employment: { employeeNumber: 'E000123' } })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('surfaces server errors from /me', async () => {
    server.use(http.get(`${API}/me`, () => HttpResponse.json(apiError('internal', 'Boom'), { status: 500 })))
    await expect(getCurrentUser()).rejects.toMatchObject({ status: 500 })
  })

  it('signs out', async () => {
    await expect(signOut()).resolves.toBeNull()
  })

  it('requests a reset link and resets the password', async () => {
    server.use(
      http.post(`${API}/passwords`, () => new HttpResponse(null, { status: 202 })),
      http.put(`${API}/passwords/abc%2F1`, () => new HttpResponse(null, { status: 204 })),
    )
    await expect(requestPasswordReset('priya@acme.example')).resolves.toBeNull()
    await expect(resetPassword('abc/1', 'a-long-password')).resolves.toBeNull()
  })

  it('reports an invalid reset token', async () => {
    server.use(http.put(`${API}/passwords/:token`, () =>
      HttpResponse.json(apiError('invalid_token', 'This reset link is invalid or has expired'), { status: 422 })))
    await expect(resetPassword('old', 'a-long-password')).rejects.toMatchObject({ status: 422, code: 'invalid_token' })
  })
})

describe('profile', () => {
  it('loads my profile', async () => {
    await expect(getMyProfile()).resolves.toMatchObject({ lockVersion: 3, emergencyContacts: [{ isPrimary: true }] })
    expect(profile.addresses).toHaveLength(1)
  })

  it('redirects to sign-in on 401', async () => {
    server.use(http.get(`${API}/me/profile`, unauthorized))
    await expect(getMyProfile()).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalled()
  })
})

describe('employees', () => {
  it('lists employees with filters', async () => {
    let search = ''
    server.use(http.get(`${API}/employees`, ({ request }) => {
      search = new URL(request.url).search
      return HttpResponse.json(employeesPage([employee()]))
    }))

    const page = await listEmployees({ q: 'pri', employmentType: 'full_time', page: 2, perPage: 25 })

    expect(search).toBe('?q=pri&employment_type=full_time&page=2&per_page=25')
    expect(page.data[0]).toMatchObject({ employmentId: 'emp-1', annualSalary: { amount: '1850000.00', currency: 'INR' } })
    expect(page.meta).toMatchObject({ perPage: 25, totalCount: 1, asOf: '2026-11-25' })
  })

  it('reports a bad filter and a lost session', async () => {
    server.use(http.get(`${API}/employees`, () =>
      HttpResponse.json(apiError('validation_failed', 'Validation failed', { as_of: ['must be an ISO-8601 date'] }), { status: 422 })))
    await expect(listEmployees({})).rejects.toMatchObject({ status: 422, details: { asOf: ['must be an ISO-8601 date'] } })

    server.use(http.get(`${API}/employees`, unauthorized))
    await expect(listEmployees({})).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalled()
  })
})

describe('reference data', () => {
  it('lists legal entities, positions and salary bands', async () => {
    let positionsSearch = ''
    server.use(
      http.get(`${API}/positions`, ({ request }) => {
        positionsSearch = new URL(request.url).search
        return HttpResponse.json({ data: [position('pos-1', 'job-swe')], meta: { page: 1, per_page: 100, total_count: 1, as_of: '2026-12-01' } })
      }),
      http.get(`${API}/salary_bands`, () => HttpResponse.json({ data: [salaryBand] })),
    )

    await expect(listLegalEntities()).resolves.toHaveLength(legalEntities.length)
    await expect(listPositions({ legalEntityId: 'le-in', asOf: '2026-12-01' })).resolves.toMatchObject({ data: [{ vacancies: 2 }] })
    expect(positionsSearch).toBe('?legal_entity_id=le-in&as_of=2026-12-01&per_page=100')
    await expect(listSalaryBands({ country: 'IN', gradeId: 'g2' })).resolves.toMatchObject([{ min: { amount: '840000.00' } }])
  })

  it('reports an unknown country and a lost session', async () => {
    server.use(http.get(`${API}/salary_bands`, () =>
      HttpResponse.json(apiError('validation_failed', 'Validation failed', { country: ['is not a known country code'] }), { status: 422 })))
    await expect(listSalaryBands({ country: 'XX', gradeId: 'g1' })).rejects.toMatchObject({ status: 422 })

    server.use(http.get(`${API}/legal_entities`, unauthorized))
    await expect(listLegalEntities()).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalled()
  })
})

describe('employment actions', () => {
  const payload = {
    actionType: 'hire' as const, effectiveDate: '2026-12-01',
    person: { firstName: 'Meera' },
    employment: { legalEntityId: 'le-in', employmentType: 'full_time' as const },
    assignment: { positionId: 'pos-1', gradeId: 'g2' },
    compensation: { annualSalary: { amount: '1200000.00', currency: 'INR' }, payFrequency: 'monthly' as const },
  }

  it('creates a hire', async () => {
    let body: Record<string, unknown> = {}
    server.use(http.post(`${API}/employment_actions`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>
      return HttpResponse.json({ ...hireResponse, warnings: ['outside the band'] }, { status: 201 })
    }))

    await expect(createHire(payload)).resolves.toMatchObject({ employment: { employeeNumber: 'E010001' }, warnings: ['outside the band'] })
    expect(body).toMatchObject({
      action_type: 'hire', effective_date: '2026-12-01', person: { first_name: 'Meera' },
      employment: { legal_entity_id: 'le-in' }, compensation: { annual_salary: { amount: '1200000.00', currency: 'INR' } },
    })
  })

  it('returns field errors and handles a lost session', async () => {
    server.use(http.post(`${API}/employment_actions`, () =>
      HttpResponse.json(apiError('validation_failed', 'Validation failed', { 'assignment.grade': ['is outside the job grade range'] }), { status: 422 })))
    await expect(createHire(payload)).rejects.toMatchObject({ details: { 'assignment.grade': ['is outside the job grade range'] } })

    server.use(http.post(`${API}/employment_actions`, unauthorized))
    await expect(createHire(payload)).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalled()
  })
})
