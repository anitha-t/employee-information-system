import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { HrTabs } from '../components/layout/HrTabs'
import { CountryStatsCards } from '../components/reports/CountryStatsCards'
import { JobSalaryTable } from '../components/reports/JobSalaryTable'
import { ReportFilters, type ReportFilterValues } from '../components/reports/ReportFilters'
import { SpendCards } from '../components/reports/SpendCards'
import { EmptyState, ErrorState } from '../components/ui/states'
import { useCountries } from '../hooks/useReferenceData'
import { useSalaryByJob, useSalarySpend, useSalaryStats } from '../hooks/useReports'
import { formatDate, todayIso } from '../lib/format'
import type { JobSalaryStats } from '../types/reports'

export const FIRST_REPORT_YEAR = 2016

// URL keys: /dashboard/reports?country=IN&as_of=2026-06-30&type=full_time&year=2025&job=engineer
const URL_KEYS: Record<keyof ReportFilterValues, string> = {
  country: 'country', asOf: 'as_of', employmentType: 'type', year: 'year', job: 'job',
}

/** /dashboard/reports (HR): salary reports per country (docs/web-design.md §6). */
export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const today = todayIso()
  const currentYear = Number(today.slice(0, 4))
  const values: ReportFilterValues = {
    country: searchParams.get(URL_KEYS.country) ?? '',
    asOf: searchParams.get(URL_KEYS.asOf) || today,
    employmentType: searchParams.get(URL_KEYS.employmentType) ?? '',
    year: searchParams.get(URL_KEYS.year) || String(currentYear),
    job: searchParams.get(URL_KEYS.job) ?? '',
  }
  const years = Array.from({ length: currentYear - FIRST_REPORT_YEAR + 1 }, (_, index) => currentYear - index)

  const statsFilters = { country: values.country || undefined, asOf: values.asOf, employmentType: values.employmentType || undefined }
  const countries = useCountries()
  const stats = useSalaryStats(statsFilters)
  const byJob = useSalaryByJob(statsFilters)
  const spend = useSalarySpend({ country: values.country || undefined, year: Number(values.year) })

  const countryName = useCallback(
    (isoCode: string) => countries.data?.find((country) => country.isoCode === isoCode)?.name ?? isoCode,
    [countries.data],
  )
  const onChange = (name: keyof ReportFilterValues, value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(URL_KEYS[name], value)
      else next.delete(URL_KEYS[name])
      return next
    }, { replace: name === 'job' })
  }

  const jobRows = filterJobs(byJob.data?.data ?? [], values.job)
  const jobCountries = [...new Set(jobRows.map((row) => row.country))]

  return (
    <div className="page">
      <HrTabs />
      <ReportFilters values={values} countries={countries.data ?? []} years={years} onChange={onChange} />
      <p className="muted small">Amounts are per country, in its own currency. They are never added across countries.</p>

      <section className="report" aria-labelledby="stats-heading">
        <h2 id="stats-heading">Salary by country <span className="muted">· as of {formatDate(values.asOf)}</span></h2>
        {stats.isPending ? <ReportSkeleton /> : stats.isError ? (
          <ErrorState message="We couldn't load salary statistics." onRetry={() => stats.refetch()} />
        ) : (
          <div className={stats.isPlaceholderData ? 'is-stale' : undefined}>
            <CountryStatsCards stats={stats.data.data} countryName={countryName} />
          </div>
        )}
      </section>

      <section className="report" aria-labelledby="jobs-heading">
        <h2 id="jobs-heading">Salary by job title <span className="muted">· as of {formatDate(values.asOf)}</span></h2>
        {byJob.isPending ? <ReportSkeleton /> : byJob.isError ? (
          <ErrorState message="We couldn't load salaries by job title." onRetry={() => byJob.refetch()} />
        ) : jobRows.length === 0 ? (
          <EmptyState>{values.job ? `No job titles match “${values.job}”.` : 'No one paid on this date.'}</EmptyState>
        ) : (
          <div className={byJob.isPlaceholderData ? 'is-stale' : undefined}>
            {jobCountries.map((code) => (
              <div key={code} className="report-group">
                <h3>{countryName(code)} <span className="muted">· {jobRows.find((row) => row.country === code)?.currency}</span></h3>
                <JobSalaryTable country={countryName(code)} rows={jobRows.filter((row) => row.country === code)} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="report" aria-labelledby="spend-heading">
        <h2 id="spend-heading">
          Salary spend · {values.year}{' '}
          {spend.data && !spend.isPlaceholderData && (
            <span className="muted">
              {spend.data.to
                ? `· ${formatDate(spend.data.from)} – ${formatDate(spend.data.to)}${spend.data.partial ? ', year to date' : ''}`
                : '· not started yet'}
            </span>
          )}
        </h2>
        {spend.isPending ? <ReportSkeleton /> : spend.isError ? (
          <ErrorState message="We couldn't load salary spend." onRetry={() => spend.refetch()} />
        ) : (
          <div className={spend.isPlaceholderData ? 'is-stale' : undefined}>
            <SpendCards year={spend.data.year} spend={spend.data.data} countryName={countryName} />
          </div>
        )}
      </section>
    </div>
  )
}

function filterJobs(rows: JobSalaryStats[], text: string) {
  const needle = text.trim().toLowerCase()
  return needle ? rows.filter((row) => row.jobTitle.toLowerCase().includes(needle)) : rows
}

function ReportSkeleton() {
  return (
    <div className="card-grid" aria-busy="true" aria-label="Loading report">
      {[0, 1, 2].map((index) => <div key={index} className="card skeleton-card"><span className="skeleton" /></div>)}
    </div>
  )
}
