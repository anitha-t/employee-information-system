import { describe, expect, it } from 'vitest'
import { toCamel } from '../../api/client'
import { employeeDetail, history as apiHistory } from '../../test/fixtures'
import type { EmployeeDetail } from '../../types/employee'
import type { EmploymentActionDetail } from '../../types/employmentAction'
import { changeSchema, initialChangeValues, minimumDate, percentChange, toChangePayload, type ChangeContext } from './changeSchema'
import { describeHistory, latestRowDates } from './history'

const current = toCamel(employeeDetail()) as EmployeeDetail
const actions = (toCamel(apiHistory) as { data: EmploymentActionDetail[] }).data
const context = (type: ChangeContext['type']): ChangeContext => ({ type, current, ...latestRowDates(actions) })
const values = (changes: { positionId?: string; gradeId?: string; reportsToEmploymentId?: string; amount?: string; effectiveDate?: string } = {}) => {
  const base = initialChangeValues(current, changes.effectiveDate ?? '2026-04-01')
  return {
    ...base,
    assignment: { ...base.assignment, ...Object.fromEntries(Object.entries(changes).filter(([key]) => key in base.assignment)) },
    compensation: { amount: changes.amount ?? '' },
  }
}
const issues = (type: ChangeContext['type'], input: ReturnType<typeof values>) =>
  changeSchema(context(type)).safeParse(input).error?.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) ?? []

describe('change rules', () => {
  it('requires a new salary for an increment', () => {
    expect(issues('salary_change', values())).toEqual(['compensation.amount: Enter the new annual salary'])
    expect(issues('salary_change', values({ amount: '1850000' }))).toEqual(['compensation.amount: This is the current salary'])
    expect(issues('salary_change', values({ amount: '2000000' }))).toEqual([])
  })

  it('requires a promotion to change the grade or position', () => {
    expect(issues('promotion', values())).toEqual(['assignment.gradeId: Change the grade or the position'])
    expect(issues('promotion', values({ gradeId: 'g3' }))).toEqual([])
  })

  it('requires a transfer to a different position', () => {
    expect(issues('transfer', values())).toEqual(['assignment.positionId: Choose a different position'])
    expect(issues('transfer', values({ positionId: 'pos-other', gradeId: '' }))).toEqual(['assignment.gradeId: Choose a grade'])
  })

  it('dates changes after the latest change of the same kind', () => {
    expect(latestRowDates(actions)).toEqual({ latestAssignment: '2025-04-01', latestCompensation: '2025-04-01' })
    const early = values({ gradeId: 'g3', effectiveDate: '2025-04-01' })
    expect(issues('promotion', early)).toEqual(['effectiveDate: Must be after 1 Apr 2025 (last role change)'])
    expect(issues('promotion', { ...early, compensation: { amount: '2000000' } })).toEqual(['effectiveDate: Must be after 1 Apr 2025 (last change)'])
    expect(minimumDate({ ...context('salary_change'), latestCompensation: '2024-04-01' }, true)).toEqual({ date: '2024-04-01', what: 'last pay change' })
    expect(minimumDate({ ...context('promotion'), latestCompensation: '2024-04-01' }, false)).toEqual({ date: '2025-04-01', what: 'last role change' })
  })
})

describe('toChangePayload', () => {
  it('sends only what changed', () => {
    expect(toChangePayload({ ...values({ amount: '2000000' }), reason: ' FY26 ' }, context('salary_change'))).toEqual({
      actionType: 'salary_change', employmentId: 'emp-1', effectiveDate: '2026-04-01', reason: 'FY26',
      compensation: { annualSalary: { amount: '2000000.00', currency: 'INR' } },
    })
    expect(toChangePayload(values({ gradeId: 'g3' }), context('promotion'))).toEqual({
      actionType: 'promotion', employmentId: 'emp-1', effectiveDate: '2026-04-01', assignment: { gradeId: 'g3' },
    })
    expect(toChangePayload(values({ positionId: 'pos-pay', reportsToEmploymentId: 'mgr-2' }), context('transfer'))).toEqual({
      actionType: 'transfer', employmentId: 'emp-1', effectiveDate: '2026-04-01',
      assignment: { positionId: 'pos-pay', reportsToEmploymentId: 'mgr-2' },
    })
  })

  it('works out percentage changes', () => {
    expect(percentChange('1296000.00', '1500000')).toBe('+15.7%')
    expect(percentChange('1000', '900')).toBe('-10.0%')
    expect(percentChange(undefined, '900')).toBeNull()
    expect(percentChange('1000', '')).toBeNull()
  })
})

describe('describeHistory', () => {
  it('compares each row with the previous row of its kind', () => {
    expect(describeHistory(actions).map(({ title, changes }) => [title, changes])).toEqual([
      ['Promotion', ['Grade G1 → G2', 'Salary ₹12,96,000 → ₹18,50,000 (+42.7%)']],
      ['Increment', ['Salary ₹12,00,000 → ₹12,96,000 (+8.0%)']],
      ['Hire', ['Software Engineer, Platform (IN) · G1', 'Manager Ravi Kumar', 'Salary ₹12,00,000, monthly']],
    ])
  })

  it('describes transfers, manager changes and separations', () => {
    const [promotion, ...rest] = actions
    const moved = {
      ...promotion!, actionType: 'transfer', compensation: null,
      assignment: { ...promotion!.assignment!, position: { id: 'pos-pay', code: 'X', name: 'Payments' }, reportsTo: null },
    }
    const separation = { ...promotion!, id: 'a9', actionType: 'separation', assignment: null, compensation: null,
      separation: { resignationDate: null, lastWorkingDate: '2026-12-31', separationType: 'voluntary', separationReason: null } }
    expect(describeHistory([separation, moved, ...rest]).slice(0, 2).map((entry) => entry.changes)).toEqual([
      ['Last working day 31 Dec 2026', 'Voluntary'],
      ['Position Software Engineer, Platform (IN) → Payments', 'Grade G1 → G2', 'Manager Ravi Kumar → none'],
    ])
  })
})
