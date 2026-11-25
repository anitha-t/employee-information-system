import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '../api/client'

/**
 * Puts a 422's field errors onto a React Hook Form form. API paths are already
 * camelCase ("person.firstName"); "assignment.grade" also matches the form's
 * "assignment.gradeId", and `aliases` maps any other path to a field.
 * Returns messages that match no field, for a summary.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  fields: readonly string[],
  setError: UseFormSetError<T>,
  aliases: Record<string, string> = {},
): string[] {
  if (!(error instanceof ApiError)) return ['Something went wrong. Try again.']
  const entries = Object.entries(error.details)
  if (entries.length === 0) return [error.message]

  const unmatched: string[] = []
  let focused = false
  for (const [path, messages] of entries) {
    const field = [aliases[path], path, `${path}Id`].find((candidate) => candidate !== undefined && fields.includes(candidate))
    const message = messages.join(', ')
    if (field) {
      setError(field as Path<T>, { type: 'server', message }, { shouldFocus: !focused })
      focused = true
    } else {
      unmatched.push(`${humanize(path)} ${message}`)
    }
  }
  return unmatched
}

const humanize = (path: string) => {
  const last = path.split('.').pop() ?? path
  const words = last.replace(/([A-Z])/g, ' $1').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
