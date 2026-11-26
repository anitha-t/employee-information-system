import { useCallback, useState } from 'react'
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

// Applied filters in the URL: /dashboard/reports?as_of=2026-06-30&country=IN&type=full_time&job=engineer.
// `as_of` is written on every Go, so its presence means "the reports have been run".
const URL_KEYS: Record<keyof ReportFilterValues, string> = { country: 'country', asOf: 'as_of', employmentType: 'type' }

/** /dashboard/reports (HR): salary reports per country, run on demand with Go (docs/web-design.md §6). */
export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const applied: ReportFilterValues | null = searchParams.get(URL_KEYS.asOf) ? {
    country: searchParams.get(URL_KEYS.country) ?? '',
    asOf: searchParams.get(URL_KEYS.asOf) ?? '',
    employmentType: searchParams.get(URL_KEYS.employmentType) ?? '',
  } : null
  const [draft, setDraft] = useState<ReportFilterValues>(() => applied ?? { country: '', asOf: todayIso(), employmentType: '' })
  const job = searchParams.get('job') ?? ''

  const statsFilters = {
    country: applied?.country || undefined, asOf: applied?.asOf, employmentType: applied?.employmentType || undefined,
  }
  const countries = useCountries()
  const stats = useSalaryStats(statsFilters, Boolean(applied))
  const byJob = useSalaryByJob(statsFilters, Boolean(applied))
  const spend = useSalarySpend({ country: applied?.country || undefined }, Boolean(applied))

  const countryName = useCallback(
    (isoCode: string) => countries.data?.find((country) => country.isoCode === isoCode)?.name ?? isoCode,
    [countries.data],
  )

  const go = () => {
    const sameAsApplied = applied && (Object.keys(URL_KEYS) as (keyof ReportFilterValues)[]).every((key) => applied[key] === draft[key])
    if (sameAsApplied) {
      // Same filters: Go means "refresh".
      void stats.refetch(); void byJob.refetch(); void spend.refetch()
      return
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      for (const [key, param] of Object.entries(URL_KEYS) as [keyof ReportFilterValues, string][]) {
        if (draft[key]) next.set(param, draft[key])
        else next.delete(param)
      }
      return next
    })
  }
  const onJobChange = (value: string) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    if (value) next.set('job', value)
    else next.delete('job')
    return next
  }, { replace: true })

  const jobRows = filterJobs(byJob.data?.data ?? [], job)
  const jobCountries = [...new Set(jobRows.map((row) => row.country))]

  return (
    <div className="page">
      <HrTabs />
      <ReportFilters draft={draft} countries={countries.data ?? []} onDraftChange={(name, value) => setDraft((current) => ({ ...current, [name]: value }))}
        onGo={go} loading={stats.isFetching || byJob.isFetching || spend.isFetching} job={job} onJobChange={onJobChange} />
      <p className="muted small">Amounts are per country, in its own currency. They are never added across countries.</p>

      {!applied ? (
        <EmptyState>Choose the filters and press Go to run the reports.</EmptyState>
      ) : (
        <>
          <section className="report" aria-labelledby="stats-heading">
            <h2 id="stats-heading">Salary by country <span className="muted">· as of {formatDate(applied.asOf)}</span></h2>
            {stats.isPending ? <ReportSkeleton /> : stats.isError ? (
              <ErrorState message="We couldn't load salary statistics." onRetry={() => stats.refetch()} />
            ) : (
              <div className={stats.isPlaceholderData ? 'is-stale' : undefined}>
                <CountryStatsCards stats={stats.data.data} countryName={countryName} />
              </div>
            )}
          </section>

          <section className="report" aria-labelledby="jobs-heading">
            <h2 id="jobs-heading">Salary by job title <span className="muted">· as of {formatDate(applied.asOf)}</span></h2>
            {byJob.isPending ? <ReportSkeleton /> : byJob.isError ? (
              <ErrorState message="We couldn't load salaries by job title." onRetry={() => byJob.refetch()} />
            ) : jobRows.length === 0 ? (
              <EmptyState>{job ? `No job titles match “${job}”.` : 'No one paid on this date.'}</EmptyState>
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
              Salary spend{spend.data ? ` · ${spend.data.year}` : ''}{' '}
              {spend.data?.to && (
                <span className="muted">· {formatDate(spend.data.from)} – {formatDate(spend.data.to)}{spend.data.partial ? ', year to date' : ''}</span>
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
        </>
      )}
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
