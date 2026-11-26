import { useState } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Draft and applied filters for one report section, applied with Go.
 *
 * Applied values live in the URL under the section's own keys, e.g.
 * { asOf: 'stats_as_of' }. The first key is always written on Go, so its
 * presence means "this report has been run" (a link or back reruns it).
 */
export function useReportFilters<T extends Record<string, string>>(urlKeys: Record<keyof T, string>, defaults: T) {
  const [searchParams, setSearchParams] = useSearchParams()
  const keys = Object.keys(urlKeys) as (keyof T)[]
  const marker = urlKeys[keys[0]!]
  const applied: T | null = searchParams.get(marker)
    ? (Object.fromEntries(keys.map((key) => [key, searchParams.get(urlKeys[key]) ?? ''])) as T)
    : null
  const [draft, setDraft] = useState<T>(() => applied ?? defaults)

  const setField = (key: keyof T, value: string) => setDraft((current) => ({ ...current, [key]: value }))

  /** Applies the draft. Returns false when nothing changed (the caller refreshes instead). */
  const apply = (): boolean => {
    if (applied && keys.every((key) => applied[key] === draft[key])) return false
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      for (const key of keys) {
        if (draft[key]) next.set(urlKeys[key], draft[key])
        else next.delete(urlKeys[key])
      }
      return next
    })
    return true
  }

  return { applied, draft, setField, apply }
}
