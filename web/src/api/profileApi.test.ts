import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiError, employeeDetail, profile } from '../test/fixtures'
import { API, server } from '../test/server'
import { setUnauthorizedHandler } from './client'
import { getEmployee } from './employees'
import { getPersonProfile, updateMyProfile, updatePersonProfile } from './profile'

const onUnauthorized = vi.fn()
setUnauthorizedHandler(onUnauthorized)
afterEach(() => onUnauthorized.mockClear())
const unauthorized = () => HttpResponse.json(apiError('unauthenticated', 'x'), { status: 401 })

describe('profile updates', () => {
  it('sends snake_case changes, keeping _destroy, and returns the new profile', async () => {
    let body: unknown
    server.use(http.patch(`${API}/me/profile`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...profile, lock_version: 4, preferred_name: 'P' })
    }))

    const saved = await updateMyProfile({
      lockVersion: 3, preferredName: 'P',
      addresses: [{ id: 'a1', _destroy: true }],
      emergencyContacts: [{ name: 'Ravi', relationship: null, phoneNumber: '+919811111111', isPrimary: true }],
    })

    expect(body).toEqual({
      lock_version: 3, preferred_name: 'P', addresses: [{ id: 'a1', _destroy: true }],
      emergency_contacts: [{ name: 'Ravi', relationship: null, phone_number: '+919811111111', is_primary: true }],
    })
    expect(saved).toMatchObject({ lockVersion: 4, preferredName: 'P' })
  })

  it('reports nested validation errors, conflicts and forbidden fields', async () => {
    server.use(http.patch(`${API}/people/p1/profile`, () =>
      HttpResponse.json(apiError('validation_failed', 'Validation failed', { 'addresses[1].line1': ["can't be blank"] }), { status: 422 })))
    await expect(updatePersonProfile('p1', { lockVersion: 1 })).rejects.toMatchObject({ details: { 'addresses[1].line1': ["can't be blank"] } })

    server.use(http.patch(`${API}/me/profile`, () => HttpResponse.json(apiError('stale_object', 'Changed'), { status: 409 })))
    await expect(updateMyProfile({ lockVersion: 1 })).rejects.toMatchObject({ status: 409, code: 'stale_object' })

    server.use(http.patch(`${API}/me/profile`, () =>
      HttpResponse.json(apiError('forbidden_fields', 'No', { first_name: ['cannot be changed by you'] }), { status: 403 })))
    await expect(updateMyProfile({ lockVersion: 1, firstName: 'X' })).rejects.toMatchObject({ status: 403, details: { firstName: ['cannot be changed by you'] } })
  })

  it('redirects to sign-in on 401', async () => {
    server.use(http.patch(`${API}/me/profile`, unauthorized))
    await expect(updateMyProfile({ lockVersion: 1 })).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalled()
  })
})

describe('HR reads', () => {
  it('loads a person profile and an employee', async () => {
    server.use(
      http.get(`${API}/people/p-emp/profile`, () => HttpResponse.json(profile)),
      http.get(`${API}/employees/emp-1`, () => HttpResponse.json(employeeDetail())),
    )
    await expect(getPersonProfile('p-emp')).resolves.toMatchObject({ fullName: 'Priya Sharma' })
    await expect(getEmployee('emp-1')).resolves.toMatchObject({ employment: { noticePeriodDays: 60, compensationEffectiveFrom: '2025-04-01' } })
  })

  it('reports an unknown employee and a lost session', async () => {
    server.use(http.get(`${API}/employees/nope`, () => HttpResponse.json(apiError('not_found', 'Employee snapshot not found'), { status: 404 })))
    await expect(getEmployee('nope')).rejects.toMatchObject({ status: 404 })

    server.use(http.get(`${API}/people/p1/profile`, unauthorized))
    await expect(getPersonProfile('p1')).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalled()
  })
})
