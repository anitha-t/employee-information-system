import { useQuery } from '@tanstack/react-query'
import { getMyProfile } from '../api/profile'
import { queryKeys } from './queryKeys'

export function useMyProfile() {
  return useQuery({ queryKey: queryKeys.myProfile, queryFn: getMyProfile })
}
