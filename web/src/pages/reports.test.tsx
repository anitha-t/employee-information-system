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

const section = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) })
const go = (name: string) => within(section(name)).getByRole('button', { name: 'Go' })

describe('HR dashboard tabs', () => {
  it('puts Reports on the right, with Employees as the default', async () => {
    const { user, location } = renderApp('/dashboard')

    const tabs = await screen.findByRole('navigation', { name: 'Dashboard' })
    expect(within(tabs).getAllByRole('link').map((link) => link.textContent)).toEqual(['Employees', 'Reports'])
    expect(within(tabs).getByRole('link', { name: 'Employees' })).toHaveAttribute('aria-current', 'page')
    await user.click(within(tabs).getByRole('link', { name: 'Reports' }))

    expect(location()).toBe('/dashboard/reports')
    expect(await screen.findAllByText('Choose the filters and press Go.')).toHaveLength(3)
  })

  it('is HR-only', async () => {
    signInAs(employeeMe)
    renderApp('/dashboard/reports')

    expect(await screen.findByRole('heading', { name: "You don't have access to this page" })).toBeInTheDocument()
  })
})

describe('reports', () => {
  it('gives each report its own filters and fetches nothing until its Go', async () => {
    renderApp('/dashboard/reports')

    await screen.findAllByText('Choose the filters and press Go.')
    const filters = (name: string) => within(within(section(name)).getByRole('form')).getAllByRole('combobox', { hidden: true })
      .map((control) => control.closest('label')?.firstChild?.textContent)
    expect(filters('Salary by country')).toEqual(['Type']) // + As of; no country filter
    expect(within(section('Salary by country')).queryByLabelText('Country')).not.toBeInTheDocument()
    expect(filters('Salary by job title')).toEqual(['Job title', 'Type'])
    expect(filters('Salary spend')).toEqual(['Year', 'Country'])
    expect(searches).toEqual({ salary_stats: [], salary_by_job: [], salary_spend: [] })
  })

  it('runs salary by country on its own, with as-of and type', async () => {
    const { user, location } = renderApp('/dashboard/reports')

    await screen.findAllByText('Choose the filters and press Go.')
    fireEvent.change(within(section('Salary by country')).getByLabelText('As of'), { target: { value: '2025-06-30' } })
    await user.selectOptions(within(section('Salary by country')).getByLabelText('Type'), 'Full time')
    await user.click(go('Salary by country'))

    const india = await screen.findByRole('region', { name: 'India salaries' })
    expect(india).toHaveTextContent(/Median salary.*₹14,34,500.*Average.*₹18,92,739.*Headcount.*5,702.*Lowest.*₹6,02,000.*Highest.*₹1,58,03,000/)
    expect(screen.getByRole('region', { name: 'Australia salaries' })).toHaveTextContent('No one paid on this date.')
    expect(location()).toBe('/dashboard/reports?stats_as_of=2025-06-30&stats_type=full_time')
    expect(searches).toEqual({ salary_stats: ['as_of=2025-06-30&employment_type=full_time'], salary_by_job: [], salary_spend: [] })
    expect(screen.getByRole('heading', { name: 'Salary by country · as of 30 Jun 2025' })).toBeInTheDocument()

    await user.click(go('Salary by country')) // same filters: refresh
    await waitFor(() => expect(searches.salary_stats).toHaveLength(2))
  })

  it('filters salary by job title on the server, with a list of real titles', async () => {
    const { user, location } = renderApp('/dashboard/reports')

    await screen.findAllByText('Choose the filters and press Go.')
    const title = await within(section('Salary by job title')).findByLabelText('Job title')
    await within(title).findByRole('option', { name: 'Software Engineer' })
    await user.selectOptions(title, 'Software Engineer')
    await user.click(go('Salary by job title'))

    await waitFor(() => expect(searches.salary_by_job).toHaveLength(1))
    expect(searches.salary_by_job[0]).toMatch(/^as_of=\d{4}-\d{2}-\d{2}&job_title=Software\+Engineer$/)
    expect(location()).toMatch(/jobs_as_of=.*&jobs_title=Software\+Engineer/)
    const indiaTable = await screen.findByRole('table', { name: 'Salary by job title in India' })
    expect(within(indiaTable).getByRole('row', { name: /Software Engineer/ })).toHaveTextContent(/1,682.*₹6,04,000.*₹10,90,500.*₹11,31,384.*₹25,51,000/)
    expect(screen.getByRole('table', { name: 'Salary by job title in United States' })).toHaveTextContent('$102,800')
    expect(within(section('Salary by job title')).getByRole('heading', { level: 2 })).toHaveTextContent('Software Engineer, as of')
  })

  it('says when no one has the chosen title', async () => {
    server.use(http.get(`${API}/reports/salary_by_job`, () => HttpResponse.json({ as_of: '2026-11-25', data: [] })))
    renderApp('/dashboard/reports?jobs_as_of=2026-11-25&jobs_title=Director')

    expect(await screen.findByText('No one with the title “Director” was paid on this date.')).toBeInTheDocument()
  })

  it('charts spend for the chosen year and country, with hover readout and table view', async () => {
    const { user, location } = renderApp('/dashboard/reports')

    await screen.findAllByText('Choose the filters and press Go.')
    await within(section('Salary spend')).findByRole('option', { name: 'India' })
    await user.selectOptions(within(section('Salary spend')).getByLabelText('Year'), '2024')
    await user.selectOptions(within(section('Salary spend')).getByLabelText('Country'), 'India')
    await user.click(go('Salary spend'))

    await waitFor(() => expect(searches.salary_spend).toEqual(['year=2024&country=IN&breakdown=month']))
    expect(location()).toBe('/dashboard/reports?spend_year=2024&spend_country=IN')
    const india = await screen.findByRole('region', { name: 'India spend' })
    expect(india).toHaveTextContent(/₹164.2Cr total · 5,803 people paid/)
    expect(within(section('Salary spend')).getByRole('heading', { level: 2 })).toHaveTextContent('2024 (1 Jan 2026 – 25 Nov 2026, year to date)')

    const january = within(india).getByRole('img', { name: 'Jan 2026: ₹82,13,96,195' })
    january.focus()
    expect(await within(india).findByRole('status')).toHaveTextContent('₹82,13,96,195Jan 2026')
    expect(within(india).queryByRole('img', { name: /Mar 2026/ })).not.toBeInTheDocument() // absent, not zero
    await user.click(within(india).getByRole('button', { name: 'Show table' }))
    expect(within(india).getByRole('table')).toHaveTextContent(/Jan 2026.*₹82,13,96,195.*Feb 2026.*₹74,66,83,430/)
    expect(screen.getByRole('region', { name: 'United States spend' })).toHaveTextContent('No salary paid in this period.')
  })

  it('reruns from a link, and shows an error with retry per report', async () => {
    server.use(http.get(`${API}/reports/salary_spend`, () => HttpResponse.json(apiError('internal', 'x'), { status: 500 }), { once: true }))
    const { user } = renderApp('/dashboard/reports?stats_as_of=2025-06-30&spend_year=2025')

    expect(await screen.findByRole('region', { name: 'India salaries' })).toBeInTheDocument()
    expect(within(section('Salary by country')).getByLabelText('As of')).toHaveValue('2025-06-30')
    expect(within(section('Salary by job title')).getByText('Choose the filters and press Go.')).toBeInTheDocument()
    await user.click(await within(section('Salary spend')).findByRole('button', { name: 'Retry' }))
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
