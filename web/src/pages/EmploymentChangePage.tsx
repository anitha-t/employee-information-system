import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { ChangeForm } from '../components/changes/ChangeForm'
import {
  CHANGE_ERROR_ALIASES, CHANGE_FIELDS, CHANGE_TYPES, changeSchema, initialChangeValues, isChangeType, minimumDate,
  toChangePayload, type ChangeContext, type ChangeValues,
} from '../components/changes/changeSchema'
import { CurrentSummary } from '../components/changes/CurrentSummary'
import { latestRowDates } from '../components/changes/history'
import { EmployeePicker } from '../components/employees/EmployeePicker'
import { PageSpinner } from '../components/ui/Spinner'
import { ErrorState } from '../components/ui/states'
import { useToast } from '../components/ui/toastContext'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useCreateChange, useEmploymentHistory } from '../hooks/useEmploymentActions'
import { useEmployee, useEmployees } from '../hooks/useEmployees'
import { useGrades, useJobs, usePositions, useSalaryBand } from '../hooks/useReferenceData'
import { isNotFound } from '../lib/errors'
import { formatDate, label, todayIso } from '../lib/format'
import { applyServerErrors } from '../lib/formErrors'
import type { EmployeeDetail } from '../types/employee'
import type { ChangeType } from '../types/employmentAction'
import { EmployeeNotFound } from './EmployeeNotFound'

/** /employees/:employmentId/changes/new?type= (HR): increment, promotion or transfer (docs/web-design.md §7.2). */
export function EmploymentChangePage() {
  const { employmentId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type')
  const employee = useEmployee(employmentId)
  const history = useEmploymentHistory(employmentId)
  const grades = useGrades()
  const jobs = useJobs()

  if (!isChangeType(type)) return <Navigate to={`/employees/${employmentId}/changes/new?type=salary_change`} replace />
  if (employee.isError && isNotFound(employee.error)) return <EmployeeNotFound />

  const back = `/employees/${employmentId}`
  const queries = [employee, history, grades, jobs]
  const failed = queries.find((query) => query.isError)

  return (
    <div className="page">
      <p className="breadcrumb"><Link to={back}>← {employee.data?.person.displayName ?? 'Employee'}</Link></p>
      <h1>Change employment</h1>
      <nav className="tabs" aria-label="Change type">
        {CHANGE_TYPES.map((entry) => (
          <Link key={entry.type} to={`?type=${entry.type}`} replace className={`tab${entry.type === type ? ' active' : ''}`}
            aria-current={entry.type === type ? 'page' : undefined}>{entry.label}</Link>
        ))}
      </nav>
      {failed ? (
        <ErrorState message="We couldn't load this employee's details." onRetry={() => queries.forEach((query) => void query.refetch())} />
      ) : !employee.data || !history.data || !grades.data || !jobs.data ? <PageSpinner /> : employee.data.status !== 'active' ? (
        <p className="alert alert-info">No further changes can be made ({label('status', employee.data.status).toLowerCase()}).</p>
      ) : (
        <ChangeEditor
          key={type}
          type={type}
          current={employee.data}
          context={{ type, current: employee.data, ...latestRowDates(history.data) }}
          back={back}
        />
      )}
    </div>
  )
}

interface EditorProps {
  type: ChangeType
  current: EmployeeDetail
  context: ChangeContext
  back: string
}

function ChangeEditor({ type, current, context, back }: EditorProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const createChange = useCreateChange()
  const grades = useGrades()
  const jobs = useJobs()
  const [schema] = useState(() => changeSchema(context))
  const form = useForm<ChangeValues>({ resolver: zodResolver(schema), defaultValues: initialChangeValues(current, todayIso()) })
  const { control, setValue, getValues, setError, formState } = form
  const { isDirty } = formState // read during render so React Hook Form tracks it
  const [positionId, gradeId, effectiveDate, amount] = useWatch({
    control, name: ['assignment.positionId', 'assignment.gradeId', 'effectiveDate', 'compensation.amount'],
  })
  const [errorMessages, setErrorMessages] = useState<string[]>([])

  const changesRole = type !== 'salary_change'
  const positions = usePositions(changesRole ? current.legalEntity.id : '', effectiveDate)
  const jobId = positions.data?.find((position) => position.id === positionId)?.job.id
    ?? (positionId === current.position?.id ? current.job?.id : undefined)
  const job = jobs.data?.find((candidate) => candidate.id === jobId) ?? null
  const allowedGrades = useMemo(
    () => (job ? (grades.data ?? []).filter((grade) => grade.rank >= job.minGrade.rank && grade.rank <= job.maxGrade.rank) : []),
    [job, grades.data],
  )
  const band = useSalaryBand(current.country.isoCode, gradeId || current.grade?.id || '', effectiveDate)
  const rank = (id: string | undefined) => grades.data?.find((grade) => grade.id === id)?.rank ?? 0
  const gradeHint = type === 'promotion' && gradeId && gradeId !== current.grade?.id && rank(gradeId) <= rank(current.grade?.id)
    ? 'Usually a promotion moves to a higher grade' : undefined
  const minimum = minimumDate(context, amount.trim() !== '')

  // Manager search (transfer only). Empty value = keep the current manager.
  const [managerQuery, setManagerQuery] = useState('')
  const [manager, setManager] = useState(current.manager && { employmentId: current.manager.employmentId, label: current.manager.displayName })
  const debouncedQuery = useDebouncedValue(managerQuery.trim())
  const managerResults = useEmployees({ q: debouncedQuery, perPage: 10 }, { enabled: type === 'transfer' && debouncedQuery.length >= 2 })

  // Selects are uncontrolled: once their options arrive, re-apply the value so the current choice shows.
  useEffect(() => {
    if (positions.data) setValue('assignment.positionId', getValues('assignment.positionId'))
  }, [positions.data, getValues, setValue])
  useEffect(() => {
    setValue('assignment.gradeId', getValues('assignment.gradeId'))
  }, [allowedGrades, getValues, setValue])

  // A position for a different job can rule out the chosen grade.
  useEffect(() => {
    const chosen = getValues('assignment.gradeId')
    if (job && chosen && !allowedGrades.some((grade) => grade.id === chosen)) setValue('assignment.gradeId', '')
  }, [job, allowedGrades, getValues, setValue])

  const onSubmit = async (values: ChangeValues) => {
    setErrorMessages([])
    try {
      const action = await createChange.mutateAsync(toChangePayload(values, context))
      const verb = CHANGE_TYPES.find((entry) => entry.type === type)?.verb
      toast({
        tone: action.warnings?.length ? 'warning' : 'success',
        title: `${verb} saved for ${current.person.fullName}, effective ${formatDate(values.effectiveDate)}.`,
        details: action.warnings,
      })
      navigate(back)
    } catch (error) {
      setErrorMessages(applyServerErrors(error, CHANGE_FIELDS, setError, CHANGE_ERROR_ALIASES))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <>
      <CurrentSummary employee={current} />
      <ChangeForm
        form={form}
        type={type}
        current={current}
        onSubmit={onSubmit}
        onCancel={() => { if (!isDirty || window.confirm('Discard this change?')) navigate(back) }}
        errorMessages={errorMessages}
        dateHint={minimum && `Must be after ${formatDate(minimum.date)} (${minimum.what})`}
        positions={positions.data ?? []}
        positionsLoading={positions.isFetching}
        grades={allowedGrades}
        gradeRange={job ? `${job.minGrade.code}–${job.maxGrade.code}` : null}
        gradeHint={gradeHint}
        band={band.data}
        managerPicker={
          <EmployeePicker
            label="Manager"
            query={managerQuery}
            onQueryChange={setManagerQuery}
            results={(managerResults.data?.data ?? []).filter((employee) => employee.employmentId !== current.employmentId)}
            loading={managerResults.isFetching}
            selected={manager}
            error={formState.errors.assignment?.reportsToEmploymentId?.message}
            onSelect={(employee) => {
              setManager(employee && { employmentId: employee.employmentId, label: `${employee.person.displayName} (${employee.employeeNumber})` })
              setValue('assignment.reportsToEmploymentId', employee?.employmentId ?? '', { shouldDirty: true })
              setManagerQuery('')
            }}
          />
        }
      />
    </>
  )
}
