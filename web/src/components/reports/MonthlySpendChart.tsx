import { useState } from 'react'
import { formatMoney, formatMoneyCompact, formatMonth } from '../../lib/format'
import { useElementWidth } from '../../hooks/useElementWidth'
import { niceTicks } from '../../lib/chart'
import type { Money } from '../../types/api'

interface Props {
  year: number
  currency: string
  /** Months with spend ("2026-01"…). Months after today are absent, not zero. */
  months: { month: string; spend: Money }[]
  title: string
}

// Drawn at the container's real pixel width, so marks and text keep their size.
const HEIGHT = 220
const MARGIN = { top: 12, right: 8, bottom: 28, left: 64 }
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom
const RADIUS = 4
const MAX_BAR = 24

/** A column with a 4px rounded top and a square base (on the baseline). */
function columnPath(x: number, y: number, width: number, height: number) {
  const r = Math.min(RADIUS, height, width / 2)
  const base = y + height
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${base} Z`
}

/** Report (c) for one country: monthly salary spend as columns, one hue, hover or focus for amounts. */
export function MonthlySpendChart({ year, currency, months, title }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const [container, width] = useElementWidth<HTMLDivElement>(640)
  const band = (width - MARGIN.left - MARGIN.right) / 12
  const bar = Math.min(MAX_BAR, band * 0.6)
  const byMonth = new Map(months.map((entry) => [Number(entry.month.slice(5, 7)) - 1, entry.spend]))
  const ticks = niceTicks(Math.max(0, ...months.map((entry) => Number(entry.spend.amount))))
  const top = ticks.at(-1) || 1
  const y = (amount: number) => MARGIN.top + PLOT_H - (amount / top) * PLOT_H
  const activeSpend = active === null ? undefined : byMonth.get(active)

  return (
    <div className="spend-chart" ref={container}>
      <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="group" aria-label={title} onPointerLeave={() => setActive(null)}>
        {ticks.map((tick) => (
          <g key={tick} aria-hidden="true">
            <line className={tick === 0 ? 'chart-baseline' : 'chart-grid'} x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
            <text className="chart-tick" x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
              {formatMoneyCompact({ amount: String(tick), currency })}
            </text>
          </g>
        ))}
        {Array.from({ length: 12 }, (_, index) => {
          const spend = byMonth.get(index)
          const bandX = MARGIN.left + index * band
          const amount = spend ? Number(spend.amount) : 0
          const label = `${formatMonth(`${year}-${String(index + 1).padStart(2, '0')}`, { year: true })}: ${spend ? formatMoney(spend) : 'no data'}`
          return (
            <g key={index}>
              <text className="chart-tick" x={bandX + band / 2} y={HEIGHT - 8} textAnchor="middle" aria-hidden="true">
                {formatMonth(`${year}-${String(index + 1).padStart(2, '0')}`)}
              </text>
              {spend && (
                <g tabIndex={0} role="img" aria-label={label} className={`chart-column${active === index ? ' is-active' : ''}`}
                  onPointerEnter={() => setActive(index)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
                  {/* The hit target is the whole band, bigger than the mark. */}
                  <rect className="chart-hit" x={bandX} y={MARGIN.top} width={band} height={PLOT_H} />
                  {amount > 0 && <path className="chart-bar" d={columnPath(bandX + (band - bar) / 2, y(amount), bar, y(0) - y(amount))} />}
                </g>
              )}
            </g>
          )
        })}
      </svg>
      {active !== null && activeSpend && (
        <div className="chart-tooltip" role="status"
          style={{ left: MARGIN.left + (active + 0.5) * band }}>
          <strong>{formatMoney(activeSpend)}</strong>
          <span>{formatMonth(`${year}-${String(active + 1).padStart(2, '0')}`, { year: true })}</span>
        </div>
      )}
    </div>
  )
}
