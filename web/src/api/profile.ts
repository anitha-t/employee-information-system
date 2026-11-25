import type { Profile, ProfileUpdate } from '../types/me'
import { api } from './client'

export function getMyProfile(): Promise<Profile> {
  return api.get<Profile>('/me/profile')
}

/** 200 with the new profile; 409 if someone else saved first; 403 for fields the user may not change. */
export function updateMyProfile(changes: ProfileUpdate): Promise<Profile> {
  return api.patch<Profile>('/me/profile', changes)
}

/** HR: anyone's profile. */
export function getPersonProfile(personId: string): Promise<Profile> {
  return api.get<Profile>(`/people/${encodeURIComponent(personId)}/profile`)
}

export function updatePersonProfile(personId: string, changes: ProfileUpdate): Promise<Profile> {
  return api.patch<Profile>(`/people/${encodeURIComponent(personId)}/profile`, changes)
}
