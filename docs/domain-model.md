# Domain Model — Employee & Salary Management

Status: **Approved (rev 2: updated after API design)**
Scope: ~10k employees (India, US, Australia), designed to scale to 20k+. Rails 8 + PostgreSQL, React frontend.

## Decisions applied

| # | Decision | Effect on model |
|---|---|---|
| 1 | Work country = **legal entity's country** | Assignment has no location. Country is derived via `Employment → LegalEntity → Location → Country`. |
| 2 | Salary metric = **`annual_salary`** for all countries | |
| 3 | **Money objects** (`money-rails`) in the compensation's currency, reported per country in its own currency | Stored as `annual_salary_cents` + `currency`. Currency must equal the legal entity's country currency. |
| 4 | Metric (c) = **total salary spend per country per calendar year** | Prorated from effective-dated compensation rows. |
| 5 | HR is **global**. There are only two roles: `hr` and `employee`. | |
| 6 | **No approval workflow.** Employment actions take effect immediately. | `EmploymentAction` has *informational* reviewer fields only, kept as a hook for future notifications. |
| 7 | **Audit trail** of who did what | `paper_trail` on every table, with `whodunnit = current_user.id`. |
| 8 | **Employee number**: global sequence | Postgres sequence → `E000123`, generated on hire. |
| 9 | **Employee search**: Postgres full-text search | `pg_search` with a `tsvector` and trigram indexes on people. |

All primary keys are UUIDs. All effective-dated ranges are **half-open `[effective_from, effective_to)`**, where `effective_to = NULL` means open-ended. Editable tables have a `lock_version` column, which gives optimistic locking (a stale save returns `409`).

---

## Entity Relationship Diagram

See [er-diagram.md](er-diagram.md) for the full diagram with columns, and [architecture.md](architecture.md) for the system design.

---

## Entities

### Reference / Organisation

Every reference table except Country has `is_active` and `lock_version`. Records that are referenced elsewhere are deactivated, never deleted.

**Country** (seeded, read-only)
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| iso_code | string(2) | `IN`, `US`, `AU`. Unique. |
| name | string | |
| currency | string(3) | `INR`, `USD`, `AUD` |

**Location**
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| country_id | FK → Country | |
| state, city | string | |

**LegalEntity**: the employer of record. **It is the source of truth for an employee's country.**
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| name | string | |
| location_id | FK → Location | gives the country |
| effective_from / effective_to | date | |
| is_active | boolean | |
| has_many | Address (polymorphic) | registered address |

**Team**
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| name | string | |
| parent_id | FK → Team, nullable | |

**Grade**
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| code | string | Unique. |
| name | string | |
| rank | integer | |

**SalaryBand**
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| grade_id | FK → Grade | |
| country_id | FK → Country | |
| min_cents / max_cents | bigint | |
| currency | string(3) | = country currency |
| effective_from / effective_to | date | |

**Job**
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| code | string | Unique. |
| title | string | used for insight (b) |
| level | string | |
| description | text | |
| min_grade_id / max_grade_id | FK → Grade | |
| has_many | countries through `job_countries` | |

**Position**
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| code | string | Unique. |
| name | string | |
| job_id | FK → Job | |
| team_id | FK → Team | |
| legal_entity_id | FK → LegalEntity | |
| location_id | FK → Location, nullable | null when `is_remote` |
| is_remote | boolean | |
| required_head_count | integer | filled count is computed from active assignments |
| effective_from / effective_to | date | |

### People & Access

**Person**
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| first_name | string | |
| last_name | string, nullable | |
| preferred_name | string | |
| full_name | generated column | |
| email | string, unique, nullable | personal email. Used to find an existing person when rehiring. |
| phone_number | string | E.164 |
| dob | date | |
| gender | enum | |
| search_vector | tsvector, generated | from first, last and preferred names and email. GIN index. |
| lock_version | integer | |
| has_many | EmergencyContact, Address | `accepts_nested_attributes_for … allow_destroy: true` |

**EmergencyContact**
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| person_id | FK → Person | |
| name | string | |
| relationship | string | |
| phone_number | string | |
| is_primary | boolean | at most one primary per person |

**Address** (polymorphic: Person, LegalEntity)
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| addressable_type / addressable_id | polymorphic | |
| address_type | enum | `home`, `mailing`, `registered` |
| line1, line2, city, state, postal_code | string | |
| country_id | FK → Country | |

**User**
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| person_id | FK → Person, unique | |
| email_address | string, unique | login (work email) |
| password_digest | string | |
| role | enum | `hr`, `employee` |

**Session**: one bearer token per login.
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | FK → User | |
| token_digest | string, unique | only the digest of the token is stored |
| ip_address, user_agent | string | |
| expires_at | datetime | |

### Employment

**Employment**: one stint with one legal entity.
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| person_id | FK → Person | |
| legal_entity_id | FK → LegalEntity | **immutable**. Moving entity = `separation` + a new `hire` for the same person. |
| employee_number | string, unique | `E` + zero-padded `nextval('employee_number_seq')`, assigned on hire |
| employment_type | enum | `full_time`, `part_time`, `contractor`, `intern` |
| status | enum | `active`, `on_notice`, `separated` |
| hire_date | date | |
| notice_period_days | integer | |
| resignation_date, last_working_date | date | set by the `separation` action |
| separation_type, separation_reason | enum / text | |
| eligible_for_rehire | boolean | |
| work_email | string | |
| lock_version | integer | |

**EmploymentAction**: one business event that changes an employment. It takes effect immediately, with no approval step.
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| employment_id | FK → Employment | |
| action_type | enum | `hire`, `promotion`, `transfer`, `manager_change`, `regrade`, `salary_change`, `separation` |
| effective_date | date | |
| reason | text | |
| created_by_user_id | FK → User | |
| reviewed_by_user_id | FK → User, nullable | **informational**. Future: notify this HR user. |
| review_decision | enum, nullable | `approved`, `rejected`. Informational only. |
| reviewed_at | datetime, nullable | |
| lock_version | integer | |

**Assignment**: what the employee does, effective-dated.
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| employment_id | FK → Employment | |
| employment_action_id | FK → EmploymentAction | the action that created this row |
| position_id | FK → Position | job and team come through the position |
| grade_id | FK → Grade | |
| reports_to_employment_id | FK → Employment, nullable | manager |
| is_primary | boolean | |
| effective_from / effective_to | date | |

**Compensation**: salary, effective-dated.
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| employment_id | FK → Employment | |
| employment_action_id | FK → EmploymentAction | the action that created this row |
| annual_salary_cents | bigint | `monetize :annual_salary_cents, with_model_currency: :currency` |
| currency | string(3) | must equal the legal entity's country currency |
| pay_frequency | enum | `monthly`, `semi_monthly`, `bi_weekly`, `weekly` |
| effective_from / effective_to | date | |

### Which action creates which rows

| action_type | Assignment row | Compensation row | Employment fields |
|---|---|---|---|
| hire | ✔ first | ✔ first | creates Employment (and Person, if new) |
| promotion | ✔ (position and/or grade) | optional | |
| transfer | ✔ (position, same entity) | optional | |
| manager_change | ✔ (reports_to) | | |
| regrade | ✔ (grade) | optional | |
| salary_change | | ✔ | |
| separation | closes open rows | closes open rows | resignation and last working dates, separation type and reason, rehire eligibility, status |

A new assignment row copies any fields the action did not change from the current row. It closes the previous row at `effective_date`.

**Corrections** are made by updating the action (`PATCH /employment_actions/:id`), which updates the rows it created in place. `paper_trail` keeps the before and after values.

---

## Integrity constraints

1. No overlapping compensation rows per employment: `EXCLUDE USING gist (employment_id WITH =, daterange(effective_from, effective_to, '[)') WITH &&)`.
2. No overlapping primary assignment rows per employment, using the same pattern with `WHERE is_primary`.
3. `effective_from >= employment.hire_date`. A separation closes all open rows at `last_working_date + 1`.
4. `Compensation.currency` = the legal entity's country currency.
5. `Assignment.position.legal_entity_id = employment.legal_entity_id`. The grade must be within the job's min–max grade.
6. Only the **latest** action of an employment may change its `effective_date`. Older actions may only change values.
7. Unique: `employee_number`, `Job.code`, `Position.code`, `Country.iso_code`, `User.person_id`, `User.email_address`, `Person.email`.
8. A daily recurring job (Solid Queue) moves employments from `on_notice` to `separated` after `last_working_date`.
9. `Employment.work_email` is unique among non-separated employments, so a rehired person can reuse their old work email.
10. Salary bands cannot overlap for the same grade and country (exclusion constraint). `Grade.rank` and `LegalEntity.name` are unique.
11. Enum values:
    - `Person.gender`: `female`, `male`, `non_binary`, `undisclosed`
    - `Employment.separation_type`: `voluntary`, `involuntary`, `retirement`, `end_of_contract`, `other`
    - A Session token is valid for 14 days.

---

## How each insight is answered

Country path: `Compensation → Employment → LegalEntity → Location → Country`.

- **(a) Min / max / avg / median salary in a country.** Use employments with a compensation row active on `as_of` (default today), grouped by country (`Reports::SalaryStats`).
- **(b) Avg salary per job title in a country.** Same as (a), joined to the primary assignment active on `as_of`, then `Position → Job.title`. Groups with fewer than 5 people are suppressed.
- **(c) Total salary spend in calendar year Y** (`Reports::SalarySpend`). For each compensation row overlapping Y:
  ```
  active_from = max(effective_from, Jan 1 Y)
  active_to   = min(coalesce(effective_to, ∞), Jan 1 Y+1, today + 1, last_working_date + 1)
  spend       = annual_salary × (active_to − active_from) / days_in_year(Y)
  ```
  Sum the spend per country, which is a single currency. The total is the sum of monthly amounts.

The employee list and reports (a) and (b) read from the SQL function `employee_snapshots_on(as_of)`. It returns one row per employment, with person, legal entity, country, and the primary assignment and compensation for that date:
- If a row started on or before `as_of`, the function picks the latest such row.
- Otherwise (a future hire), it picks the earliest upcoming row.
- Reports filter on the returned `*_effective_from/to` columns when they need rows strictly active on `as_of`.

It is a function rather than a view so the date is a parameter. Report (c) queries `compensations` directly, because it needs every row overlapping the year, not one row per employee.
