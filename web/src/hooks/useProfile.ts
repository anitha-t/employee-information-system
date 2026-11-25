import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyProfile, getPersonProfile, updateMyProfile, updatePersonProfile } from '../api/profile'
import type { ProfileUpdate } from '../types/me'
import { queryKeys } from './queryKeys'

export function useMyProfile() {
  return useQuery({ queryKey: queryKeys.myProfile, queryFn: getMyProfile })
}

/** HR: a person's profile. Idle until the person is known. */
export function usePersonProfile(personId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.personProfile(personId ?? ''),
    queryFn: () => getPersonProfile(personId!),
    enabled: Boolean(personId),
  })
}

/** Whose profile a form saves: the signed-in user's, or (HR) a given person's. */
export type ProfileTarget = { kind: 'me' } | { kind: 'person'; personId: string }

export function useUpdateProfile(target: ProfileTarget) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: ProfileUpdate) =>
      target.kind === 'me' ? updateMyProfile(changes) : updatePersonProfile(target.personId, changes),
    onSuccess: async (profile) => {
      queryClient.setQueryData(queryKeys.personProfile(profile.id), profile)
      if (target.kind === 'me') queryClient.setQueryData(queryKeys.myProfile, profile)
      // Names show up in /me, the employee list and employee pages; HR may edit their own record.
      await Promise.all([
        target.kind === 'person' && queryClient.invalidateQueries({ queryKey: queryKeys.myProfile }),
        queryClient.invalidateQueries({ queryKey: queryKeys.me }),
        queryClient.invalidateQueries({ queryKey: queryKeys.employees }),
      ])
    },
  })
}
