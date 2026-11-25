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
| Audit | Every write records a `paper_trail` version with `whodunnit = current_user.id` |

---

## 2. Endpoints

### 2.1 Auth (public)

| Method | Path | Notes |
|---|---|---|
| POST | `/session` | `{email_address, password}` → `{token, expires_at, user}` |
| DELETE | `/session` | revoke the current token |
| POST | `/passwords` | `{email_address}`. Sends a reset email. Also used as the invite for new hires. |
| PUT | `/passwords/:token` | `{password}` |

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
| GET | `/employees?q=&country=&legal_entity_id=&team_id=&job_id=&grade_id=&status=&employment_type=` | `q` is full-text search (§4). The list is backed by `current_employee_snapshots`. |
| GET | `/employees/:employment_id` | person, employment, current assignment, current compensation |
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
| GET | `/reports/salary_stats?country=&as_of=` | **(a)** min, max, average, median and headcount |
| GET | `/reports/salary_by_job?country=&job_title=&as_of=` | **(b)** per job title. Groups with fewer than 5 people are suppressed. |
| GET | `/reports/salary_spend?country=&year=&breakdown=month` | **(c)** prorated spend for the calendar year |

Without `country`, the response has one entry per country, each in its own currency.

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

Validation errors are keyed by path, e.g. `"addresses[0].postal_code"`. Nested `id`s are scoped to the person, so any other id returns `404`.

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
This updates the action and its linked rows in one transaction. Changing `effective_date` also moves the previous row's `effective_to`, and is allowed only on the employment's latest action.

---

## 4. Employee search

- The `pg_search` scope on Person searches `search_vector`, which covers first, last and preferred names and personal email. It uses `tsearch` with prefix matching.
- It also uses `trigram` matching (`pg_trgm`) for typos and partial names.
- `employee_number` and `work_email` are matched exactly or by prefix, through an index on employments.
- `GET /employees?q=priy` combines this search with the filters. Results are ranked by relevance and then by name.

---

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
