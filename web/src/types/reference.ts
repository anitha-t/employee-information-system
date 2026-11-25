import type { Money, PageMeta } from './api'

export interface Country {
  id: string
  isoCode: string
  name: string
  currency: string
}

export interface LegalEntity {
  id: string
  name: string
  isActive: boolean
  location: { id: string; city: string; state: string | null }
  country: Country
}

export interface Grade {
  id: string
  code: string
  name: string
  rank: number
}

export interface GradeRef {
  id: string
  code: string
  rank: number
}

export interface Job {
  id: string
  code: string
  title: string
  level: string | null
  minGrade: GradeRef
  maxGrade: GradeRef
  countries: string[]
}

export interface Position {
  id: string
  code: string
  name: string
  isRemote: boolean
  requiredHeadCount: number
  filledHeadCount: number
  vacancies: number
  job: { id: string; code: string; title: string }
  team: { id: string; name: string }
  legalEntity: { id: string; name: string }
  country: { id: string; isoCode: string; currency: string }
  location: { id: string; city: string; state: string | null } | null
}

export interface PositionsMeta extends PageMeta {
  asOf: string
}

export interface SalaryBand {
  id: string
  currency: string
  country: { id: string; isoCode: string }
  grade: GradeRef
  min: Money
  max: Money
}
