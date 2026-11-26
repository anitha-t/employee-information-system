import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiError, employee, employeeDetail, employeesPage, history, hireResponse, hrMe, position, profile, salaryBand } from '../test/fixtures'
import { renderApp } from '../test/render'
import { API, server, signInAs } from '../test/server'

let posted: Record<string, unknown>[]

beforeEach(() => {
  signInAs(hrMe)
  posted = []
  server.use(
    http.get(`${API}/employees/emp-1`, () => HttpResponse.json(employeeDetail({
      position: { id: 'pos-swe', name: 'Software Engineer, Platform (IN)' }, grade: { id: 'g2', code: 'G2' },
    }))),
    http.get(`${API}/people/p-emp/profile`, () => HttpResponse.json(profile)),
    http.get(`${API}/employment_actions`, () => HttpResponse.json(history)),
    http.get(`${API}/positions`, () => HttpResponse.json({
      data: [position('pos-swe', 'job-swe'), position('pos-staff', 'job-staff', { name: 'Staff Engineer, Payments (IN)' })],
      meta: { page: 1, per_page: 100, total_count: 2, as_of: '2026-12-01' },
    })),
    http.get(`${API}/salary_bands`, () => HttpResponse.json({ data: [salaryBand] })),
    http.get(`${API}/employees`, () => HttpResponse.json(employeesPage([
      employee({ employment_id: 'mgr-2', employee_number: 'E000077', person: { id: 'p77', full_name: 'Sara Lee', display_name: 'Sara Lee', email: null } }),
    ]))),
    http.post(`${API}/employment_actions`, async ({ request }) => {
      posted.push(await request.json() as Record<string, unknown>)
      return HttpResponse.json({ ...hireResponse, employment: { ...hireResponse.employment, id: 'emp-1' } }, { status: 201 })
    }),
  )
})

describe('employee detail: changes and history', () => {
  it('offers the three changes and shows the history', async () => {
    renderApp('/employees/emp-1')

    expect(await screen.findByRole('link', { name: 'Increment' })).toHaveAttribute('href', '/employees/emp-1/changes/new?type=salary_change')
    expect(screen.getByRole('link', { name: 'Promote' })).toHaveAttribute('href', '/employees/emp-1/changes/new?type=promotion')
    expect(screen.getByRole('link', { name: 'Transfer' })).toHaveAttribute('href', '/employees/emp-1/changes/new?type=transfer')
    const historyCard = await screen.findByRole('region', { name: 'History' })
    expect(historyCard).toHaveTextContent(/Promotion.*1 Apr 2025.*Grade G1 → G2.*FY25 cycle · by Hema Rao/)
  })

  it('hides the changes for employees who are leaving', async () => {
    server.use(http.get(`${API}/employees/emp-1`, () => HttpResponse.json(employeeDetail({ status: 'on_notice' }))))
    renderApp('/employees/emp-1')

    expect(await screen.findByText('No further changes can be made (on notice).')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Promote' })).not.toBeInTheDocument()
  })
})

describe('change form', () => {
  it('saves an increment with only the new salary, then returns to the employee', async () => {
    const { user, location } = renderApp('/employees/emp-1/changes/new?type=salary_change')

    expect(await screen.findByText(/Software Engineer, Platform \(IN\) · G2 · ₹18,50,000 · Manager Ravi Kumar/)).toBeInTheDocument()
    expect(screen.getByText('Must be after 1 Apr 2025 (last pay change)')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Position/)).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText(/Effective date/))
    await user.type(screen.getByLabelText(/Effective date/), '2026-04-01')
    await user.type(screen.getByLabelText(/New annual salary \(INR\)/), '2000000')
    expect(screen.getByText(/\+8\.1% from ₹18,50,000/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save increment' }))

    expect(await screen.findByText('Increment saved for Priya Sharma, effective 1 Apr 2026.')).toBeInTheDocument()
    await waitFor(() => expect(location()).toBe('/employees/emp-1'))
    expect(posted).toEqual([{
      action_type: 'salary_change', employment_id: 'emp-1', effective_date: '2026-04-01',
      compensation: { annual_salary: { amount: '2000000.00', currency: 'INR' } },
    }])
  })

  it('promotes with a new grade and optional raise, hinting when the grade is not higher', async () => {
    const { user } = renderApp('/employees/emp-1/changes/new?type=promotion')

    const grade = await screen.findByLabelText(/Grade/)
    await waitFor(() => expect(grade).toHaveValue('g2'))
    await waitFor(() => expect(screen.getByLabelText(/Position/)).toHaveValue('pos-swe')) // shown once positions load
    expect(screen.queryByText(/Usually a promotion moves to a higher grade/)).not.toBeInTheDocument()
    expect(within(grade).getAllByRole('option').map((option) => option.textContent)).toEqual(['Select…', 'G1 · Grade 1', 'G2 · Grade 2', 'G3 · Grade 3'])
    await user.selectOptions(grade, 'g1')
    expect(screen.getByText(/Usually a promotion moves to a higher grade/)).toBeInTheDocument()
    await user.selectOptions(grade, 'g3')
    await user.clear(screen.getByLabelText(/Effective date/))
    await user.type(screen.getByLabelText(/Effective date/), '2026-04-01')
    await user.click(screen.getByRole('button', { name: 'Save promotion' }))

    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({ action_type: 'promotion', employment_id: 'emp-1', effective_date: '2026-04-01', assignment: { grade_id: 'g3' } })
  })

  it('transfers to another position with a new manager, clearing a grade outside the new job', async () => {
    const { user } = renderApp('/employees/emp-1/changes/new?type=transfer')

    await screen.findByRole('option', { name: /Staff Engineer, Payments/ })
    await user.selectOptions(screen.getByLabelText(/Position/), 'pos-staff')
    await waitFor(() => expect(screen.getByLabelText(/Grade/)).toHaveValue(''))
    await user.selectOptions(screen.getByLabelText(/Grade/), 'g4')
    expect(screen.getByText('Ravi Kumar')).toBeInTheDocument() // current manager is kept unless changed
    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.type(screen.getByLabelText('Manager'), 'sara')
    await user.click(await screen.findByRole('button', { name: /Sara Lee/ }))
    await user.clear(screen.getByLabelText(/Effective date/))
    await user.type(screen.getByLabelText(/Effective date/), '2026-04-01')
    await user.click(screen.getByRole('button', { name: 'Save transfer' }))

    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({
      action_type: 'transfer', employment_id: 'emp-1', effective_date: '2026-04-01',
      assignment: { position_id: 'pos-staff', grade_id: 'g4', reports_to_employment_id: 'mgr-2' },
    })
  })

  it('checks the date and rules on the client', async () => {
    const { user } = renderApp('/employees/emp-1/changes/new?type=promotion')

    await user.clear(await screen.findByLabelText(/Effective date/))
    await user.type(screen.getByLabelText(/Effective date/), '2025-01-01')
    await user.click(screen.getByRole('button', { name: 'Save promotion' }))

    expect(await screen.findByText('Change the grade or the position')).toBeInTheDocument()
    expect(screen.getAllByText('Must be after 1 Apr 2025 (last role change)').length).toBeGreaterThan(0)
    expect(posted).toEqual([])
  })

  it('maps server errors and shows band warnings', async () => {
    server.use(http.post(`${API}/employment_actions`, () => HttpResponse.json(apiError('validation_failed', 'Validation failed', {
      'assignment.grade': ['must be between G1 and G3 for this job'], employment_id: ['is on notice; no further changes can be made'],
    }), { status: 422 }), { once: true }))
    const { user } = renderApp('/employees/emp-1/changes/new?type=promotion')

    const grade = await screen.findByLabelText(/Grade/)
    await waitFor(() => expect(grade).toHaveValue('g2'))
    await user.selectOptions(grade, 'g3')
    await user.clear(screen.getByLabelText(/Effective date/))
    await user.type(screen.getByLabelText(/Effective date/), '2026-04-01')
    await user.click(screen.getByRole('button', { name: 'Save promotion' }))

    expect(await screen.findByText('must be between G1 and G3 for this job')).toBeInTheDocument()
    expect(screen.getByText('Employment id is on notice; no further changes can be made')).toBeInTheDocument()

    server.use(http.post(`${API}/employment_actions`, () => HttpResponse.json(
      { ...hireResponse, employment: { ...hireResponse.employment, id: 'emp-1' }, warnings: ['annual_salary is outside the G3 band'] }, { status: 201 })))
    await user.click(screen.getByRole('button', { name: 'Save promotion' }))
    expect(await screen.findByText('annual_salary is outside the G3 band')).toBeInTheDocument()
  })

  it('switches type with tabs, defaults a missing type, and asks before discarding', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { user, location } = renderApp('/employees/emp-1/changes/new')

    await waitFor(() => expect(location()).toBe('/employees/emp-1/changes/new?type=salary_change'))
    await user.click(await screen.findByRole('link', { name: 'Internal transfer' }))
    expect(location()).toBe('/employees/emp-1/changes/new?type=transfer')
    await user.type(await screen.findByLabelText(/New annual salary/), '1')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(confirm).toHaveBeenCalledWith('Discard this change?')
    expect(location()).toBe('/employees/emp-1/changes/new?type=transfer')
  })

  it('refuses changes for an employee who is leaving', async () => {
    server.use(http.get(`${API}/employees/emp-1`, () => HttpResponse.json(employeeDetail({ status: 'separated' }))))
    renderApp('/employees/emp-1/changes/new?type=promotion')

    expect(await screen.findByText('No further changes can be made (separated).')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save promotion' })).not.toBeInTheDocument()
  })
})
