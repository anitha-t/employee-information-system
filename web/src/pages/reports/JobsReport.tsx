import { JobSalaryTable } from '../../components/reports/JobSalaryTable'
import { AsOfFilter, SelectFilter, TypeFilter } from '../../components/reports/filterControls'
import { NotRunYet, ReportSection } from '../../components/reports/ReportSection'
import { EmptyState, ErrorState } from '../../components/ui/states'
import { useReportFilters } from '../../hooks/useReportFilters'
import { useJobs } from '../../hooks/useReferenceData'
import { useSalaryByJob } from '../../hooks/useReports'
import { formatDate, todayIso } from '../../lib/format'
import { ReportSkeleton } from './ReportSkeleton'

/** (b) The same statistics per job title, one table per country. Filtered by job title on the server. */
export function JobsReport({ countryName }: { countryName: (isoCode: string) => string }) {
  const { applied, draft, setField, apply } = useReportFilters(
    { asOf: 'jobs_as_of', employmentType: 'jobs_type', jobTitle: 'jobs_title' }, { asOf: todayIso(), employmentType: '', jobTitle: '' })
  const jobs = useJobs()
  const titles = [...new Set((jobs.data ?? []).map((job) => job.title))].sort().map((title) => ({ value: title, label: title }))
  const report = useSalaryByJob({
    asOf: applied?.asOf, employmentType: applied?.employmentType || undefined, jobTitle: applied?.jobTitle || undefined,
  }, Boolean(applied))
  const rows = report.data?.data ?? []
  const countries = [...new Set(rows.map((row) => row.country))]

  return (
    <ReportSection
      title="Salary by job title"
      subtitle={applied && `${applied.jobTitle || 'all job titles'}, as of ${formatDate(applied.asOf)}`}
      filters={<>
        <SelectFilter label="Job title" allLabel="All job titles" options={titles} value={draft.jobTitle}
          onChange={(value) => setField('jobTitle', value)} />
        <AsOfFilter value={draft.asOf} onChange={(value) => setField('asOf', value)} />
        <TypeFilter value={draft.employmentType} onChange={(value) => setField('employmentType', value)} />
      </>}
      onGo={() => { if (!apply()) void report.refetch() }}
      loading={report.isFetching}
    >
      {!applied ? <NotRunYet /> : report.isPending ? <ReportSkeleton /> : report.isError ? (
        <ErrorState message="We couldn't load salaries by job title." onRetry={() => report.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState>No one with {applied.jobTitle ? `the title “${applied.jobTitle}”` : 'a job title'} was paid on this date.</EmptyState>
      ) : (
        <div className={report.isPlaceholderData ? 'is-stale' : undefined}>
          {countries.map((code) => (
            <div key={code} className="report-group">
              <h3>{countryName(code)} <span className="muted">· {rows.find((row) => row.country === code)?.currency}</span></h3>
              <JobSalaryTable country={countryName(code)} rows={rows.filter((row) => row.country === code)} />
            </div>
          ))}
        </div>
      )}
    </ReportSection>
  )
}
