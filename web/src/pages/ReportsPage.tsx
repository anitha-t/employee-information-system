import { useCallback } from 'react'
import { HrTabs } from '../components/layout/HrTabs'
import { useCountries } from '../hooks/useReferenceData'
import { JobsReport } from './reports/JobsReport'
import { SpendReport } from './reports/SpendReport'
import { StatsReport } from './reports/StatsReport'

/**
 * /dashboard/reports (HR): three salary reports, each with its own filters and
 * Go button, run only on demand (docs/web-design.md §6).
 */
export function ReportsPage() {
  const countries = useCountries()
  const countryName = useCallback(
    (isoCode: string) => countries.data?.find((country) => country.isoCode === isoCode)?.name ?? isoCode,
    [countries.data],
  )

  return (
    <div className="page">
      <HrTabs />
      <p className="muted small">Amounts are per country, in its own currency. They are never added across countries.</p>
      <StatsReport countryName={countryName} />
      <JobsReport countryName={countryName} />
      <SpendReport countries={countries.data ?? []} countryName={countryName} />
    </div>
  )
}
