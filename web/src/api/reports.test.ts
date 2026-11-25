import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiError, salaryByJob, salarySpend, salaryStats } from '../test/fixtures'
import { API, server } from '../test/server'
import { setUnauthorizedHandler } from './client'
import { getSalaryByJob, getSalarySpend, getSalaryStats } from './reports'

const onUnauthorized = vi.fn()
setUnauthorizedHandler(onUnauthorized)
afterEach(() => onUnauthorized.mockClear())

describe('reports API', () => {
  it('passes filters as snake_case and returns camelCase reports', async () => {
    const searches: string[] = []
    const track = (body: object) => ({ request }: { request: Request }) => {
      searches.push(new URL(request.url).search)
      return HttpResponse.json(body)
    }
    server.use(
      http.get(`${API}/reports/salary_stats`, track(salaryStats)),
      http.get(`${API}/reports/salary_by_job`, track(salaryByJob)),
      http.get(`${API}/reports/salary_spend`, track(salarySpend)),
    )

    await expect(getSalaryStats({ country: 'IN', asOf: '2026-06-30', employmentType: 'full_time' }))
      .resolves.toMatchObject({ asOf: '2026-11-25', data: [{ headcount: 0, median: null }, { median: { amount: '1434500.00' } }] })
    await expect(getSalaryByJob({ asOf: '2026-06-30' })).resolves.toMatchObject({ data: expect.arrayContaining([expect.objectContaining({ jobTitle: 'Data Scientist' })]) })
    await expect(getSalarySpend({ year: 2025 })).resolves.toMatchObject({ partial: true, data: [{ employeeCount: 5803, totalSpend: { currency: 'INR' } }, { breakdown: [] }] })

    expect(searches).toEqual([
      '?country=IN&as_of=2026-06-30&employment_type=full_time',
      '?as_of=2026-06-30',
      '?year=2025&breakdown=month',
    ])
  })

  it('reports bad filters and a lost session', async () => {
    server.use(http.get(`${API}/reports/salary_spend`, () =>
      HttpResponse.json(apiError('validation_failed', 'Validation failed', { year: ['must be a year between 2000 and 2100'] }), { status: 422 })))
    await expect(getSalarySpend({ year: 1990 })).rejects.toMatchObject({ status: 422, details: { year: ['must be a year between 2000 and 2100'] } })

    server.use(http.get(`${API}/reports/salary_stats`, () => HttpResponse.json(apiError('unauthenticated', 'x'), { status: 401 })))
    await expect(getSalaryStats({})).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalled()
  })
})
