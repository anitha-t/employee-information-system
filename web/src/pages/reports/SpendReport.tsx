import { SelectFilter } from '../../components/reports/filterControls'
import { NotRunYet, ReportSection } from '../../components/reports/ReportSection'
import { SpendCards } from '../../components/reports/SpendCards'
import { ErrorState } from '../../components/ui/states'
import { useReportFilters } from '../../hooks/useReportFilters'
import { useSalarySpend } from '../../hooks/useReports'
import { formatDate, todayIso } from '../../lib/format'
import type { Country } from '../../types/reference'
import { ReportSkeleton } from './ReportSkeleton'

/** The first year with seeded salaries; the API accepts 2000–2100. */
export const FIRST_SPEND_YEAR = 2016

/** (c) Total salary spend in a calendar year, per country, with a monthly chart. Its own year and country filters. */
export function SpendReport({ countries, countryName }: { countries: Country[]; countryName: (isoCode: string) => string }) {
  const currentYear = Number(todayIso().slice(0, 4))
  const years = Array.from({ length: currentYear - FIRST_SPEND_YEAR + 1 }, (_, index) => String(currentYear - index))
  const { applied, draft, setField, apply } = useReportFilters(
    { year: 'spend_year', country: 'spend_country' }, { year: String(currentYear), country: '' })
  const report = useSalarySpend({ year: applied ? Number(applied.year) : undefined, country: applied?.country || undefined }, Boolean(applied))
  const period = report.data?.to
    ? `${formatDate(report.data.from)} – ${formatDate(report.data.to)}${report.data.partial ? ', year to date' : ''}`
    : report.data && 'not started yet'

  return (
    <ReportSection
      title="Salary spend"
      subtitle={applied && `${applied.year}${period && !report.isPlaceholderData ? ` (${period})` : ''}`}
      filters={<>
        <SelectFilter label="Year" options={years.map((year) => ({ value: year, label: year }))} value={draft.year}
          onChange={(value) => setField('year', value)} />
        <SelectFilter label="Country" allLabel="All countries" value={draft.country} onChange={(value) => setField('country', value)}
          options={countries.map((country) => ({ value: country.isoCode, label: country.name }))} />
      </>}
      onGo={() => { if (!apply()) void report.refetch() }}
      loading={report.isFetching}
    >
      {!applied ? <NotRunYet /> : report.isPending ? <ReportSkeleton /> : report.isError ? (
        <ErrorState message="We couldn't load salary spend." onRetry={() => report.refetch()} />
      ) : (
        <div className={report.isPlaceholderData ? 'is-stale' : undefined}>
          <SpendCards year={report.data.year} spend={report.data.data} countryName={countryName} />
        </div>
      )}
    </ReportSection>
  )
}
