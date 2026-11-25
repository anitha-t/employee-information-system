import { formatMoney } from '../../lib/format'
import type { JobSalaryStats } from '../../types/reports'

interface Props {
  country: string
  rows: JobSalaryStats[]
}

const value = (money: JobSalaryStats['min']) => (money ? Number(money.amount) : 0)

/** Report (b) for one country: a row per job title, with a min–max range bar on a shared country scale. */
export function JobSalaryTable({ country, rows }: Props) {
  const low = Math.min(...rows.map((row) => value(row.min)))
  const high = Math.max(...rows.map((row) => value(row.max)))
  const position = (amount: number) => (high > low ? ((amount - low) / (high - low)) * 100 : 50)

  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">Salary by job title in {country}</caption>
        <thead>
          <tr>
            <th scope="col">Job title</th>
            <th scope="col" className="numeric">Headcount</th>
            <th scope="col" className="numeric">Lowest</th>
            <th scope="col" className="numeric">Median</th>
            <th scope="col" className="numeric">Average</th>
            <th scope="col" className="numeric">Highest</th>
            <th scope="col" className="range-col"><span className="visually-hidden">Range</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const start = position(value(row.min))
            const end = position(value(row.max))
            return (
              <tr key={row.jobTitle}>
                <th scope="row">{row.jobTitle}</th>
                <td className="numeric">{new Intl.NumberFormat('en').format(row.headcount)}</td>
                <td className="numeric">{formatMoney(row.min)}</td>
                <td className="numeric">{formatMoney(row.median)}</td>
                <td className="numeric">{formatMoney(row.average)}</td>
                <td className="numeric">{formatMoney(row.max)}</td>
                <td className="range-col" aria-hidden="true">
                  <div className="range-bar">
                    <span className="range-fill" style={{ left: `${start}%`, width: `${Math.max(end - start, 0.5)}%` }} />
                    <span className="range-median" style={{ left: `${position(value(row.median))}%` }} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
