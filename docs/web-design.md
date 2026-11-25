# Web App Design

Status: **Phases 1–3 built** (`web/`)
Depends on: [api-design.md](api-design.md), [AGENTS.md](../AGENTS.md) (frontend rules)
Scope:
- **Phase 1:** sign-in, the dashboards and the HR "new hire" flow.
- **Phase 2:** editing profiles, and the HR employee detail and edit pages (§5).
- **Phase 3:** salary reports on the HR dashboard (§6).

## 1. Pages and routes

| Route | Page | Who | API |
|---|---|---|---|
| `/login` | Sign in | Signed out | `POST /session` |
| `/forgot-password` | Request a reset link | Signed out | `POST /passwords` |
| `/reset-password/:token` | Set a new password (link from the email) | Signed out | `PUT /passwords/:token` |
| `/` | Redirects to `/dashboard` | — | — |
| `/dashboard` | **Employee:** my info. **HR:** the Employees tab: search and "New hire". | Signed in | see §3 |
| `/dashboard/reports` | **HR:** the Reports tab | HR | `GET /reports/*` (§6) |
| `/profile` | My info (the employee dashboard view; HR reaches it from the user menu) | Signed in | `GET /me`, `GET /me/profile` |
| `/profile/edit` | Edit my profile | Signed in | `GET` / `PATCH /me/profile`, `GET /countries` (§5) |
| `/employees/new` | New hire form | HR | `POST /employment_actions` and reference data (§4) |
| `/employees/:employmentId` | Employee detail | HR | `GET /employees/:id`, `GET /people/:personId/profile` (§5) |
| `/employees/:employmentId/edit` | Edit an employee's profile | HR | `GET /employees/:id`, `GET` / `PATCH /people/:personId/profile` (§5) |
| `*` | Not found | — | — |

Routing rules:
- `<RequireAuth>` wraps every signed-in route. It reads `useCurrentUser()` (`GET /me`). While that loads it shows a full-page spinner. On `401` it sends the user to `/login?next=<path>`.
- `<RequireRole role="hr">` wraps HR-only routes. An employee who opens one sees a "You don't have access" page. This is a convenience only: the API enforces roles.
- A signed-in user who opens `/login`, `/forgot-password` or `/reset-password` is redirected to `/dashboard`.
- After sign-in: go to `next` if it is a same-app path (starts with `/`, not `//`), otherwise `/dashboard`.

Not planned yet: employment changes after hire (promotion, transfer, salary change, separation), the audit trail and the directory.

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
- `201` → the browser now holds the session cookie (§8). Invalidate `["me"]` and navigate as in §1.
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
- An "Edit profile" button opens `/profile/edit` (§5.1).
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
  - Salary uses `annual_salary`, formatted in its own currency (§9).
  - The name links to `/employees/:employmentId` (§5.2).
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

## 5. Profile editing and employee pages (phase 2)

### 5.1 The profile form (`/profile/edit` and `/employees/:employmentId/edit`)

Both pages use one `ProfileForm`. The only differences are which fields can be edited and where the form saves.

| | My profile (`/profile/edit`) | Employee (`/employees/:employmentId/edit`) |
|---|---|---|
| Loads | `GET /me/profile` | `GET /employees/:id`, then `GET /people/:personId/profile` |
| Saves | `PATCH /me/profile` | `PATCH /people/:personId/profile` |
| Legal name, date of birth, gender | Editable for HR, read-only for employees ("Contact HR to change these") | Editable |
| Afterwards | Back to `/profile`, toast "Profile saved." | Back to `/employees/:employmentId`, toast "Saved <name>'s profile." |

```
 ← My profile   Edit profile
┌─ Personal details ──────────────────────────────────────────────────┐
│ First name* [Priya ]  Last name [Sharma]  Preferred name [Priya ]   │
│ Date of birth [1994-02-11]  Gender [Female ▾]                       │
│ Personal email [priya.sharma@example.com]  Phone [+919900112233]    │
├─ Addresses ─────────────────────────────────────────────────────────┤
│ Type* [Home ▾]  Line 1* [12 MG Road]  Line 2 [Apartment 4C]         │
│ City* [Bengaluru]  State [KA]  Postal code [560001]  Country* [IN ▾]│
│                                                          [Remove]   │
│ [+ Add address]                                                     │
├─ Emergency contacts ────────────────────────────────────────────────┤
│ Name* [Ravi Sharma]  Relationship [sibling]  Phone* [+9198…]        │
│ (•) Primary contact                                      [Remove]   │
│ [+ Add contact]                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                                [ Cancel ]  [ Save ]
```

Fields:
- **Address types:** `home` or `mailing`. Required: type, line 1, city and country, with country from `GET /countries`.
- **Emergency contacts:** name and phone are required. "Primary contact" is a radio button, so at most one contact is primary.
- **Phone numbers:** E.164 format, e.g. `+919800000000`. The client checks the format, and so does the API.
- **Personal email:** optional, and must be a valid address.

Payload (api-design.md §3.1):
- `lock_version` is always the value the form loaded with.
- **Scalars:** employees send only `preferred_name`, `email` and `phone_number`. HR also send `first_name`, `last_name`, `dob` and `gender`. A field the user may not change is never sent, because the API answers `403 forbidden_fields`. Blank values are sent as `null`.
- **Nested arrays:**
  - Every row on screen is sent in screen order: existing rows with their `id`, new rows without one.
  - Rows the user removed are appended afterwards as `{id, _destroy: true}`.
  - The API keys errors by submitted position (`addresses[1].line1`). Because removed rows come last, that index is also the row's index on screen.

Results:
- **`200`:** the response is the new profile. It replaces the cached profile, and `["me"]` and `["employees"]` are invalidated (the display name may have changed). Then the user goes back.
  - The form keeps the profile it was opened with until it leaves, so the cache update doesn't reset it mid-save. The same copy supplies `lock_version`, so a background refetch can't swap it.
- **`422`:** `addresses[1].line1` maps to the field `addresses.1.line1`. Errors that don't match a field (e.g. `emergencyContacts` "can have only one primary contact") go to the summary.
- **`409 stale_object`, or `404`:** "Someone else changed this profile while you were editing." Nothing was saved.
  - A `404` means an address or contact on screen was deleted by someone else, because the API checks nested ids before `lock_version`. The fix is the same as for a conflict.
  - The "Reload" button refetches and remounts the form with the fresh copy, discarding these edits.
- **`403`** (a field the user may not change; shouldn't happen from this UI) goes in the summary.
- **Cancel** asks "Discard your changes?" when the form is dirty.

### 5.2 Employee detail (`/employees/:employmentId`, HR)

```
 ← Employees
 Priya Sharma                                        [ Edit profile ]
 E010002 · Active · Software Engineer, Platform
┌─ Employment ───────────────────────┐ ┌─ Pay ───────────────────────┐
│ Legal entity  Acme India Pvt Ltd   │ │ Annual salary  ₹15,00,000   │
│ Country       IN (INR)             │ │ Pay frequency  Monthly      │
│ Type          Full time            │ │ Since          1 Apr 2025   │
│ Hire date     3 Apr 2023           │ └─────────────────────────────┘
│ Grade         G3 (since 1 Apr 2025)│
│ Manager       Farhan Shah          │
│ Work email    priya.sharma@acme…   │
│ Notice period 60 days              │
└────────────────────────────────────┘
 Personal details · Addresses · Emergency contacts (same cards as "My info")
```

- **Data:** `GET /employees/:employmentId` for employment and pay, then `GET /people/:personId/profile` for the person cards.
- **Separations:** separated or on-notice employees also show the resignation date, last working day, separation type and reason, and rehire eligibility.
- **`404`** → "Employee not found." with a link back to the list.
- The manager's name links to the manager's own page.
- **Not here yet:** history and employment changes after hire. These come with the employment-actions UI.

## 6. Reports (HR dashboard, phase 3)

### 6.1 Tabs

The HR dashboard has two tabs, **Reports | Employees**. They are links, so each tab has its own URL and the browser's back button works.

| Tab | Route | Content |
|---|---|---|
| Reports | `/dashboard/reports` | This section |
| Employees | `/dashboard` (default) | §3.2, unchanged. Existing links and bookmarks keep working. |

Employees never see the tabs. `/dashboard/reports` is HR-only, like the API.

### 6.2 Layout

```
 [Reports] [Employees]                                                    
 Country [All ▾]  As of [2026-11-25]  Type [All ▾]  Year [2026 ▾]  Job title [filter…]
 Amounts are per country, in its own currency. They are never added across countries.

 Salary by country · as of 25 Nov 2026
 ┌─ India · INR ─────────────┐ ┌─ United States · USD ─────┐ ┌─ Australia · AUD ───┐
 │ Headcount 5,803           │ │ …                         │ │ …                   │
 │ Median ₹14,52,000         │ │                           │ │                     │
 │ Average ₹15,10,240        │ │                           │ │                     │
 │ Range ₹6,02,000–₹48,7…    │ │                           │ │                     │
 └───────────────────────────┘ └───────────────────────────┘ └─────────────────────┘

 Salary by job title · as of 25 Nov 2026
 India (INR)
 Job title             Headcount   Min      Median    Average    Max     Range
 Account Manager             512   ₹…       ₹…        ₹…         ₹…      ├──●──────┤
 …

 Salary spend · 2026 (1 Jan – 25 Nov, year to date)
 ┌─ India · INR ─────────────────────────────────────────────┐
 │ ₹936.2Cr total · 5,803 people paid                        │
 │ ▂▂▃▃▃▄▄▄▄▄▅  (monthly columns, hover for the amount)      │
 │ [Show table]                                              │
 └───────────────────────────────────────────────────────────┘
```

### 6.3 Data and filters

One filter row above the reports scopes all three, and the filter values live in the URL (`/dashboard/reports?country=IN&as_of=…&type=…&year=…&job=…`).

| Report | Endpoint | Filters used |
|---|---|---|
| Salary by country | `GET /reports/salary_stats?country=&as_of=&employment_type=` | country, as of, type |
| Salary by job title | `GET /reports/salary_by_job?country=&as_of=&employment_type=` | country, as of, type. The job-title box filters rows on the client (substring, ignoring case), because the API's `job_title` matches only an exact title. |
| Salary spend | `GET /reports/salary_spend?country=&year=&breakdown=month` | country and year. "As of" and type don't apply. |

- **Defaults:** all countries, as of today, all types, and the current year. The year list runs from 2016 (the earliest seeded hire) to this year.
- **Loading:** each report loads on its own. The first load shows a skeleton; a refetch keeps the previous figures on screen, dimmed. Each report has its own error message with a retry.
- **Zero headcount:** a country card says "No one paid on this date" instead of showing blank figures. Job titles with no one paid don't appear in the API response at all.

### 6.4 Presentation rules (from the dataviz guidance)

- **Never across currencies:** every figure belongs to one country. There is no cross-country total, chart or axis.
- **Salary by country:** stat tiles, one card per country. The median is the lead figure, with average and min–max below. No chart is needed for a handful of numbers.
- **Salary by job title:** a table per country, with a thin range bar per row. The track runs from that country's lowest to highest salary, with a dot for the median. The bar adds the shape of the range; the figures stay in the columns.
- **Salary spend:** one card per country, each with its own column chart of monthly spend.
  - **Columns:** a single blue series, ≤ 24px wide with a 4px rounded top. There's no legend, since the card title names the series.
  - **Axes:** hairline gridlines and compact currency ticks (₹82Cr, $1.2M).
  - **Hover and focus:** each column shows its month and exact amount.
  - **"Show table":** switches to a table of the months.
  - **Partial year:** the subtitle says "year to date", and months after today are absent, not shown as zero.
- **Chart colour:** blue `#257de0` (light) or `#338ced` (dark). Both pass the palette validator against the card surfaces (`#ffffff` and `#181e27`).
- **Text colour:** text uses the normal text colours, never the chart colour.

## 7. Components

```
src/
  pages/
    LoginPage, ForgotPasswordPage, ResetPasswordPage
    DashboardPage        → EmployeeDashboard | HrDashboard
    ProfilePage          (renders MyInfo)
    NewHirePage
    ProfileEditPage, EmployeeDetailPage, EmployeeEditPage, ProfileEditor (shared editor logic)
    ReportsPage
    NotFoundPage, ForbiddenPage
  components/
    layout/   AppShell, AuthLayout, UserMenu, RequireAuth, RequireRole
    auth/     LoginForm, ForgotPasswordForm, ResetPasswordForm
    me/       MyInfo, EmploymentSummaryCard, ContactCard, AddressList, EmergencyContactList
    employees/EmployeeSearchBar, EmployeeFilters, EmployeeTable, EmployeePicker (async manager search),
              EmploymentCard, PayCard
    profile/  ProfileForm, PersonalDetailsFields, AddressFields, EmergencyContactFields, profileSchema
    reports/  ReportFilters, CountryStatsCards, JobSalaryTable, SpendCards, MonthlySpendChart
    layout/   … HrTabs (Reports | Employees)
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
| `useEmployees(filters)` | `["employees", "list", filters]` | `GET /employees` |
| `useCountries`, `useLegalEntities`, `useGrades`, `useJobs` | `["countries"]` etc. | reference data, `staleTime: 1h` |
| `usePositions({legalEntityId, asOf})` | `["positions", {…}]` | `GET /positions` |
| `useSalaryBand({country, gradeId, asOf})` | `["salary_bands", {…}]` | `GET /salary_bands` |
| `useCreateHire` | — | `POST /employment_actions`. Invalidates `["employees"]` on success. |
| `useEmployee(id)` | `["employees", "detail", id]` | `GET /employees/:id` |
| `usePersonProfile(personId)` | `["people", personId, "profile"]` | `GET /people/:id/profile` |
| `useSalaryStats`, `useSalaryByJob` | `["reports", "salary_stats" \| "salary_by_job", filters]` | `GET /reports/salary_stats`, `/salary_by_job` |
| `useSalarySpend` | `["reports", "salary_spend", {country, year}]` | `GET /reports/salary_spend?breakdown=month` |
| `useUpdateProfile(target)` | — | `PATCH /me/profile` or `/people/:id/profile`. Caches the returned profile and invalidates `["me"]` and `["employees"]`. |

## 8. API client and auth

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

## 9. Formatting

- **Money:** `Intl.NumberFormat(locale, {style: "currency", currency})`, with the locale picked by currency.
  - `INR` → `en-IN`, which groups as ₹18,50,000.
  - `USD` and `AUD` → `en-US`, so Australian amounts print as `A$` and can't be mistaken for US dollars on the same screen.
  - Charts and totals use compact notation: ₹936.2Cr, $352M, A$225.7M. The amount string is converted to a number only for display, and amounts are never added up across currencies.
- **Dates:** ISO strings in types, formatted for display only (`1 May 2026`). Date inputs send `YYYY-MM-DD`.
- **Enums:** a single label map (`full_time` → "Full time", `on_notice` → "On notice").

## 10. Testing (AGENTS.md §9)

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
