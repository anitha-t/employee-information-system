import { CountryStatsCards } from '../../components/reports/CountryStatsCards'
import { AsOfFilter, TypeFilter } from '../../components/reports/filterControls'
import { NotRunYet, ReportSection } from '../../components/reports/ReportSection'
import { ErrorState } from '../../components/ui/states'
import { useReportFilters } from '../../hooks/useReportFilters'
import { useSalaryStats } from '../../hooks/useReports'
import { formatDate, todayIso } from '../../lib/format'
import { ReportSkeleton } from './ReportSkeleton'

/** (a) Min, max, average and median salary for every country. No country filter: the countries sit side by side. */
export function StatsReport({ countryName }: { countryName: (isoCode: string) => string }) {
  const { applied, draft, setField, apply } = useReportFilters(
    { asOf: 'stats_as_of', employmentType: 'stats_type' }, { asOf: todayIso(), employmentType: '' })
  const report = useSalaryStats({ asOf: applied?.asOf, employmentType: applied?.employmentType || undefined }, Boolean(applied))

  return (
    <ReportSection
      title="Salary by country"
      subtitle={applied && `as of ${formatDate(applied.asOf)}`}
      filters={<>
        <AsOfFilter value={draft.asOf} onChange={(value) => setField('asOf', value)} />
        <TypeFilter value={draft.employmentType} onChange={(value) => setField('employmentType', value)} />
      </>}
      onGo={() => { if (!apply()) void report.refetch() }}
      loading={report.isFetching}
    >
      {!applied ? <NotRunYet /> : report.isPending ? <ReportSkeleton /> : report.isError ? (
        <ErrorState message="We couldn't load salary statistics." onRetry={() => report.refetch()} />
      ) : (
        <div className={report.isPlaceholderData ? 'is-stale' : undefined}>
          <CountryStatsCards stats={report.data.data} countryName={countryName} />
        </div>
      )}
    </ReportSection>
  )
}
