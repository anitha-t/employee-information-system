import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ApiError } from '../api/client'
import { ProfileForm } from '../components/profile/ProfileForm'
import { profileFields, profileSchema, toProfileUpdate, toProfileValues, type ProfileValues } from '../components/profile/profileSchema'
import { Button } from '../components/ui/Button'
import { PageSpinner } from '../components/ui/Spinner'
import { Alert, ErrorState } from '../components/ui/states'
import { useToast } from '../components/ui/toastContext'
import { useCountries } from '../hooks/useReferenceData'
import { useUpdateProfile, type ProfileTarget } from '../hooks/useProfile'
import { applyServerErrors } from '../lib/formErrors'
import type { Profile } from '../types/me'

interface Props {
  profile: Profile
  target: ProfileTarget
  canEditLegal: boolean
  /** Country preselected for a new address (the employee's work country). */
  defaultCountryIso?: string
  /** Toast text, from the saved profile (its name may have just changed). */
  savedMessage: (saved: Profile) => string
  onDone: () => void
  /** Refetches the profile; the caller then remounts this editor (new `key`) with the fresh copy. */
  onReload: () => void
}

/**
 * Loads a profile into ProfileForm and saves it (docs/web-design.md §5.1).
 *
 * Works on the profile it was opened with: later cache updates (the saved
 * profile, a background refetch) neither reset the form nor change the
 * lock_version it sends. Only a reload after a conflict starts afresh.
 */
export function ProfileEditor({ profile: openedWith, target, canEditLegal, defaultCountryIso, savedMessage, onDone, onReload }: Props) {
  const [profile] = useState(openedWith)
  const toast = useToast()
  const countries = useCountries()
  const update = useUpdateProfile(target)
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: toProfileValues(profile) })
  const { isDirty } = form.formState // read during render so React Hook Form tracks it
  const [errorMessages, setErrorMessages] = useState<string[]>([])
  const [conflict, setConflict] = useState(false)

  const homeCountry = profile.addresses[0]?.country.isoCode ?? defaultCountryIso
  const defaultCountryId = countries.data?.find((country) => country.isoCode === homeCountry)?.id ?? ''

  const onSubmit = async (values: ProfileValues) => {
    setErrorMessages([])
    try {
      const saved = await update.mutateAsync(toProfileUpdate(values, profile, { canEditLegal }))
      toast({ tone: 'success', title: savedMessage(saved) })
      onDone()
    } catch (error) {
      // 409: stale lock_version. 404: a row on screen was deleted by someone else
      // (the API checks nested ids first). Either way the fix is to reload.
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        setConflict(true)
      } else {
        setErrorMessages(applyServerErrors(error, profileFields(values), form.setError))
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // The address country selects need their options before they mount.
  if (countries.isPending) return <PageSpinner />
  if (countries.isError) return <ErrorState message="We couldn't load the form options." onRetry={() => countries.refetch()} />

  return (
    <>
      {conflict && (
        <Alert tone="warning">
          <p>Someone else changed this profile while you were editing. Nothing was saved.</p>
          <Button variant="secondary" onClick={onReload}>Reload their changes (discards yours)</Button>
        </Alert>
      )}
      <ProfileForm
        form={form}
        onSubmit={onSubmit}
        onCancel={() => { if (!isDirty || window.confirm('Discard your changes?')) onDone() }}
        errorMessages={errorMessages}
        countries={countries.data}
        defaultCountryId={defaultCountryId}
        canEditLegal={canEditLegal}
      />
    </>
  )
}
