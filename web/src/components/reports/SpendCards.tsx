import { useState } from 'react'
import { formatMoney, formatMoneyCompact, formatMonth } from '../../lib/format'
import type { CountrySpend } from '../../types/reports'
import { Button } from '../ui/Button'
import { MonthlySpendChart } from './MonthlySpendChart'

interface Props {
  year: number
  spend: CountrySpend[]
  countryName: (isoCode: string) => string
}

/** Report (c): one card per country with its total and a monthly chart (or table). */
export function SpendCards({ year, spend, countryName }: Props) {
  return (
    <div className="spend-cards">
      {spend.map((row) => <SpendCard key={row.country} year={year} row={row} name={countryName(row.country)} />)}
    </div>
  )
}

function SpendCard({ year, row, name }: { year: number; row: CountrySpend; name: string }) {
  const [asTable, setAsTable] = useState(false)
  const months = row.breakdown ?? []

  return (
    <section className="card" aria-label={`${name} spend`}>
      <header className="card-header">
        <h3>{name} <span className="muted">· {row.currency}</span></h3>
        {months.length > 0 && (
          <Button variant="ghost" onClick={() => setAsTable((value) => !value)}>{asTable ? 'Show chart' : 'Show table'}</Button>
        )}
      </header>
      <div className="card-body">
        <p className="stat-headline">
          <strong title={formatMoney(row.totalSpend, { cents: true })}>{formatMoneyCompact(row.totalSpend)}</strong>
          <span className="muted"> total · {new Intl.NumberFormat('en').format(row.employeeCount)} people paid</span>
        </p>
        {months.length === 0 ? <p className="muted">No salary paid in this period.</p> : asTable ? (
          <table className="table compact-table">
            <caption className="visually-hidden">{name} monthly salary spend, {year}</caption>
            <thead><tr><th scope="col">Month</th><th scope="col" className="numeric">Spend</th></tr></thead>
            <tbody>
              {months.map((entry) => (
                <tr key={entry.month}>
                  <th scope="row">{formatMonth(entry.month, { year: true })}</th>
                  <td className="numeric">{formatMoney(entry.spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <MonthlySpendChart year={year} currency={row.currency} months={months} title={`${name} monthly salary spend, ${year}`} />
        )}
      </div>
    </section>
  )
}
