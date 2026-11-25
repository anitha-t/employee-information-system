import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createHire } from '../api/employmentActions'
import { queryKeys } from './queryKeys'

export function useCreateHire() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createHire,
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.employees }),
      queryClient.invalidateQueries({ queryKey: queryKeys.allPositions }),
    ]),
  })
}
