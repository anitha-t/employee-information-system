# API Design — Employee & Salary Management

Status: **Draft for review (rev 2)**
Depends on: [domain-model.md](domain-model.md) (rev 2)
Client: separate React app (`web/`)

## Resolved decisions

| # | Decision |
|---|---|
| D1 / D2 | There is no approval workflow and no maker-checker. Actions apply immediately. An optional reviewer is stored for future notifications. |
| D3 | Employee number is a global sequence: `E000123`. |
| D4 | Bearer-token auth. CORS (`rack-cors`) allows the React origin. |
| — | Profile edits (contact info, addresses, emergency contacts) go through **one API** with nested create, update and delete. |
| — | Employee search uses **Postgres full-text search** (`pg_search`). |
| — | All employment changes go through **one action API** (create and update), with a full audit trail. |

---

## 1. Conventions

| Topic | Convention |
|---|---|
| Base path | `/api/v1`, JSON, snake_case |
| Auth | `Authorization: Bearer <token>` (Session table, token digest stored) |
| Roles | `hr` and `employee`, enforced by Pundit policies |
| IDs | UUID strings |
| Dates | ISO-8601. Datetimes are UTC. |
| Money | `{"amount": "1850000.00", "currency": "INR"}`. The amount is a string decimal that maps to a `Money` object. |
| Pagination | `?page=&per_page=` (max 100). Responses include `meta: {page, per_page, total_count}`. |
| Optimistic lock | Send `lock_version` on PATCH. A stale version returns `409`. |
| Errors | `{"error": {"code": "...", "message": "...", "details": {"field.path": ["msg"]}}}` |
| Status codes | 200, 201, 202, 204, 400 missing param, 401 unauthenticated, 403 forbidden, 404, 409 stale `lock_version`, 422 validation, 429 rate limited |
| Audit | Every write records a `paper_trail` version with `whodunnit = current_user.id` |

---

## 2. Endpoints

### 2.1 Auth (public)

| Method | Path | Notes |
|---|---|---|
| POST | `/session` | `{email_address, password}` → `201 {token, expires_at, user}`. A wrong email or password returns `401 invalid_credentials`. So does a person whose employments are all separated. Rate limit: 10 per 3 minutes per IP (`429 rate_limited`). |
| DELETE | `/session` | Revokes the current token → `204` |
| POST | `/passwords` | `{email_address}` → always `202`, whether or not the account exists. Emails a reset link (`WEB_APP_URL/reset-password/:token`) valid for 1 hour. Rate limit: 5 per 15 minutes. |
| PUT | `/passwords/:token` | `{password}` (min. 12 characters) → `204`. Signs the user out everywhere. An invalid or used token returns `422 invalid_token`. |

Tokens are valid for 14 days. There is no sliding renewal. New-hire invites (`create_user: true`) will use a separate, longer-lived invite token when the hire flow is built.

### 2.2 My profile — any logged-in user

| Method | Path | Notes |
|---|---|---|
| GET | `/me` | user, person, current employment summary (job, team, manager, country) |
| GET | `/me/profile` | the editable profile view: contact fields, addresses and emergency contacts |
| PATCH | `/me/profile` | **The single edit API** (see §3.1). Allowed: `preferred_name, phone_number, email, addresses[], emergency_contacts[]`. Any other field → `403`. |
| GET | `/me/employments` | all stints, including past ones, with current assignment |
| GET | `/me/compensations` | own salary history |
| GET | `/me/actions` | own employment timeline |

### 2.3 Directory — any logged-in user

| Method | Path | Notes |
|---|---|---|
| GET | `/directory?q=&team_id=&country=` | Returns name, work email, job title, team, manager and country. **Never salary.** |

### 2.4 Employees — HR

| Method | Path | Notes |
|---|---|---|
| GET | `/employees?q=&country=&legal_entity_id=&team_id=&job_id=&grade_id=&status=&employment_type=&as_of=&page=&per_page=` | Returns `{data, meta: {page, per_page, total_count, as_of}}`. `q` is full-text search (§4). `status` defaults to `active,on_notice`; it also accepts a comma-separated list or `all`. `as_of` defaults to today and picks which job and salary are shown. Leavers show their last known job and salary; future hires show their upcoming one. Each item has employee number, status, person, legal entity, country/currency, position, job, team, grade, manager, `annual_salary` and `pay_frequency`. |
| GET | `/employees/:employment_id?as_of=` | The same fields as a list item, plus `employment: {lock_version, notice_period_days, resignation_date, separation_type, separation_reason, eligible_for_rehire, assignment_effective_from, compensation_effective_from}`. Non-HR users get `403` before the lookup, so they can't probe ids. |
| GET | `/people/:id/profile` | same shape as `/me/profile`, plus `first_name, last_name, dob, gender` |
| PATCH | `/people/:id/profile` | same single API as `/me/profile`, with all person fields allowed |
| PATCH | `/employments/:id` | non-effective-dated fields: `work_email, employment_type, notice_period_days, eligible_for_rehire` |
| GET | `/employments/:id/assignments` | history |
| GET | `/employments/:id/compensations` | history |
| GET | `/employments/:id/actions` | timeline |
| GET | `/employments/:id/audit` | audit trail: who changed what and when, across person, employment, actions and rows |

### 2.5 Employment actions — HR

**One API** to create and update every kind of employment change.

| Method | Path | Notes |
|---|---|---|
| POST | `/employment_actions` | Creates and applies an action of any type, including `hire` (see §3.2) |
| PATCH | `/employment_actions/:id` | Updates any field: reason, reviewer fields, the values in the rows it created, and `effective_date` (latest action only). The linked rows are updated in place and audited. |
| GET | `/employment_actions?employment_id=&action_type=&country=&effective_from=&effective_to=&created_by=&reviewed_by=` | list and filter |
| GET | `/employment_actions/:id` | the action, the rows it created, and the values before the action |

### 2.6 Reference data

Any logged-in user can read these. Only HR can write. Unused records can be deleted; otherwise they are deactivated with `is_active=false`.

| Resource | Path | Notes |
|---|---|---|
| Countries | `/countries` | read-only (seeded) |
| Locations | `/locations` | |
| Legal entities | `/legal_entities` | includes nested addresses |
| Teams | `/teams?tree=true` | |
| Grades | `/grades` | |
| Salary bands | `/salary_bands?country=&grade_id=&as_of=` | HR-only, including reads |
| Jobs | `/jobs?country=&q=` | |
| Positions | `/positions?legal_entity_id=&team_id=&vacant=true` | `filled_head_count` and `vacancies` are computed |

### 2.7 Reports — HR

| Method | Path | Insight |
|---|---|---|
| GET | `/reports/salary_stats?country=&as_of=&employment_type=` | **(a)** headcount, min, max, average and median annual salary |
| GET | `/reports/salary_by_job?country=&job_title=&as_of=&employment_type=` | **(b)** the same per job title. Groups with fewer than 5 people are suppressed and counted in `suppressed_groups`. |
| GET | `/reports/salary_spend?country=&year=&breakdown=month` | **(c)** total salary spend in the calendar year |

**Shared behaviour**
- All three return one entry per country in `data`, each in that country's currency. Amounts are never summed across currencies.
- Without `country`, every country is listed (with zero headcount where nobody is paid). An unknown code returns `422`.

**(a) and (b)**
- **Who is counted:** employments with a compensation row active on `as_of` (default today). People after their last working day and future joiners are excluded.
- **Job title (b):** the primary assignment active on `as_of`. The `job_title` filter is case-insensitive.
- `employment_type` optionally narrows the population, e.g. `full_time`.

**(c)**
- **Proration:** each compensation row contributes `annual_salary ÷ days_in_year` for every day it was in effect within the year, ending at the last working day.
- **Current year:** counted up to and including today (`partial: true`, `to` = today). A future year returns zero and `to: null`.
- **Breakdown:** `total_spend` is the sum of the monthly amounts, so `breakdown=month` always adds up. `employee_count` is the number of employments paid at any point in the period.

```json
// salary_stats
{ "as_of": "2026-11-25", "data": [ { "country": "IN", "currency": "INR", "headcount": 5699,
  "min": {"amount": "602000.00", "currency": "INR"}, "max": {…}, "average": {…}, "median": {…} } ] }

// salary_by_job
{ "as_of": "2026-11-25", "min_group_size": 5, "suppressed_groups": 0,
  "data": [ { "country": "US", "currency": "USD", "job_title": "Software Engineer", "headcount": 679, "min": {…}, "max": {…}, "average": {…}, "median": {…} } ] }

// salary_spend?year=2025&breakdown=month
{ "year": 2025, "from": "2025-01-01", "to": "2025-12-31", "partial": false,
  "data": [ { "country": "IN", "currency": "INR", "employee_count": 5374, "total_spend": {"amount": "9180510531.50", "currency": "INR"},
              "breakdown": [ { "month": "2025-01", "spend": {…} } ] } ] }
```

Measured on the 10,000-employee seed: (a) ~115 ms, (b) ~70 ms, (c) ~50 ms.

---

## 3. Payloads

### 3.1 `PATCH /me/profile` (and `/people/:id/profile`)

Nested arrays use Rails `accepts_nested_attributes_for`:
- An item **without `id`** creates a record.
- An item **with `id`** updates that record.
- An item **with `id` and `"_destroy": true`** removes it.

Items not sent are left unchanged. The whole request is one transaction: either everything saves or nothing does.

```json
{
  "lock_version": 4,
  "preferred_name": "Anu",
  "phone_number": "+919800000000",
  "email": "anu@gmail.com",
  "addresses": [
    { "address_type": "home", "line1": "12 MG Road", "city": "Bengaluru",
      "state": "KA", "postal_code": "560001", "country_id": "…" },
    { "id": "a1…", "line2": "Flat 4B" },
    { "id": "a2…", "_destroy": true }
  ],
  "emergency_contacts": [
    { "name": "Ravi", "relationship": "spouse", "phone_number": "+919811111111", "is_primary": true },
    { "id": "e1…", "_destroy": true }
  ]
}
```
→ `200` with the full profile, including the new `lock_version`.

Rules:
- **`lock_version` is required.** A missing one returns `400`.
- **The person's `lock_version` guards the whole profile.** It is checked and incremented on every save, even when only addresses or contacts change. A stale value returns `409 stale_object`, and nothing is saved.
- **Fields the user may not change return `403 forbidden_fields`**, with the offending fields in `details`, e.g. `{"first_name": ["cannot be changed by you"], "dob": [...]}`. Nothing is saved.
  - Employees may send: `preferred_name, phone_number, email, addresses, emergency_contacts`.
  - HR may also send `first_name, last_name, dob, gender`.
- **Validation errors return `422`**, keyed by the position in the submitted array, e.g. `"addresses[1].line1"`.
- **Nested `id`s are scoped to the person.** Any other id returns `404`.
- **Address types:** `home` or `mailing` for people. `registered` is only for legal entities.
- **One primary emergency contact.** Moving the primary flag between contacts in one request is allowed, because the check runs at commit.

Response shape (GET and PATCH):
```json
{ "id": "…", "lock_version": 1, "first_name": "Anitha", "last_name": "T", "full_name": "Anitha T",
  "preferred_name": "Anu", "email": "…", "phone_number": "+91…", "dob": "1990-05-01", "gender": "female",
  "addresses": [ { "id": "…", "address_type": "home", "line1": "…", "line2": null, "city": "…", "state": null,
                   "postal_code": "…", "country": { "id": "…", "iso_code": "IN", "name": "India" } } ],
  "emergency_contacts": [ { "id": "…", "name": "Ravi", "relationship": "spouse", "phone_number": "+91…", "is_primary": true } ] }
```
Emergency contacts are listed primary first. Employees can read their own legal name, date of birth and gender, but not change them.

### 3.2 `POST /employment_actions`

Common fields:
- `action_type`
- `effective_date`
- `reason`
- optional `reviewed_by_user_id`, `review_decision`

Which sections are required depends on the type:

| action_type | Required sections | Optional sections |
|---|---|---|
| hire | `person` *or* `person_id` (rehire), `employment`, `assignment`, `compensation` | |
| promotion | `employment_id`, `assignment` | `compensation` |
| transfer | `employment_id`, `assignment.position_id` | `assignment.*`, `compensation` |
| manager_change | `employment_id`, `assignment.reports_to_employment_id` | |
| regrade | `employment_id`, `assignment.grade_id` | `compensation` |
| salary_change | `employment_id`, `compensation` | |
| separation | `employment_id`, `separation` | |

**Hire**
```json
{
  "action_type": "hire",
  "effective_date": "2026-01-05",
  "reason": "Backfill",
  "person": { "first_name": "Priya", "last_name": "Sharma", "email": "priya@gmail.com",
              "phone_number": "+919800000000", "dob": "1994-02-11", "gender": "female" },
  "employment": { "legal_entity_id": "…", "employment_type": "full_time",
                  "notice_period_days": 60, "work_email": "priya@acme.com" },
  "assignment": { "position_id": "…", "grade_id": "…", "reports_to_employment_id": "…" },
  "compensation": { "annual_salary": { "amount": "1850000.00", "currency": "INR" },
                    "pay_frequency": "monthly" },
  "create_user": true
}
```
→ `201`:
```json
{ "id": "…", "action_type": "hire", "employment_id": "…", "employee_number": "E000123",
  "assignment": { … }, "compensation": { … }, "created_by": { "id": "…", "name": "…" } }
```
`hire_date` is `effective_date`. With `create_user: true`, an `employee` user is created and sent an invite.

**Promotion**
```json
{
  "action_type": "promotion",
  "employment_id": "…",
  "effective_date": "2026-04-01",
  "reason": "FY26 cycle",
  "reviewed_by_user_id": "…",
  "assignment": { "position_id": "…", "grade_id": "…" },
  "compensation": { "annual_salary": { "amount": "2200000.00", "currency": "INR" } }
}
```

**Separation**
```json
{
  "action_type": "separation",
  "employment_id": "…",
  "effective_date": "2026-12-31",
  "reason": "Resigned",
  "separation": { "resignation_date": "2026-11-01", "last_working_date": "2026-12-31",
                  "separation_type": "voluntary", "separation_reason": "Higher studies",
                  "eligible_for_rehire": true }
}
```

Validations:
- The position must belong to the employment's legal entity.
- The grade must be within the job's grade range.
- The currency must equal the entity's currency.
- `effective_date >= hire_date`.
- There can be no overlapping rows.

A salary outside the salary band is still accepted, and the response includes a `warnings` array.

How actions apply:
- **Date order.** A change must be dated after the latest change of the same kind (assignment or compensation). Otherwise it returns `422 effective_date`.
- **What a change does.** It closes the row active on `effective_date` and opens a new row from that date. Fields not sent are copied from the closed row. For example, a promotion keeps the current manager.
- **No changes after a separation.** Once an employment is `on_notice` or `separated`, other actions return `422 employment_id`.
- **Separation dates.**
  - A separation's `effective_date` is its `last_working_date` (it may be omitted).
  - All open rows close at `last_working_date + 1`.
  - Status becomes `on_notice`, or `separated` if the last working day is already past. A separated person is signed out everywhere.
  - The daily `SeparationSweepJob` moves `on_notice` to `separated` once the last working day has passed.
- **Rehires.** A hire with `person_id` (a rehire) is refused if that person still has a non-separated employment.
- **Reviewer.** `reviewed_by_user_id` must be an HR user. Setting `review_decision` stamps `reviewed_at`.
- **Error keys.** Validation errors are keyed by payload section, e.g. `compensation.annual_salary.currency` or `assignment.grade`.
- **Not built yet:** `create_user` (invite on hire).

Response (`201` for create, `200` for update and show):
```json
{ "id": "…", "lock_version": 0, "action_type": "promotion", "effective_date": "2026-04-01", "reason": "…",
  "employment": { "id": "…", "employee_number": "E000123", "status": "active", "person": { "id": "…", "display_name": "Priya Sharma" } },
  "assignment": { "id": "…", "effective_from": "2026-04-01", "effective_to": null, "position": {…}, "job": {…}, "team": {…},
                  "grade": { "id": "…", "code": "G5" }, "reports_to": { "employment_id": "…", "display_name": "…" } },
  "compensation": { "id": "…", "effective_from": "2026-04-01", "effective_to": null,
                    "annual_salary": { "amount": "2200000.00", "currency": "INR" }, "pay_frequency": "monthly" },
  "separation": null, "created_by": { "id": "…", "display_name": "…" }, "created_at": "…",
  "reviewed_by": null, "review_decision": null, "reviewed_at": null,
  "previous": { "assignment": {…}, "compensation": {…} },
  "warnings": [ "annual_salary … is outside the G5 band for IN (…)" ] }
```
- `previous` appears only on `GET /employment_actions/:id`.
- `warnings` appears only when there are any.
- `GET /employment_actions` returns `{ "data": [ … ], "meta": { "page", "per_page", "total_count" } }`, newest `effective_date` first.

### 3.3 `PATCH /employment_actions/:id`

```json
{
  "lock_version": 1,
  "reason": "FY26 cycle – corrected amount",
  "compensation": { "annual_salary": { "amount": "2150000.00", "currency": "INR" } },
  "reviewed_by_user_id": "…",
  "review_decision": "approved"
}
```
This updates the action and its linked rows in one transaction.
- **`lock_version` is required.** A stale one returns `409`.
- **Updatable sections:** only sections the action already has, and only the assignment fields its type may set. Anything else returns `422`.
- **Salary:** `compensation.annual_salary` and `pay_frequency` can be changed independently.
- **`effective_date`:**
  - It can only be moved on the employment's latest action. Resending an unchanged date is accepted on any action.
  - Moving it also moves the previous row's `effective_to`.
  - It must stay after the previous row's start.
  - On a hire, it also changes `hire_date`.
- **Separations:** change `separation.last_working_date` and the other separation fields. The rows' end date and the status are recalculated.

---

## 4. Employee search

`q` matches, in one SQL query over `employee_snapshots_on(as_of)` (`EmployeeSearch`):
- **Names and personal email:** prefix full-text search on `people.search_vector` (`'simple'` dictionary). `priya sha` becomes `priya:* & sha:*`. Only letters and digits are kept, so users can't inject tsquery operators.
- **Typos and partial names:** trigram similarity ≥ 0.2 on `full_name` (`pg_trgm`). For example, `jon smith` and `smth` both find John Smith.
- **Employee number and work email:** case-insensitive prefix match.

Results are ranked by `ts_rank + similarity`, then by name. Without `q`, they are sorted by name.

Measured locally with 20,000 employees: ~50–75 ms for a search, and ~190 ms for the unfiltered first page plus total count. The unfiltered list has to resolve the current job and salary for every row before sorting.

## 5. Audit trail

- `paper_trail` on Person, Address, EmergencyContact, Employment, EmploymentAction, Assignment, Compensation and all reference tables.
- `whodunnit` holds the current user's id. `controller_info` adds `request_id` and `ip`.
- `GET /employments/:id/audit` merges the versions of the employment, its person, actions, rows and nested contacts:
  `[{at, by: {id, name}, item_type, item_id, event, changes: {field: [old, new]}}]`

---

## 6. Non-functional notes

- Indexes:
  - GIN on `people.search_vector`
  - trigram on names
  - `(employment_id, effective_from)` on assignments and compensations
  - `(employment_id, effective_date)` on actions
  - all FKs
- At 20k employees, reports query plain views directly. They can move to materialized views later if needed.
- The initial 10k load runs through a CSV importer rake task that creates `hire` actions through the same service object.

## 7. Future (not in scope now)

- **Notifications**: notify `reviewed_by_user_id` when it is set. The model already holds the reviewer.
- **Approval workflow**: would add `status` to EmploymentAction and defer applying the action until approved.
- **Bulk annual increments**: a `POST /employment_actions/bulk` endpoint.
