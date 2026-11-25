import { formatMoney } from '../../lib/format'
import type { SalaryStats } from '../../types/reports'

interface Props {
  stats: SalaryStats[]
  countryName: (isoCode: string) => string
}

/** Report (a): one card of stat tiles per country, in that country's currency. */
export function CountryStatsCards({ stats, countryName }: Props) {
  return (
    <div className="card-grid">
      {stats.map((row) => (
        <section key={row.country} className="card stat-card" aria-label={`${countryName(row.country)} salaries`}>
          <header className="card-header">
            <h3>{countryName(row.country)} <span className="muted">· {row.currency}</span></h3>
          </header>
          <div className="card-body">
            {row.headcount === 0 ? <p className="muted">No one paid on this date.</p> : (
              <dl className="stat-tiles">
                <div className="stat-lead">
                  <dt>Median salary</dt>
                  <dd>{formatMoney(row.median)}</dd>
                </div>
                <div><dt>Average</dt><dd>{formatMoney(row.average)}</dd></div>
                <div><dt>Headcount</dt><dd>{new Intl.NumberFormat('en').format(row.headcount)}</dd></div>
                <div><dt>Lowest</dt><dd>{formatMoney(row.min)}</dd></div>
                <div><dt>Highest</dt><dd>{formatMoney(row.max)}</dd></div>
              </dl>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
