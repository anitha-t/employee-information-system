import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { apiError, employee, employeeDetail, employeeMe, employeesPage, hrMe, profile } from '../test/fixtures'
import { renderApp } from '../test/render'
import { API, server, signInAs } from '../test/server'

beforeEach(() => {
  signInAs(hrMe)
  server.use(
    http.get(`${API}/employees/emp-1`, () => HttpResponse.json(employeeDetail())),
    http.get(`${API}/people/p-emp/profile`, () => HttpResponse.json(profile)),
  )
})

describe('employee detail', () => {
  it('opens from the employee list and shows employment, pay and profile', async () => {
    server.use(http.get(`${API}/employees`, () => HttpResponse.json(employeesPage([employee()]))))
    const { user, location } = renderApp('/dashboard')

    await user.click(await screen.findByRole('link', { name: 'Priya Sharma' }))

    expect(location()).toBe('/employees/emp-1')
    expect(await screen.findByRole('heading', { name: 'Anu' })).toBeInTheDocument()
    const employment = screen.getByRole('region', { name: 'Employment' })
    expect(employment).toHaveTextContent(/Acme India Pvt Ltd.*IN \(INR\).*Full time.*6 Jan 2020/)
    expect(employment).toHaveTextContent('G2 (since 1 Apr 2025)')
    expect(within(employment).getByRole('link', { name: 'Ravi Kumar' })).toHaveAttribute('href', '/employees/emp-9')
    expect(screen.getByRole('region', { name: 'Pay' })).toHaveTextContent(/₹18,50,000.*Monthly.*1 Apr 2025/)
    expect(await screen.findByRole('region', { name: 'Addresses' })).toHaveTextContent('12 MG Road')
    expect(screen.queryByText('Last working day')).not.toBeInTheDocument()
  })

  it('shows separation details for leavers', async () => {
    server.use(http.get(`${API}/employees/emp-1`, () => HttpResponse.json(employeeDetail({
      status: 'on_notice', last_working_date: '2026-12-31',
      employment: { ...employeeDetail().employment, resignation_date: '2026-11-01', separation_type: 'voluntary',
        separation_reason: 'Higher studies', eligible_for_rehire: true },
    }))))
    renderApp('/employees/emp-1')

    const employment = await screen.findByRole('region', { name: 'Employment' })
    expect(employment).toHaveTextContent(/Resignation date.*1 Nov 2026.*Last working day.*31 Dec 2026.*Voluntary.*Higher studies.*Yes/)
  })

  it('explains an unknown employee', async () => {
    server.use(http.get(`${API}/employees/nope`, () => HttpResponse.json(apiError('not_found', 'Not found'), { status: 404 })))
    renderApp('/employees/nope')

    expect(await screen.findByRole('heading', { name: 'Employee not found' })).toBeInTheDocument()
  })

  it('is HR-only', async () => {
    signInAs(employeeMe)
    renderApp('/employees/emp-1/edit')

    expect(await screen.findByRole('heading', { name: "You don't have access to this page" })).toBeInTheDocument()
  })
})

describe('edit an employee (HR)', () => {
  it('edits legal details and returns to the employee', async () => {
    let body: Record<string, unknown> = {}
    server.use(http.patch(`${API}/people/p-emp/profile`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>
      return HttpResponse.json({ ...profile, lock_version: 4, first_name: 'Priyanka', full_name: 'Priyanka Sharma' })
    }))
    const { user, location } = renderApp('/employees/emp-1')

    await user.click(await screen.findByRole('link', { name: 'Edit profile' }))
    const firstName = await screen.findByLabelText(/First name/)
    await user.clear(firstName)
    await user.type(firstName, 'Priyanka')
    await user.selectOptions(screen.getByLabelText('Gender'), 'Prefer not to say')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText("Saved Priyanka Sharma's profile.")).toBeInTheDocument()
    await waitFor(() => expect(location()).toBe('/employees/emp-1'))
    expect(body).toMatchObject({ lock_version: 3, first_name: 'Priyanka', gender: 'undisclosed', last_name: 'Sharma' })
  })

  it('treats a row deleted by someone else as a conflict', async () => {
    server.use(http.patch(`${API}/people/p-emp/profile`, () => HttpResponse.json(apiError('not_found', 'Address not found'), { status: 404 })))
    const { user } = renderApp('/employees/emp-1/edit')

    await user.click(await screen.findByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/Someone else changed this profile/)).toBeInTheDocument()
  })

  it('explains an unknown employee', async () => {
    server.use(http.get(`${API}/employees/nope`, () => HttpResponse.json(apiError('not_found', 'Not found'), { status: 404 })))
    renderApp('/employees/nope/edit')

    expect(await screen.findByRole('heading', { name: 'Employee not found' })).toBeInTheDocument()
  })
})
