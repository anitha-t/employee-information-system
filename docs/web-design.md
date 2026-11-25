# Web App Design — Phase 1: sign-in, dashboards, new hire

Status: **Phase 1 built** (`web/`)
Depends on: [api-design.md](api-design.md), [AGENTS.md](../AGENTS.md) (frontend rules)
Scope: the pages a user sees from signing in to their dashboard, plus the HR "new hire" flow.

## 1. Pages and routes

| Route | Page | Who | API |
|---|---|---|---|
| `/login` | Sign in | Signed out | `POST /session` |
| `/forgot-password` | Request a reset link | Signed out | `POST /passwords` |
| `/reset-password/:token` | Set a new password (link from the email) | Signed out | `PUT /passwords/:token` |
| `/` | Redirects to `/dashboard` | — | — |
| `/dashboard` | **Employee:** my info. **HR:** employee search and "New hire". | Signed in | see §3 |
| `/profile` | My info (the employee dashboard view; HR reaches it from the user menu) | Signed in | `GET /me`, `GET /me/profile` |
| `/employees/new` | New hire form | HR | `POST /employment_actions` and reference data (§4) |
| `*` | Not found | — | — |

Routing rules:
- `<RequireAuth>` wraps every signed-in route. It reads `useCurrentUser()` (`GET /me`). While that loads it shows a full-page spinner. On `401` it sends the user to `/login?next=<path>`.
- `<RequireRole role="hr">` wraps HR-only routes. An employee who opens one sees a "You don't have access" page. This is a convenience only: the API enforces roles.
- A signed-in user who opens `/login`, `/forgot-password` or `/reset-password` is redirected to `/dashboard`.
- After sign-in: go to `next` if it is a same-app path (starts with `/`, not `//`), otherwise `/dashboard`.

Out of scope for phase 1 (planned next): employee detail (`/employees/:employmentId`), editing a profile, other employment actions, reports.

## 2. Sign-in pages

All three use `AuthLayout`: a centred card with the app name, no navigation.

### 2.1 `/login`

```
┌──────────────────────────────────────┐
│  Employee Information System         │
│                                      │
│  Work email  [____________________]  │
│  Password    [____________________]  │
│                                      │
│  [        Sign in        ]           │
│  Forgot password?                    │
└──────────────────────────────────────┘
```

- Fields: `email_address` (required, email format) and `password` (required). Validated with Zod before submit.
- Submit → `POST /session`. The button shows a spinner and is disabled while the request runs.
- `201` → the browser now holds the session cookie (§6). Invalidate `["me"]` and navigate as in §1.
- `401 invalid_credentials` → a form-level error: "Email or password is incorrect." The password field is cleared. Separated employees get this same message (the API doesn't distinguish them).
- `429 rate_limited` → "Too many sign-in attempts. Try again in a few minutes."
- Network or 5xx error → "Something went wrong. Try again."
- A `?reset=1` query string shows a success banner: "Password updated. Sign in with your new password."

### 2.2 `/forgot-password`

- One field: `email_address`. Submit → `POST /passwords`.
- `202` → replace the form with "If an account exists for that email, we've sent a reset link. It expires in 1 hour." The response is the same whether or not the account exists, and the page must not suggest otherwise.
- `429` → "Too many requests. Try again later."
- Link back to sign in.

### 2.3 `/reset-password/:token`

- Fields: `password` and `confirm_password`. Both are required, the password needs at least 12 characters, and the two must match. The checks run on the client, and only `password` is sent.
- Submit → `PUT /passwords/:token`.
- `204` → navigate to `/login?reset=1`. The API signs the user out everywhere, so no session is kept.
- `422 invalid_token` → "This reset link is invalid or has expired." with a link to `/forgot-password`.
- `422 validation_failed` with `details.password` → show the message under the password field.
- The email link points to `WEB_APP_URL/reset-password/:token` (API env var, default `http://localhost:5173`).

## 3. Dashboard (`/dashboard`)

One route. `DashboardPage` reads `me.user.role` and renders `EmployeeDashboard` or `HrDashboard`.

Both use `AppShell`:

```
┌─────────────────────────────────────────────────────────────────┐
│ Employee Information System             Priya Sharma (HR) ▾     │
│                                           My profile            │
│                                           Sign out              │
├─────────────────────────────────────────────────────────────────┤
│  <page content>                                                 │
└─────────────────────────────────────────────────────────────────┘
```

The user menu shows `person.display_name` and a role badge. "Sign out" → `DELETE /session` (the API clears the cookie), then `queryClient.clear()`, then go to `/login`. If the call fails (for example, the token already expired), sign out locally anyway.

### 3.1 Employee dashboard: my info

Data: `GET /me` (employment summary) and `GET /me/profile` (contact details). The two load in parallel, and each card has its own loading and error states.

```
 Good morning, Priya
┌─ Employment ───────────────────────┐ ┌─ Contact ───────────────────────┐
│ E000123 · Active                   │ │ Preferred name  Anu             │
│ Software Engineer, Platform        │ │ Personal email  anu@gmail.com   │
│ Acme India Pvt Ltd · India         │ │ Phone           +91 98000 00000 │
│ Manager: Ravi Kumar                │ │ Date of birth   1 May 1990      │
└────────────────────────────────────┘ └─────────────────────────────────┘
┌─ Addresses ────────────────────────┐ ┌─ Emergency contacts ────────────┐
│ Home                               │ │ Ravi · spouse · Primary         │
│ 12 MG Road, Bengaluru KA 560001,   │ │ +91 98111 11111                 │
│ India                              │ │                                 │
└────────────────────────────────────┘ └─────────────────────────────────┘
```

| Card | Source | Empty state |
|---|---|---|
| Employment | `me.employment` (`employee_number`, `status`, `job_title`, `team`, `legal_entity`, `country`, `manager`) | `employment` is `null` → "No current employment on record." |
| Contact | profile: `preferred_name`, `email`, `phone_number`, `dob`, `gender`, `full_name` | Missing values show "—". |
| Addresses | `profile.addresses[]` | "No addresses yet." |
| Emergency contacts | `profile.emergency_contacts[]` (primary first, as the API returns them) | "No emergency contacts yet." |

- `status` renders as a `StatusBadge`: active (green), on notice (amber), separated (grey).
- Phase 1 is read-only. Edit buttons on Contact, Addresses and Emergency contacts come in phase 2 (`PATCH /me/profile`).
- Salary is **not** shown: `/me` has no salary, and `/me/compensations` isn't built.

### 3.2 HR dashboard: employee search and new hire

```
 Employees                                               [ + New hire ]
┌─────────────────────────────────────────────────────────────────────┐
│ [🔍 Search name, employee #, email…        ]                        │
│ Country [All ▾]  Status [Active & on notice ▾]  Type [All ▾]        │
├──────────┬──────────────────┬────────────────────┬──────┬──────────┤
│ Emp #    │ Name             │ Job · Team         │ Ctry │ Status   │ Salary        │
├──────────┼──────────────────┼────────────────────┼──────┼──────────┤
│ E000123  │ Priya Sharma     │ SWE · Platform     │ IN   │ Active   │ ₹18,50,000    │
│ E000456  │ John Smith       │ EM · Payments      │ US   │ On notice│ $185,000      │
└──────────┴──────────────────┴────────────────────┴──────┴──────────┘
 Showing 1–25 of 9,412                                  ‹ 1 2 3 … ›
```

Data: `GET /employees?q=&country=&status=&employment_type=&page=&per_page=25`.

- **The URL holds the search state** (`/dashboard?q=pri&country=IN&page=2`), so reload, back and shared links work. The page reads the filters from `useSearchParams`, and that state is the query key.
- **Search box:** debounced 300 ms, and any change resets `page` to 1. The API matches name prefix, typos, employee number and work email.
- **Filters:**
  - Country comes from `GET /countries`.
  - Status: "Active & on notice" (the default; no param sent), "Active", "On notice", "Separated" or "All" (`status=all`).
  - Employment type: full time, part time, contractor or intern.
- **Rows:**
  - Name shows `person.display_name`, with `full_name` underneath when it differs.
  - Job · Team uses `job.title` and `team.name`.
  - Salary uses `annual_salary`, formatted in its own currency (§7).
  - Rows aren't clickable in phase 1. They'll link to `/employees/:employmentId` once that page exists.
- **Pagination:** from `meta.total_count`, 25 per page.
- **Page states:**
  - The first load shows table skeleton rows.
  - A refetch keeps the previous rows dimmed (`placeholderData: keepPreviousData`) so the table doesn't flash.
  - An error shows a message and a "Retry" button.
  - No results with a search shows "No employees match 'xyz'." and a "Clear filters" button.
- **"+ New hire"** → `/employees/new`.

## 4. New hire (`/employees/new`)

One page, four sections, one submit. `POST /employment_actions` with `action_type: "hire"`.

```
 ← Employees   New hire
┌─ Person ────────────────────────────────────────────────────────────┐
│ First name* [______]  Last name [______]  Preferred name [______]   │
│ Personal email [______________]  Phone [______________]             │
│ Date of birth [____-__-__]  Gender [Select ▾]                       │
├─ Employment ────────────────────────────────────────────────────────┤
│ Legal entity* [Acme India Pvt Ltd (IN · INR) ▾]                     │
│ Start date* [2026-12-01]  Type* [Full time ▾]  Notice (days) [60]   │
│ Work email [______________]                                         │
├─ Role ──────────────────────────────────────────────────────────────┤
│ Position* [Software Engineer, Platform (IN) · 2 open ▾]             │
│ Grade* [G2 ▾]  (allowed for this job: G1–G3)                        │
│ Manager [🔍 search employees… ]                                     │
├─ Pay ───────────────────────────────────────────────────────────────┤
│ Annual salary* [ 1850000 ] INR   Pay frequency* [Monthly ▾]         │
│ Band for G2 in India: ₹8,40,000 – ₹14,00,000                        │
├─ Notes ─────────────────────────────────────────────────────────────┤
│ Reason [Backfill for …]                                             │
└─────────────────────────────────────────────────────────────────────┘
                                             [ Cancel ]  [ Create hire ]
```

### 4.1 Fields and where the options come from

| Section | Field (payload path) | Control | Source / rule |
|---|---|---|---|
| Person | `person.first_name`* | text | |
| | `person.last_name`, `person.preferred_name` | text | |
| | `person.email` | email | personal email, unique |
| | `person.phone_number` | tel | E.164, e.g. `+919800000000` |
| | `person.dob` | date | |
| | `person.gender` | select | `female`, `male`, `non_binary`, `undisclosed` |
| Employment | `employment.legal_entity_id`* | select | `GET /legal_entities`, labelled "name (IN · INR)" |
| | `effective_date`* (hire date) | date | defaults to today |
| | `employment.employment_type`* | select | `full_time`, `part_time`, `contractor`, `intern` |
| | `employment.notice_period_days` | number | |
| | `employment.work_email` | email | |
| Role | `assignment.position_id`* | select | `GET /positions?legal_entity_id=&as_of=<effective_date>&per_page=100`, labelled with name and vacancies. Disabled until an entity is chosen. |
| | `assignment.grade_id`* | select | `GET /grades`, limited to the position's job range (`job.min_grade.rank`..`max_grade.rank`, from `GET /jobs`). Disabled until a position is chosen. |
| | `assignment.reports_to_employment_id` | async search | `GET /employees?q=&per_page=10`. Shows name, employee number and job. |
| Pay | `compensation.annual_salary.amount`* | decimal text | Sent as a string, e.g. `"1850000.00"`. Never a float. |
| | `compensation.annual_salary.currency` | read-only | The chosen entity's `country.currency`. The user can't edit it. |
| | `compensation.pay_frequency`* | select | `monthly`, `semi_monthly`, `bi_weekly`, `weekly`. Defaults to `monthly`. |
| | (hint) | text | `GET /salary_bands?country=&grade_id=&as_of=`: "Band for G2 in India: min – max". It only informs. |
| Notes | `reason` | textarea | |

Dependent fields:
- Changing the legal entity clears the position and grade, and updates the currency.
- Changing the position clears the grade if it's outside the new job's range.
- Changing the start date refetches positions for that date and keeps the chosen position if it's still open.

### 4.2 Submit and results

- Client checks (Zod): required fields, email formats, the salary amount matches `^\d+(\.\d{1,2})?$` and is greater than 0, and the notice period is a whole number ≥ 0.
- **`201`:**
  - Invalidate `["employees"]`.
  - Go to `/dashboard` with a success toast: "Hired Priya Sharma as E000123."
  - If the response has `warnings` (for example, a salary outside the band), show them in the toast in amber.
- **`422 validation_failed`:** `details` keys are payload paths (`person.email`, `assignment.grade`, `compensation.annual_salary.currency`).
  - Each key maps to a form field with `setError`; `assignment.grade` maps to `assignment.grade_id`, and the same goes for other `*_id` fields.
  - Keys that don't match a field go into a `FormErrorSummary` at the top of the form.
  - The page scrolls to the first error.
- **`422 conflicting_record`** and other errors → a message in `FormErrorSummary`. The form keeps its input.
- **Cancel:** if the form has changes, ask "Discard this new hire?" before leaving.
- Not in phase 1: rehire of an existing person (`person_id`) and `create_user` (the API doesn't build the invite yet).

## 5. Components

```
src/
  pages/
    LoginPage, ForgotPasswordPage, ResetPasswordPage
    DashboardPage        → EmployeeDashboard | HrDashboard
    ProfilePage          (renders MyInfo)
    NewHirePage
    NotFoundPage, ForbiddenPage
  components/
    layout/   AppShell, AuthLayout, UserMenu, RequireAuth, RequireRole
    auth/     LoginForm, ForgotPasswordForm, ResetPasswordForm
    me/       MyInfo, EmploymentSummaryCard, ContactCard, AddressList, EmergencyContactList
    employees/EmployeeSearchBar, EmployeeFilters, EmployeeTable, EmployeeRow, EmployeePicker (async manager search)
    hire/     HireForm, PersonSection, EmploymentSection, RoleSection, PaySection, SalaryBandHint
    ui/       Button, TextField, SelectField, DateField, MoneyInput, Card, Table, Pagination,
              StatusBadge, Money, Spinner, Skeleton, ErrorState (with retry), EmptyState,
              FormErrorSummary, Toast, ConfirmDialog
```

- `components/` get data through props and never fetch. The exception is `EmployeePicker`, which takes a `useSearch` hook as a prop so it stays testable.
- `HireForm` owns the React Hook Form instance. Each section gets `control` and the option lists it needs. `NewHirePage` loads the reference data and does the submit.

### Hooks and query keys

| Hook | Query key | Endpoint |
|---|---|---|
| `useCurrentUser` | `["me"]` | `GET /me` |
| `useMyProfile` | `["me", "profile"]` | `GET /me/profile` |
| `useSignIn`, `useSignOut` | — | `POST` / `DELETE /session` |
| `useRequestPasswordReset`, `useResetPassword` | — | `POST /passwords`, `PUT /passwords/:token` |
| `useEmployees(filters)` | `["employees", filters]` | `GET /employees` |
| `useCountries`, `useLegalEntities`, `useGrades`, `useJobs` | `["countries"]` etc. | reference data, `staleTime: 1h` |
| `usePositions({legalEntityId, asOf})` | `["positions", {…}]` | `GET /positions` |
| `useSalaryBand({country, gradeId, asOf})` | `["salary_bands", {…}]` | `GET /salary_bands` |
| `useCreateHire` | — | `POST /employment_actions`. Invalidates `["employees"]` on success. |

## 6. API client and auth

Per AGENTS.md §4, `src/api/client.ts` is the only place that calls `fetch`. It:
- prefixes `/api/v1` (Vite proxies `/api` to `http://localhost:3000`)
- converts snake_case ↔ camelCase
- throws `ApiError` (`status`, `code`, `message`, `details`) on non-2xx responses
- returns `null` for `204`
- on any `401` (except from `POST /session`), clears the query cache and redirects to `/login?next=…`

The API facts that settle AGENTS.md's `TODO(team)` items:
- **Errors:** `{"error": {"code", "message", "details": {"field.path": [...]}}}`, not `{"errors": …}`.
- **IDs:** UUID strings.
- **Pagination:** `?page=&per_page=` (max 100), with `meta: {page, per_page, total_count}` in the body.
- **Routes:** under `/api/v1`.

**Auth: httpOnly cookie sessions (decided).**
- `POST /session` sets a signed, httpOnly, `SameSite=Lax` `session_token` cookie. The client ignores the `token` in the body and never stores anything auth-related.
- Every request uses `credentials: "include"`, and the client also sends `X-Requested-With: XMLHttpRequest` on every request. The API rejects cookie-authenticated writes without it (`403 csrf_failed`).
- "Am I signed in?" is answered by `GET /me` (`useCurrentUser`).
- In dev, Vite proxies `/api` to `http://localhost:3000`, so the browser sees one origin.

## 7. Formatting

- **Money:** `Intl.NumberFormat(locale, {style: "currency", currency})`, with the locale picked by currency (`INR` → `en-IN`, which groups as ₹18,50,000; `USD` → `en-US`; `AUD` → `en-AU`). The amount string is converted to a number only for display, and amounts are never added up across currencies.
- **Dates:** ISO strings in types, formatted for display only (`1 May 2026`). Date inputs send `YYYY-MM-DD`.
- **Enums:** a single label map (`full_time` → "Full time", `on_notice` → "On notice").

## 8. Testing (AGENTS.md §9)

- MSW handlers for every endpoint used, each covering success, `422` and `401`.
- **Page tests:**
  - Login: success redirect, `?next=`, wrong password, 429.
  - Forgot and reset password: the neutral message, invalid token.
  - Dashboard: picks the view by role, and each card's empty states.
  - Search: the debounce updates the URL, and pagination works.
  - New hire:
    - dependent selects clear correctly
    - the payload shape matches §3.2 of api-design.md
    - 422 details map onto the right fields
    - warnings appear in the toast
