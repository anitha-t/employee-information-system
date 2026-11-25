import { useQuery } from '@tanstack/react-query'
import { listCountries, listGrades, listJobs, listLegalEntities, listPositions, listSalaryBands } from '../api/reference'
import { queryKeys } from './queryKeys'

// Reference data rarely changes; keep it for an hour.
const STALE = 60 * 60_000

export const useCountries = () => useQuery({ queryKey: queryKeys.countries, queryFn: listCountries, staleTime: STALE })
export const useLegalEntities = () =>
  useQuery({ queryKey: queryKeys.legalEntities, queryFn: listLegalEntities, staleTime: STALE })
export const useGrades = () => useQuery({ queryKey: queryKeys.grades, queryFn: listGrades, staleTime: STALE })
export const useJobs = () => useQuery({ queryKey: queryKeys.jobs, queryFn: listJobs, staleTime: STALE })

/** Positions open on `asOf` at a legal entity. Idle until an entity is chosen. */
export function usePositions(legalEntityId: string, asOf: string) {
  const query = { legalEntityId, asOf: asOf || undefined }
  return useQuery({
    queryKey: queryKeys.positions(query),
    queryFn: () => listPositions(query),
    enabled: Boolean(legalEntityId),
    select: (response) => response.data,
  })
}

/** The salary band for a grade in a country (HR only). Idle until both are known. */
export function useSalaryBand(country: string, gradeId: string, asOf: string) {
  const query = { country, gradeId, asOf: asOf || undefined }
  return useQuery({
    queryKey: queryKeys.salaryBands(query),
    queryFn: () => listSalaryBands(query),
    enabled: Boolean(country && gradeId),
    select: (bands) => bands[0] ?? null,
  })
}
