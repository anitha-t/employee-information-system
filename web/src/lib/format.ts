import type { Money } from '../types/api'

// Grouping that matches each currency's country: ₹18,50,000 / $185,000 / A$95,000.
// AUD uses en-US so it prints "A$": US and Australian amounts share screens and must not both read "$".
const LOCALE_BY_CURRENCY: Record<string, string> = { INR: 'en-IN', USD: 'en-US', AUD: 'en-US' }

/** Formats API money for display. The amount string becomes a number only here. */
export function formatMoney(money: Money | null | undefined, options: { cents?: boolean } = {}): string {
  if (!money) return '—'
  const digits = options.cents ? 2 : 0
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[money.currency] ?? 'en', {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(money.amount))
}

/** Short money for tiles and chart axes, in the currency's own style: ₹936.2Cr, $1.2B, A$95M. */
export function formatMoneyCompact(money: Money | null | undefined): string {
  if (!money) return '—'
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[money.currency] ?? 'en', {
    style: 'currency', currency: money.currency, notation: 'compact', maximumFractionDigits: 1,
  }).format(Number(money.amount))
}

/** "2026-04" → "Apr" (or "Apr 2026" with `year`). */
export function formatMonth(yearMonth: string, options: { year?: boolean } = {}): string {
  const [year, month] = yearMonth.split('-').map(Number)
  if (!year || !month) return yearMonth
  return new Intl.DateTimeFormat('en-GB', { month: 'short', ...(options.year ? { year: 'numeric' } : {}), timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
}

/** "2026-05-01" → "1 May 2026". Dates are parsed as calendar dates, not instants. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}

/** Today in the browser's time zone, as YYYY-MM-DD. */
export function todayIso(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const LABELS = {
  status: { active: 'Active', on_notice: 'On notice', separated: 'Separated' },
  employmentType: { full_time: 'Full time', part_time: 'Part time', contractor: 'Contractor', intern: 'Intern' },
  gender: { female: 'Female', male: 'Male', non_binary: 'Non-binary', undisclosed: 'Prefer not to say' },
  payFrequency: { monthly: 'Monthly', semi_monthly: 'Twice a month', bi_weekly: 'Every two weeks', weekly: 'Weekly' },
  addressType: { home: 'Home', mailing: 'Mailing', registered: 'Registered' },
  role: { hr: 'HR', employee: 'Employee' },
  separationType: {
    voluntary: 'Voluntary', involuntary: 'Involuntary', retirement: 'Retirement', end_of_contract: 'End of contract', other: 'Other',
  },
} as const

/** Label for an enum value, falling back to the raw value. */
export function label<K extends keyof typeof LABELS>(kind: K, value: string | null | undefined): string {
  if (!value) return '—'
  return (LABELS[kind] as Record<string, string>)[value] ?? value
}
