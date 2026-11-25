import type { Money } from '../types/api'

// Grouping that matches each currency's country: ₹18,50,000 / $185,000 / A$95,000.
const LOCALE_BY_CURRENCY: Record<string, string> = { INR: 'en-IN', USD: 'en-US', AUD: 'en-AU' }

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
} as const

/** Label for an enum value, falling back to the raw value. */
export function label<K extends keyof typeof LABELS>(kind: K, value: string | null | undefined): string {
  if (!value) return '—'
  return (LABELS[kind] as Record<string, string>)[value] ?? value
}
