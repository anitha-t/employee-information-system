import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiError, employee, employeesPage, hireResponse, hrMe, position, salaryBand } from '../test/fixtures'
import { renderApp } from '../test/render'
import { API, server, signInAs } from '../test/server'

type User = ReturnType<typeof renderApp>['user']

beforeEach(() => {
  signInAs(hrMe)
  server.use(
    http.get(`${API}/positions`, ({ request }) => {
      const params = new URL(request.url).searchParams
      const data = params.get('legal_entity_id') === 'le-in'
        ? [position('pos-swe', 'job-swe'), position('pos-staff', 'job-staff', { name: 'Staff Engineer, Platform (Remote)', is_remote: true, location: null, vacancies: 1 })]
        : []
      return HttpResponse.json({ data, meta: { page: 1, per_page: 100, total_count: data.length, as_of: params.get('as_of') } })
    }),
    http.get(`${API}/salary_bands`, () => HttpResponse.json({ data: [salaryBand] })),
    http.get(`${API}/employees`, () => HttpResponse.json(employeesPage([
      employee({ employment_id: 'mgr-1', employee_number: 'E000009', person: { id: 'p9', full_name: 'Ravi Kumar', display_name: 'Ravi Kumar', email: null } }),
    ]))),
  )
})

async function fillRequired(user: User) {
  await user.type(await screen.findByLabelText(/First name/), 'Meera')
  await user.selectOptions(screen.getByLabelText(/Legal entity/), 'le-in')
  await screen.findByRole('option', { name: /Software Engineer, Platform \(IN\) · Bengaluru · 2 open/ })
  await user.selectOptions(screen.getByLabelText(/Position/), 'pos-swe')
  await user.selectOptions(screen.getByLabelText(/Grade/), 'g2')
  await user.type(screen.getByLabelText(/Annual salary/), '1200000')
}

describe('new hire', () => {
  it('limits positions to the entity and grades to the job, and shows the band', async () => {
    const { user } = renderApp('/employees/new')

    expect(await screen.findByLabelText(/Position/)).toBeDisabled()
    expect(screen.getByLabelText(/Grade/)).toBeDisabled()

    await user.selectOptions(screen.getByLabelText(/Legal entity/), 'le-in')
    expect(screen.getByLabelText('Annual salary (INR) *')).toBeInTheDocument()
    await screen.findByRole('option', { name: /Staff Engineer.*Remote · 1 open/ })

    await user.selectOptions(screen.getByLabelText(/Position/), 'pos-swe')
    const grade = screen.getByLabelText(/Grade/)
    expect(within(grade).getAllByRole('option').map((option) => option.textContent)).toEqual(['Select…', 'G1 · Grade 1', 'G2 · Grade 2', 'G3 · Grade 3'])
    expect(screen.getByText('Allowed for this job: G1–G3')).toBeInTheDocument()

    await user.selectOptions(grade, 'g2')
    expect(await screen.findByText(/Band for G2 in India: ₹8,40,000 – ₹14,00,000/)).toBeInTheDocument()

    // A position for another job clears a grade outside its range.
    await user.selectOptions(screen.getByLabelText(/Position/), 'pos-staff')
    await waitFor(() => expect(screen.getByLabelText(/Grade/)).toHaveValue(''))

    // Another entity clears the position and changes the currency.
    await user.selectOptions(screen.getByLabelText(/Legal entity/), 'le-us')
    expect(screen.getByLabelText(/Position/)).toHaveValue('')
    expect(screen.getByLabelText('Annual salary (USD) *')).toBeInTheDocument()
    expect(await screen.findByText('No open positions at this entity on the start date.')).toBeInTheDocument()
  })

  it('validates required fields on the client', async () => {
    const { user } = renderApp('/employees/new')

    await user.click(await screen.findByRole('button', { name: 'Create hire' }))

    expect(await screen.findByText('Enter a first name')).toBeInTheDocument()
    expect(screen.getByText('Choose a legal entity')).toBeInTheDocument()
    expect(screen.getByText('Choose a position')).toBeInTheDocument()
    expect(screen.getByText('Choose a grade')).toBeInTheDocument()
    expect(screen.getByText('Enter an annual salary')).toBeInTheDocument()
  })

  it('creates the hire with the documented payload, then returns to the dashboard', async () => {
    let body: Record<string, unknown> = {}
    server.use(http.post(`${API}/employment_actions`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>
      return HttpResponse.json({ ...hireResponse, warnings: ['annual_salary 1200000 INR is outside the G2 band for IN'] }, { status: 201 })
    }))
    const { user, location } = renderApp('/employees/new')

    await fillRequired(user)
    await user.type(screen.getByLabelText(/Personal email/), 'meera@example.com')
    await user.type(screen.getByLabelText(/Notice period/), '60')
    await user.type(screen.getByLabelText('Manager'), 'ravi')
    await user.click(await screen.findByRole('button', { name: /Ravi Kumar/ }))
    expect(screen.getByText('Ravi Kumar (E000009)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create hire' }))

    expect(await screen.findByText('Hired Meera Iyer as E010001.')).toBeInTheDocument()
    expect(screen.getByText(/outside the G2 band/)).toBeInTheDocument()
    expect(location()).toBe('/dashboard')
    expect(body).toEqual({
      action_type: 'hire',
      effective_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      person: { first_name: 'Meera', email: 'meera@example.com' },
      employment: { legal_entity_id: 'le-in', employment_type: 'full_time', notice_period_days: 60 },
      assignment: { position_id: 'pos-swe', grade_id: 'g2', reports_to_employment_id: 'mgr-1' },
      compensation: { annual_salary: { amount: '1200000.00', currency: 'INR' }, pay_frequency: 'monthly' },
    })
  })

  it('puts server errors on their fields and the rest in a summary', async () => {
    server.use(http.post(`${API}/employment_actions`, () => HttpResponse.json(apiError('validation_failed', 'Validation failed', {
      'person.email': ['has already been taken'],
      'assignment.grade': ['is outside the job grade range'],
      'compensation.currency': ['must be INR'],
    }), { status: 422 })))
    const { user, location } = renderApp('/employees/new')

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Create hire' }))

    expect(await screen.findByText('has already been taken')).toBeInTheDocument()
    expect(screen.getByText('is outside the job grade range')).toBeInTheDocument()
    expect(screen.getByText('Currency must be INR')).toBeInTheDocument()
    expect(location()).toBe('/employees/new')
    expect(screen.getByLabelText(/First name/)).toHaveValue('Meera')
  })

  it('asks before discarding changes', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const { user, location } = renderApp('/employees/new')

    await user.type(await screen.findByLabelText(/First name/), 'Meera')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(location()).toBe('/employees/new')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(confirm).toHaveBeenCalledWith('Discard this new hire?')
    await waitFor(() => expect(location()).toBe('/dashboard'))
  })

  it('shows a retry when the form options fail to load', async () => {
    server.use(http.get(`${API}/grades`, () => HttpResponse.json(apiError('internal', 'x'), { status: 500 }), { once: true }))
    const { user } = renderApp('/employees/new')

    await user.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { name: 'New hire' })).toBeInTheDocument()
  })
})
