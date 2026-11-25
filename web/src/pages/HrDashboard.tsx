import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EmployeeFilters, type EmployeeFilterValues } from '../components/employees/EmployeeFilters'
import { EmployeeSearchBar } from '../components/employees/EmployeeSearchBar'
import { EmployeeTable, EmployeeTableSkeleton } from '../components/employees/EmployeeTable'
import { Button } from '../components/ui/Button'
import { Pagination } from '../components/ui/Pagination'
import { EmptyState, ErrorState } from '../components/ui/states'
import { useEmployees } from '../hooks/useEmployees'
import { useCountries } from '../hooks/useReferenceData'
import type { Me } from '../types/me'

export const PER_PAGE = 25

// URL keys for each filter: /dashboard?q=pri&country=IN&status=all&type=intern&page=2
const URL_KEYS = { country: 'country', status: 'status', employmentType: 'type' } as const

/** HR home: employee search and the "New hire" button. Search state lives in the URL. */
export function HrDashboard({ me }: { me: Me }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const filters: EmployeeFilterValues = {
    country: searchParams.get(URL_KEYS.country) ?? '',
    status: searchParams.get(URL_KEYS.status) ?? '',
    employmentType: searchParams.get(URL_KEYS.employmentType) ?? '',
  }
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const countries = useCountries()
  const employees = useEmployees({ q, ...filters, page, perPage: PER_PAGE })

  // Any change except paging goes back to page 1. Typing replaces history; the rest pushes.
  const update = useCallback((changes: Record<string, string>, replace = false) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      if (!('page' in changes)) next.delete('page')
      return next
    }, { replace })
  }, [setSearchParams])

  const onSearch = useCallback((value: string) => update({ q: value }, true), [update])
  const hasFilters = Boolean(q || filters.country || filters.status || filters.employmentType)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="muted">Welcome back, {me.person.displayName}</p>
          <h1>Employees</h1>
        </div>
        <Link to="/employees/new" className="btn btn-primary">+ New hire</Link>
      </div>

      <div className="toolbar">
        <EmployeeSearchBar value={q} onSearch={onSearch} />
        <EmployeeFilters values={filters} countries={countries.data ?? []}
          onChange={(name, value) => update({ [URL_KEYS[name]]: value })} />
      </div>

      {employees.isPending ? (
        <EmployeeTableSkeleton />
      ) : employees.isError ? (
        <ErrorState message="We couldn't load employees." onRetry={() => employees.refetch()} />
      ) : employees.data.data.length === 0 ? (
        <EmptyState action={hasFilters && <Button variant="secondary" onClick={() => setSearchParams({})}>Clear filters</Button>}>
          {q ? `No employees match “${q}”.` : 'No employees match these filters.'}
        </EmptyState>
      ) : (
        <>
          <EmployeeTable employees={employees.data.data} stale={employees.isPlaceholderData} />
          <Pagination page={employees.data.meta.page} perPage={employees.data.meta.perPage}
            totalCount={employees.data.meta.totalCount} onPageChange={(next) => update({ page: String(next) })} />
        </>
      )}
    </div>
  )
}
