import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { niceTicks } from '../lib/chart'
import { formatMoneyCompact, formatMonth } from '../lib/format'
import { apiError, employeeMe, hrMe, salaryByJob, salarySpend, salaryStats } from '../test/fixtures'
import { renderApp } from '../test/render'
import { API, server, signInAs } from '../test/server'

let searches: Record<'salary_stats' | 'salary_by_job' | 'salary_spend', string[]>

beforeEach(() => {
  signInAs(hrMe)
  searches = { salary_stats: [], salary_by_job: [], salary_spend: [] }
  const answer = (name: keyof typeof searches, body: object) => http.get(`${API}/reports/${name}`, ({ request }) => {
    searches[name].push(new URL(request.url).searchParams.toString())
    return HttpResponse.json(body)
  })
  server.use(answer('salary_stats', salaryStats), answer('salary_by_job', salaryByJob), answer('salary_spend', salarySpend))
})

describe('HR dashboard tabs', () => {
  it('switches between Employees and Reports', async () => {
    const { user, location } = renderApp('/dashboard')

    const tabs = await screen.findByRole('navigation', { name: 'Dashboard' })
    expect(within(tabs).getAllByRole('link').map((link) => link.textContent)).toEqual(['Employees', 'Reports'])
    expect(within(tabs).getByRole('link', { name: 'Employees' })).toHaveAttribute('aria-current', 'page') // the default
    await user.click(within(tabs).getByRole('link', { name: 'Reports' }))

    expect(location()).toBe('/dashboard/reports')
    expect(await screen.findByText('Choose the filters and press Go to run the reports.')).toBeInTheDocument()
    // Each view renders its own tab bar, so look it up again.
    const reportsTabs = screen.getByRole('navigation', { name: 'Dashboard' })
    expect(within(reportsTabs).getByRole('link', { name: 'Reports' })).toHaveAttribute('aria-current', 'page')
    expect(within(reportsTabs).getByRole('link', { name: 'Employees' })).not.toHaveAttribute('aria-current')
  })

  it('is HR-only', async () => {
    signInAs(employeeMe)
    renderApp('/dashboard/reports')

    expect(await screen.findByRole('heading', { name: "You don't have access to this page" })).toBeInTheDocument()
  })
})

const RUN = '/dashboard/reports?as_of=2026-11-25'

describe('reports', () => {
  it('fetches nothing until Go, then runs all three reports once', async () => {
    const { user, location } = renderApp('/dashboard/reports')

    expect(await screen.findByText('Choose the filters and press Go to run the reports.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Spend year')).not.toBeInTheDocument()
    await screen.findByRole('option', { name: 'India' })
    await user.selectOptions(screen.getByLabelText('Country'), 'India')
    await user.selectOptions(screen.getByLabelText('Type'), 'Intern')
    fireEvent.change(screen.getByLabelText('As of'), { target: { value: '2025-06-30' } })
    expect(searches).toEqual({ salary_stats: [], salary_by_job: [], salary_spend: [] }) // editing filters costs nothing

    await user.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => expect(location()).toBe('/dashboard/reports?country=IN&as_of=2025-06-30&type=intern'))
    await screen.findByRole('region', { name: 'India salaries' })
    await waitFor(() => expect(searches.salary_spend).toEqual(['country=IN&breakdown=month']))
    expect(searches.salary_stats).toEqual(['country=IN&as_of=2025-06-30&employment_type=intern'])
    expect(searches.salary_by_job).toEqual(['country=IN&as_of=2025-06-30&employment_type=intern'])
    expect(screen.getByRole('heading', { name: /Salary by country · as of 30 Jun 2025/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go' })) // same filters: refresh
    await waitFor(() => expect(searches.salary_stats).toHaveLength(2))
  })

  it('runs straight away from a link that already has the filters', async () => {
    renderApp('/dashboard/reports?as_of=2025-06-30&country=IN')

    expect(await screen.findByRole('region', { name: 'India salaries' })).toBeInTheDocument()
    expect(screen.getByLabelText('Country')).toHaveValue('IN')
    expect(screen.getByLabelText('As of')).toHaveValue('2025-06-30')
  })

  it('shows salary statistics per country, in local currency', async () => {
    renderApp(RUN)

    const india = await screen.findByRole('region', { name: 'India salaries' })
    expect(india).toHaveTextContent(/Median salary.*₹14,34,500.*Average.*₹18,92,739.*Headcount.*5,702.*Lowest.*₹6,02,000.*Highest.*₹1,58,03,000/)
    expect(screen.getByRole('region', { name: 'Australia salaries' })).toHaveTextContent('No one paid on this date.')
    expect(screen.getByText(/never added across countries/)).toBeInTheDocument()
  })

  it('shows a job-title table per country and filters titles on the client', async () => {
    const { user, location } = renderApp(RUN)

    const indiaTable = await screen.findByRole('table', { name: 'Salary by job title in India' })
    expect(within(indiaTable).getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual(['Data Scientist', 'Software Engineer'])
    expect(within(indiaTable).getByRole('row', { name: /Software Engineer/ })).toHaveTextContent(/1,682.*₹6,04,000.*₹10,90,500.*₹11,31,384.*₹25,51,000/)
    expect(screen.getByRole('table', { name: 'Salary by job title in United States' })).toHaveTextContent('$102,800')

    await user.type(screen.getByLabelText('Job title'), 'data')
    await waitFor(() => expect(location()).toBe(`${RUN}&job=data`))
    expect(screen.queryByRole('table', { name: /United States/ })).not.toBeInTheDocument()
    expect(searches.salary_by_job).toHaveLength(1) // filtering doesn't refetch

    await user.clear(screen.getByLabelText('Job title'))
    await user.type(screen.getByLabelText('Job title'), 'zzz')
    expect(await screen.findByText('No job titles match “zzz”.')).toBeInTheDocument()
  })

  it('charts monthly spend with a hover and focus readout, and a table view', async () => {
    const { user } = renderApp(RUN)

    const india = await screen.findByRole('region', { name: 'India spend' })
    expect(india).toHaveTextContent(/₹164.2Cr total · 5,803 people paid/)
    expect(screen.getByRole('heading', { name: /Salary spend · 2026 · 1 Jan 2026 – 25 Nov 2026, year to date/ })).toBeInTheDocument()

    const january = within(india).getByRole('img', { name: 'Jan 2026: ₹82,13,96,195' })
    january.focus()
    expect(await within(india).findByRole('status')).toHaveTextContent('₹82,13,96,195Jan 2026')
    expect(within(india).queryByRole('img', { name: /Mar 2026/ })).not.toBeInTheDocument() // absent, not zero

    await user.click(within(india).getByRole('button', { name: 'Show table' }))
    expect(within(india).getByRole('table')).toHaveTextContent(/Jan 2026.*₹82,13,96,195.*Feb 2026.*₹74,66,83,430/)
    expect(screen.getByRole('region', { name: 'United States spend' })).toHaveTextContent('No salary paid in this period.')
  })

  it('shows an error with retry per report', async () => {
    server.use(http.get(`${API}/reports/salary_spend`, () => HttpResponse.json(apiError('internal', 'x'), { status: 500 }), { once: true }))
    const { user } = renderApp(RUN)

    expect(await screen.findByRole('region', { name: 'India salaries' })).toBeInTheDocument() // other reports still load
    await user.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('region', { name: 'India spend' })).toBeInTheDocument()
  })
})

describe('chart helpers', () => {
  it('picks round axis ticks', () => {
    expect(niceTicks(0)).toEqual([0])
    expect(niceTicks(821_396_194)).toEqual([0, 250_000_000, 500_000_000, 750_000_000, 1_000_000_000])
    expect(niceTicks(23_000_000)).toEqual([0, 10_000_000, 20_000_000, 30_000_000])
  })

  it('formats compact money and months', () => {
    expect(formatMoneyCompact({ amount: '9362369654.78', currency: 'INR' })).toBe('₹936.2Cr')
    expect(formatMoneyCompact({ amount: '352000000', currency: 'USD' })).toBe('$352M')
    expect(formatMoneyCompact({ amount: '225700000', currency: 'AUD' })).toBe('A$225.7M')
    expect(formatMoneyCompact(null)).toBe('—')
    expect(formatMonth('2026-04')).toBe('Apr')
    expect(formatMonth('2026-04', { year: true })).toBe('Apr 2026')
    expect(formatMonth('bad')).toBe('bad')
  })
})
