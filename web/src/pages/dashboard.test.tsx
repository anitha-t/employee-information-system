import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiError, employee, employeeMe, employeesPage, hrMe, profile } from '../test/fixtures'
import { renderApp } from '../test/render'
import { API, server, signInAs } from '../test/server'

describe('employee dashboard', () => {
  it('shows my employment, details, addresses and emergency contacts', async () => {
    signInAs(employeeMe)
    renderApp('/dashboard')

    const employment = await screen.findByRole('region', { name: 'Employment' })
    expect(within(employment).getByText('E000123')).toBeInTheDocument()
    expect(within(employment).getByText('Active')).toBeInTheDocument()
    expect(within(employment).getByText('Software Engineer')).toBeInTheDocument()
    expect(within(employment).getByText('Ravi Kumar')).toBeInTheDocument()

    expect(await screen.findByText('1 May 1990')).toBeInTheDocument()
    const details = screen.getByRole('region', { name: 'Personal details' })
    expect(within(details).getByText('Female')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Addresses' })).toHaveTextContent('12 MG Road')
    expect(screen.getByRole('region', { name: 'Emergency contacts' })).toHaveTextContent(/Ravi.*spouse.*Primary/)
    expect(screen.queryByRole('link', { name: '+ New hire' })).not.toBeInTheDocument()
  })

  it('shows empty states', async () => {
    signInAs({ ...employeeMe, employment: null })
    server.use(http.get(`${API}/me/profile`, () => HttpResponse.json({ ...profile, addresses: [], emergency_contacts: [], dob: null })))
    renderApp('/dashboard')

    expect(await screen.findByText('No current employment on record.')).toBeInTheDocument()
    expect(await screen.findByText('No addresses yet.')).toBeInTheDocument()
    expect(screen.getByText('No emergency contacts yet.')).toBeInTheDocument()
  })

  it('offers a retry when the profile fails to load', async () => {
    signInAs(employeeMe)
    server.use(http.get(`${API}/me/profile`, () => HttpResponse.json(apiError('internal', 'x'), { status: 500 }), { once: true }))
    const { user } = renderApp('/dashboard')

    await user.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('region', { name: 'Addresses' })).toBeInTheDocument()
  })

  it('is also reachable as My profile, and hides HR pages from employees', async () => {
    signInAs(employeeMe)
    const { user } = renderApp('/employees/new')

    expect(await screen.findByRole('heading', { name: "You don't have access to this page" })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Anu/ }))
    await user.click(screen.getByRole('menuitem', { name: 'My profile' }))
    expect(await screen.findByRole('heading', { name: 'My profile' })).toBeInTheDocument()
  })
})

describe('HR dashboard', () => {
  const rows = [
    employee(),
    employee({ employment_id: 'emp-2', employee_number: 'E000002', status: 'on_notice',
      person: { id: 'p2', full_name: 'Jonathan Smith', display_name: 'Jon', email: null },
      country: { id: 'c-us', iso_code: 'US', currency: 'USD' }, annual_salary: { amount: '185000.00', currency: 'USD' }, manager: null }),
  ]

  /** Records every /employees query string. */
  function trackSearches(respond = (params: URLSearchParams) => employeesPage(rows, { total_count: 60, page: Number(params.get('page')) })) {
    const searches: string[] = []
    server.use(http.get(`${API}/employees`, ({ request }) => {
      const params = new URL(request.url).searchParams
      searches.push(params.toString())
      return HttpResponse.json(respond(params))
    }))
    return searches
  }

  it('lists employees with salaries in their own currency', async () => {
    signInAs(hrMe)
    trackSearches()
    renderApp('/dashboard')

    await screen.findByText('E000001')
    const [, first, second] = within(screen.getByRole('table')).getAllByRole('row')
    expect(first).toHaveTextContent(/E000001.*Priya Sharma.*Software Engineer.*Platform.*IN.*Ravi Kumar.*Active.*₹18,50,000/)
    expect(second).toHaveTextContent(/Jon.*Jonathan Smith.*On notice.*\$185,000/)
    expect(screen.getByText('Showing 1–25 of 60')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+ New hire' })).toHaveAttribute('href', '/employees/new')
  })

  it('searches as you type and keeps the search in the URL', async () => {
    signInAs(hrMe)
    const searches = trackSearches()
    const { user, location } = renderApp('/dashboard')

    await user.type(await screen.findByLabelText('Search employees'), 'priya')

    await waitFor(() => expect(location()).toBe('/dashboard?q=priya'))
    await waitFor(() => expect(searches.at(-1)).toBe('q=priya&page=1&per_page=25'))
    expect(searches.filter((search) => search.includes('q=p'))).toHaveLength(1) // debounced
  })

  it('filters and pages through results', async () => {
    signInAs(hrMe)
    const searches = trackSearches()
    const { user, location } = renderApp('/dashboard?q=pri&page=3')

    await screen.findByText('E000001')
    expect(searches.at(-1)).toBe('q=pri&page=3&per_page=25')

    await screen.findByRole('option', { name: 'India' })
    await user.selectOptions(screen.getByLabelText('Country'), 'India')
    await waitFor(() => expect(location()).toBe('/dashboard?q=pri&country=IN'))
    await user.selectOptions(screen.getByLabelText('Status'), 'All')
    await user.selectOptions(screen.getByLabelText('Type'), 'Intern')
    await waitFor(() => expect(searches.at(-1)).toBe('q=pri&country=IN&status=all&employment_type=intern&page=1&per_page=25'))

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(location()).toBe('/dashboard?q=pri&country=IN&status=all&type=intern&page=2'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled())
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })

  it('shows an empty result with a way to clear the filters', async () => {
    signInAs(hrMe)
    trackSearches((params) => employeesPage(params.get('q') ? [] : rows))
    const { user, location } = renderApp('/dashboard?q=zzz')

    expect(await screen.findByText('No employees match “zzz”.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByText('E000001')).toBeInTheDocument()
    expect(location()).toBe('/dashboard')
    expect(screen.getByLabelText('Search employees')).toHaveValue('')
  })

  it('offers a retry when the list fails to load', async () => {
    signInAs(hrMe)
    trackSearches()
    // Added last, so it answers first; `once` lets the retry reach trackSearches.
    server.use(http.get(`${API}/employees`, () => HttpResponse.json(apiError('internal', 'x'), { status: 500 }), { once: true }))
    const { user } = renderApp('/dashboard')

    await user.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('E000001')).toBeInTheDocument()
  })
})
