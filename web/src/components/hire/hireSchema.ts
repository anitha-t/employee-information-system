// New-hire form values, validation and the API payload (docs/web-design.md §4).
// Inputs hold strings; toHirePayload converts and drops empty optional values.
import { z } from 'zod'
import type { EmploymentType, PayFrequency } from '../../types/employee'
import type { HirePayload } from '../../types/employmentAction'
import type { Gender } from '../../types/me'

const optional = <T extends z.ZodType<string>>(schema: T) => z.union([z.literal(''), schema])
// { error } also covers undefined, which a disabled select submits.
const requiredId = (message: string) => z.string({ error: message }).min(1, message)

export const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

export const hireSchema = z.object({
  effectiveDate: z.iso.date('Enter a start date'),
  reason: z.string(),
  person: z.object({
    firstName: z.string().trim().min(1, 'Enter a first name'),
    lastName: z.string().trim(),
    preferredName: z.string().trim(),
    email: optional(z.email('Enter a valid email address')),
    phoneNumber: optional(z.string().regex(/^\+[1-9]\d{6,14}$/, 'Use international format, e.g. +919800000000')),
    dob: optional(z.iso.date('Enter a valid date')),
    gender: z.enum(['', 'female', 'male', 'non_binary', 'undisclosed']),
  }),
  employment: z.object({
    legalEntityId: requiredId('Choose a legal entity'),
    employmentType: z.enum(['full_time', 'part_time', 'contractor', 'intern']),
    noticePeriodDays: optional(z.string().regex(/^\d+$/, 'Enter a whole number of days')),
    workEmail: optional(z.email('Enter a valid email address')),
  }),
  assignment: z.object({
    positionId: requiredId('Choose a position'),
    gradeId: requiredId('Choose a grade'),
    reportsToEmploymentId: z.string(),
  }),
  compensation: z.object({
    amount: z.string({ error: 'Enter an annual salary' }).trim()
      .min(1, 'Enter an annual salary')
      .regex(AMOUNT_PATTERN, 'Enter an amount like 1850000 or 1850000.50')
      .refine((value) => Number(value) > 0, 'Enter an amount above zero'),
    payFrequency: z.enum(['monthly', 'semi_monthly', 'bi_weekly', 'weekly']),
  }),
})

export type HireValues = z.infer<typeof hireSchema>

export function emptyHire(today: string): HireValues {
  return {
    effectiveDate: today,
    reason: '',
    person: { firstName: '', lastName: '', preferredName: '', email: '', phoneNumber: '', dob: '', gender: '' },
    employment: { legalEntityId: '', employmentType: 'full_time', noticePeriodDays: '', workEmail: '' },
    assignment: { positionId: '', gradeId: '', reportsToEmploymentId: '' },
    compensation: { amount: '', payFrequency: 'monthly' },
  }
}

/** Every field path, for mapping server errors onto fields. */
export const HIRE_FIELDS = [
  'effectiveDate', 'reason',
  'person.firstName', 'person.lastName', 'person.preferredName', 'person.email', 'person.phoneNumber', 'person.dob', 'person.gender',
  'employment.legalEntityId', 'employment.employmentType', 'employment.noticePeriodDays', 'employment.workEmail',
  'assignment.positionId', 'assignment.gradeId', 'assignment.reportsToEmploymentId',
  'compensation.amount', 'compensation.payFrequency',
] as const

/** API error paths that name a field differently from the form. */
export const HIRE_ERROR_ALIASES: Record<string, string> = {
  'compensation.annualSalary': 'compensation.amount',
  'compensation.annualSalaryCents': 'compensation.amount',
  'employment.hireDate': 'effectiveDate',
  'assignment.reportsToEmployment': 'assignment.reportsToEmploymentId',
}

/** "1850000" → "1850000.00", "99.5" → "99.50", by string handling only (no float rounding). */
export function toDecimalString(amount: string): string {
  const [whole = '0', fraction = ''] = amount.trim().split('.')
  return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(2, '0')}`
}

const blankToUndefined =(value: string) => (value.trim() === '' ? undefined : value.trim())

/** Builds the POST /employment_actions body. `currency` is the legal entity's. */
export function toHirePayload(values: HireValues, currency: string): HirePayload {
  const { person, employment, assignment, compensation } = values
  return {
    actionType: 'hire',
    effectiveDate: values.effectiveDate,
    reason: blankToUndefined(values.reason),
    person: {
      firstName: person.firstName.trim(),
      lastName: blankToUndefined(person.lastName),
      preferredName: blankToUndefined(person.preferredName),
      email: blankToUndefined(person.email),
      phoneNumber: blankToUndefined(person.phoneNumber),
      dob: blankToUndefined(person.dob),
      gender: (person.gender || undefined) as Gender | undefined,
    },
    employment: {
      legalEntityId: employment.legalEntityId,
      employmentType: employment.employmentType as EmploymentType,
      noticePeriodDays: employment.noticePeriodDays ? Number(employment.noticePeriodDays) : undefined,
      workEmail: blankToUndefined(employment.workEmail),
    },
    assignment: {
      positionId: assignment.positionId,
      gradeId: assignment.gradeId,
      reportsToEmploymentId: blankToUndefined(assignment.reportsToEmploymentId),
    },
    compensation: {
      // A decimal string with two places, never a float.
      annualSalary: { amount: toDecimalString(compensation.amount), currency },
      payFrequency: compensation.payFrequency as PayFrequency,
    },
  }
}
