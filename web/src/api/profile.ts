import type { Profile } from '../types/me'
import { api } from './client'

export function getMyProfile(): Promise<Profile> {
  return api.get<Profile>('/me/profile')
}
