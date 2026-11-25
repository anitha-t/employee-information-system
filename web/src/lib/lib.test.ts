import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { toDecimalString } from '../components/hire/hireSchema'
import { formatDate, formatMoney, label } from './format'
import { applyServerErrors } from './formErrors'
import { safeNext } from './navigation'

describe('formatMoney', () => {
  it('groups each currency the way its country does', () => {
    expect(formatMoney({ amount: '1850000.00', currency: 'INR' })).toBe('₹18,50,000')
    expect(formatMoney({ amount: '185000.00', currency: 'USD' })).toBe('$185,000')
    expect(formatMoney({ amount: '95000.50', currency: 'AUD' }, { cents: true })).toBe('A$95,000.50')
    expect(formatMoney(null)).toBe('—')
  })
})

describe('formatDate and labels', () => {
  it('formats calendar dates without time-zone shifts', () => {
    expect(formatDate('2026-05-01')).toBe('1 May 2026')
    expect(formatDate(null)).toBe('—')
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })

  it('labels enum values and falls back to the raw value', () => {
    expect(label('status', 'on_notice')).toBe('On notice')
    expect(label('employmentType', 'apprentice')).toBe('apprentice')
    expect(label('gender', null)).toBe('—')
  })
})

describe('toDecimalString', () => {
  it('pads to two decimals without float rounding', () => {
    expect(toDecimalString('1850000')).toBe('1850000.00')
    expect(toDecimalString('99.5')).toBe('99.50')
    expect(toDecimalString('007.25')).toBe('7.25')
    expect(toDecimalString('90071992547409.99')).toBe('90071992547409.99')
  })
})

describe('safeNext', () => {
  it('allows only same-app paths', () => {
    expect(safeNext('/employees/new?x=1')).toBe('/employees/new?x=1')
    for (const bad of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example']) {
      expect(safeNext(bad)).toBe('/dashboard')
    }
  })
})

describe('applyServerErrors', () => {
  const fields = ['person.email', 'assignment.gradeId', 'compensation.amount'] as const

  it('maps API paths onto fields, including *Id and aliases, and returns the rest', () => {
    const setError = vi.fn()
    const error = new ApiError(422, { error: { code: 'validation_failed', message: 'Validation failed', details: {
      'person.email': ['has already been taken'],
      'assignment.grade': ['is outside the job grade range'],
      'compensation.annualSalaryCents': ['must be greater than 0'],
      'compensation.currency': ['must be INR'],
    } } })

    const rest = applyServerErrors(error, fields, setError, { 'compensation.annualSalaryCents': 'compensation.amount' })

    expect(setError.mock.calls.map(([field, { message }]) => [field, message])).toEqual([
      ['person.email', 'has already been taken'],
      ['assignment.gradeId', 'is outside the job grade range'],
      ['compensation.amount', 'must be greater than 0'],
    ])
    expect(setError.mock.calls[0]?.[2]).toEqual({ shouldFocus: true })
    expect(rest).toEqual(['Currency must be INR'])
  })

  it('maps indexed nested paths onto field-array fields', () => {
    const setError = vi.fn()
    const error = new ApiError(422, { error: { code: 'validation_failed', message: 'Validation failed', details: {
      'addresses[1].line1': ["can't be blank"], 'addresses[0].country': ['must exist'],
    } } })

    applyServerErrors(error, ['addresses.1.line1', 'addresses.0.countryId'], setError)

    expect(setError.mock.calls.map(([field]) => field)).toEqual(['addresses.1.line1', 'addresses.0.countryId'])
  })

  it('falls back to the error message or a generic one', () => {
    expect(applyServerErrors(new ApiError(409, { error: { code: 'conflict', message: 'Conflict' } }), fields, vi.fn())).toEqual(['Conflict'])
    expect(applyServerErrors(new TypeError('offline'), fields, vi.fn())).toEqual(['Something went wrong. Try again.'])
  })
})
