import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { EmployeePicker } from '../components/employees/EmployeePicker'
import { HireForm } from '../components/hire/HireForm'
import { emptyHire, HIRE_ERROR_ALIASES, HIRE_FIELDS, hireSchema, toHirePayload, type HireValues } from '../components/hire/hireSchema'
import { PageSpinner } from '../components/ui/Spinner'
import { ErrorState } from '../components/ui/states'
import { useToast } from '../components/ui/toastContext'
import { useCreateHire } from '../hooks/useCreateHire'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useEmployees } from '../hooks/useEmployees'
import { useGrades, useJobs, useLegalEntities, usePositions, useSalaryBand } from '../hooks/useReferenceData'
import { todayIso } from '../lib/format'
import { applyServerErrors } from '../lib/formErrors'

/** /employees/new (HR): hire a new person (docs/web-design.md §4). */
export function NewHirePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createHire = useCreateHire()
  const legalEntities = useLegalEntities()
  const grades = useGrades()
  const jobs = useJobs()

  const form = useForm<HireValues>({ resolver: zodResolver(hireSchema), defaultValues: emptyHire(todayIso()) })
  const { control, setValue, getValues, setError, formState } = form
  // Read during render so React Hook Form tracks it (its formState is a subscription proxy).
  const { isDirty } = formState
  const [legalEntityId, positionId, gradeId, effectiveDate] = useWatch({
    control,
    name: ['employment.legalEntityId', 'assignment.positionId', 'assignment.gradeId', 'effectiveDate'],
  })
  const [errorMessages, setErrorMessages] = useState<string[]>([])

  const entity = legalEntities.data?.find((candidate) => candidate.id === legalEntityId) ?? null
  const positions = usePositions(legalEntityId, effectiveDate)
  const position = positions.data?.find((candidate) => candidate.id === positionId) ?? null
  const job = jobs.data?.find((candidate) => candidate.id === position?.job.id) ?? null
  const allowedGrades = useMemo(
    () => (job ? (grades.data ?? []).filter((grade) => grade.rank >= job.minGrade.rank && grade.rank <= job.maxGrade.rank) : []),
    [job, grades.data],
  )
  const band = useSalaryBand(entity?.country.isoCode ?? '', gradeId, effectiveDate)

  // Manager search.
  const [managerQuery, setManagerQuery] = useState('')
  const [manager, setManager] = useState<{ employmentId: string; label: string } | null>(null)
  const debouncedManagerQuery = useDebouncedValue(managerQuery.trim())
  const managerResults = useEmployees({ q: debouncedManagerQuery, perPage: 10 }, { enabled: debouncedManagerQuery.length >= 2 })

  // A new start date can close the chosen position.
  useEffect(() => {
    if (positionId && positions.data && !positions.data.some((candidate) => candidate.id === positionId)) {
      setValue('assignment.positionId', '')
      setValue('assignment.gradeId', '')
    }
  }, [positions.data, positionId, setValue])

  // A position for a different job can rule out the chosen grade.
  useEffect(() => {
    const current = getValues('assignment.gradeId')
    if (current && !allowedGrades.some((grade) => grade.id === current)) setValue('assignment.gradeId', '')
  }, [allowedGrades, getValues, setValue])

  if (legalEntities.isPending || grades.isPending || jobs.isPending) return <PageSpinner />
  if (legalEntities.isError || grades.isError || jobs.isError) {
    return <ErrorState message="We couldn't load the form options." onRetry={() => {
      void legalEntities.refetch(); void grades.refetch(); void jobs.refetch()
    }} />
  }

  const onSubmit = async (values: HireValues) => {
    setErrorMessages([])
    if (!entity) return
    try {
      const action = await createHire.mutateAsync(toHirePayload(values, entity.country.currency))
      const name = action.employment.person.displayName
      toast({
        tone: action.warnings?.length ? 'warning' : 'success',
        title: `Hired ${name} as ${action.employment.employeeNumber}.`,
        details: action.warnings,
      })
      navigate('/dashboard')
    } catch (error) {
      setErrorMessages(applyServerErrors(error, HIRE_FIELDS, setError, HIRE_ERROR_ALIASES))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const onCancel = () => {
    if (!isDirty || window.confirm('Discard this new hire?')) navigate('/dashboard')
  }

  return (
    <div className="page">
      <p className="breadcrumb"><Link to="/dashboard">← Employees</Link></p>
      <h1>New hire</h1>
      <HireForm
        form={form}
        onSubmit={onSubmit}
        onCancel={onCancel}
        errorMessages={errorMessages}
        legalEntities={legalEntities.data}
        onLegalEntityChange={() => {
          setValue('assignment.positionId', '')
          setValue('assignment.gradeId', '')
        }}
        positions={positions.data ?? []}
        positionsLoading={positions.isFetching}
        grades={allowedGrades}
        gradeRange={job ? `${job.minGrade.code}–${job.maxGrade.code}` : null}
        currency={entity?.country.currency ?? null}
        countryName={entity?.country.name ?? null}
        band={band.data}
        managerPicker={
          <EmployeePicker
            label="Manager"
            query={managerQuery}
            onQueryChange={setManagerQuery}
            results={managerResults.data?.data ?? []}
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
    </div>
  )
}
