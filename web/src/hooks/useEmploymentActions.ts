import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createChange, listEmploymentActions } from '../api/employmentActions'
import { queryKeys } from './queryKeys'

/** Every action on an employment, newest first. */
export function useEmploymentHistory(employmentId: string) {
  return useQuery({
    queryKey: queryKeys.employmentHistory(employmentId),
    queryFn: () => listEmploymentActions(employmentId),
    select: (page) => page.data,
  })
}

export function useCreateChange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createChange,
    onSuccess: (action) => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.employees }),
      queryClient.invalidateQueries({ queryKey: queryKeys.employmentHistory(action.employment.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.allPositions }),
    ]),
  })
}
