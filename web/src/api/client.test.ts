import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API, server } from '../test/server'
import { ApiError, request, setUnauthorizedHandler, toCamel, toSnake } from './client'

afterEach(() => setUnauthorizedHandler(() => {}))

describe('api client', () => {
  it('sends the cookie, the CSRF header and snake_case JSON, and returns camelCase', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    let seen: { xhr: string | null; body: unknown } | undefined
    server.use(http.post(`${API}/things`, async ({ request: req }) => {
      seen = { xhr: req.headers.get('X-Requested-With'), body: await req.json() }
      return HttpResponse.json({ employee_number: 'E1', nested_list: [{ display_name: 'A' }] }, { status: 201 })
    }))

    const result = await request('POST', '/things', { body: { firstName: 'Priya', addresses: [{ postalCode: '1', _destroy: true }] } })

    // MSW's Node interceptor drops `credentials`, so check what fetch was given.
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' })
    expect(seen).toEqual({
      xhr: 'XMLHttpRequest',
      body: { first_name: 'Priya', addresses: [{ postal_code: '1', _destroy: true }] },
    })
    expect(result).toEqual({ employeeNumber: 'E1', nestedList: [{ displayName: 'A' }] })
  })

  it('snake_cases query parameters and skips empty ones', async () => {
    let url = ''
    server.use(http.get(`${API}/things`, ({ request: req }) => {
      url = req.url
      return HttpResponse.json({})
    }))

    await request('GET', '/things', { query: { employmentType: 'intern', perPage: 25, q: '', country: undefined } })

    expect(new URL(url).search).toBe('?employment_type=intern&per_page=25')
  })

  it('returns null for 204', async () => {
    server.use(http.delete(`${API}/things`, () => new HttpResponse(null, { status: 204 })))
    await expect(request('DELETE', '/things')).resolves.toBeNull()
  })

  it('throws ApiError with camelCase detail paths on 422', async () => {
    server.use(http.post(`${API}/things`, () => HttpResponse.json(
      { error: { code: 'validation_failed', message: 'Validation failed', details: { 'person.first_name': ["can't be blank"] } } },
      { status: 422 },
    )))

    const error = await request('POST', '/things', { body: {} }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'validation_failed', details: { 'person.firstName': ["can't be blank"] } })
  })

  it('copes with a non-JSON error body', async () => {
    server.use(http.get(`${API}/things`, () => new HttpResponse('<html>Bad gateway</html>', { status: 502 })))
    await expect(request('GET', '/things')).rejects.toMatchObject({ status: 502, code: 'http_error' })
  })

  it('calls the unauthorized handler on 401 unless told not to', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    server.use(http.get(`${API}/things`, () => HttpResponse.json({ error: { code: 'unauthenticated', message: 'x' } }, { status: 401 })))

    await expect(request('GET', '/things')).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledTimes(1)

    await expect(request('GET', '/things', { redirectOn401: false })).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

describe('key conversion', () => {
  it('round-trips nested keys and leaves values alone', () => {
    const api = { annual_salary: { amount: '10.00' }, addresses_attributes: [{ line_1: 'x' }], 'person.first_name': ['msg'] }
    expect(toCamel(api)).toEqual({ annualSalary: { amount: '10.00' }, addressesAttributes: [{ line1: 'x' }], 'person.firstName': ['msg'] })
    expect(toSnake({ annualSalary: { amount: 'first_name' } })).toEqual({ annual_salary: { amount: 'first_name' } })
  })
})
