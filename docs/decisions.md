# Decisions

Each entry records a decision, why it was made, and what follows from it, so the reasoning doesn't have to be reconstructed from code. Entries are in the order they were made (25–26 Nov 2026). The design docs say *what* the system does; this file says *why*.

- [api-design.md](api-design.md): API endpoints and payloads
- [domain-model.md](domain-model.md): entities and rules
- [web-design.md](web-design.md): the web app's pages

## Summary

| # | Decision | Area |
|---|---|---|
| D1 | Reference data is read-only lists; salary bands are HR-only | API |
| D2 | Positions report filled head count and vacancies, computed in SQL | API |
| D3 | The demo org is its own idempotent seeder that only fills in what's missing | Seeds |
| D4 | The dev logins are real employees, created through the domain services | Seeds |
| D5 | The web app authenticates with an httpOnly session cookie; bearer tokens remain for scripts | Auth |
| D6 | CSRF protection is a required `X-Requested-With` header on cookie-authenticated writes | Auth |
| D7 | Frontend: AGENTS.md stack, plain CSS, no component library | Web |
| D8 | One API client converts keys, raises `ApiError` and handles 401 globally | Web |
| D9 | Money stays a string end to end; each currency is formatted in its own locale | Web |
| D10 | Server validation errors map onto form fields by path | Web |
| D11 | Profile edits send only permitted fields, with removed rows last | Web |
| D12 | A profile form keeps the copy it opened with; a 404 on save is a conflict | Web |
| D13 | HR dashboard tabs: Employees (default) \| Reports | Web |
| D14 | Each report has its own filters and runs only on Go | Web |
| D15 | Charts follow the dataviz method; nothing is added across currencies | Web |
| D16 | Employment changes use the existing actions API and send only what changed | Web |
| D17 | The logo is the full artwork in light mode, icon plus text in dark mode | Web |
| D18 | Branch before committing; keep the user's work in separate commits | Process |
| D19 | Verify against real data without leaving any behind | Process |

---

## API

### D1. Reference data is read-only lists; salary bands are HR-only

**Context.** The hire form and filters needed countries, legal entities, teams, grades, jobs and positions, and no endpoints existed for them.

**Decision.**
- **Lists:** `GET /countries`, `/locations`, `/legal_entities`, `/teams`, `/grades`, `/jobs`, `/positions` and `/salary_bands`, with index actions only.
- **Who can read:** any signed-in user, except `/salary_bands`, which is HR-only because it reveals pay ranges.
- **Shared filters:**
  - `include_inactive=true` shows deactivated records.
  - `country` is an ISO code; an unknown one returns `422`.
  - Flags go through `boolean_param`, which returns `422` for anything but `true/1/false/0`.
- **Teams:** returned flat with `parent_id`, or nested with `?tree=true`.

**Why.** Every page needs reads; HR-only writes can come later without changing these routes. The design doc already said only HR writes reference data.

**Consequences.**
- There is still no UI to create or edit reference data.
- Address JSON is shared through `AddressSerializer`, so legal entities and profiles return the same shape.

### D2. Positions report filled head count and vacancies, computed in SQL

**Decision.**
- `GET /positions` is paginated, unlike the other reference lists.
- It returns positions open on `as_of`, with `filled_head_count` and `vacancies`.
- `filled_head_count` is a correlated subquery counting primary assignments active on `as_of`. That lets `vacant=true` filter before pagination (`PositionSearch`).

**Why.** The number of positions grows with the org; the other lists stay small. Computing vacancies in Ruby after pagination would have made `vacant=true` paging wrong.

---

## Seeds

### D3. The demo org is its own idempotent seeder that only fills in what's missing

**Context.** The org (grades, teams, entities, bands, jobs, positions) was built inside the bulk employee seeder, which skips everything once any employment exists. Existing dev databases could never pick up new reference data.

**Decision.**
- `Seeds::ReferenceData` finds records by natural key (code, name, city), creates what's missing, and fills blank fields such as job descriptions. It never overwrites existing values.
- `bin/rails db:seed` always runs it in development. `bin/rails db:seed:reference_data` runs it alone.
- `Seeds::Employees` builds on the org it returns.
- It also adds registered addresses for each legal entity, a second office per country, and a few open and remote positions, so vacancies show up.

**Why.** Seeds must be safe to re-run on a database people have been using.

### D4. The dev logins are real employees, created through the domain services

**Context.** The HR login was an empty "HR Admin" person. The employee login was attached to whichever employee the bulk seed made first.

**Decision.** `Seeds::DevAccounts` sets up both logins.
- **The two people:** HR is Ananya Iyer (HR Generalist). The employee is Priya Sharma (Software Engineer), who reports to an Engineering Manager.
- **History:** each has hire, salary and promotion history, addresses and emergency contacts.
- **How rows are made:** through `EmploymentActions::Create` and `Profiles::Update`, never written directly.
- **Existing databases:** logins that older seeds attached to other people are re-linked, and the unused "HR Admin" person is removed.
- **Order in `seeds.rb`:** logins, then the org, then the bulk employees, then the logins' employments. The bulk seed skips itself once any employment exists, so the logins must be hired after it.

**Why.**
- Going through the services means the data obeys every domain rule and gets an audit trail, as CLAUDE.md requires.
- The UI needs a realistic person to show on every page.

---

## Authentication

### D5. The web app authenticates with an httpOnly session cookie; bearer tokens remain for scripts

**Context.** AGENTS.md requires that the frontend never sees or stores a token. The API only issued bearer tokens. Keeping the token in memory would sign users out on every reload, and keeping it in `sessionStorage` breaks AGENTS.md §8.

**Decision.**
- **The cookie:** `POST /session` also sets a signed, httpOnly `session_token` cookie: `SameSite=Lax`, `Secure` in production, expiring with the session. `DELETE /session` clears it.
- **Reading credentials:** `Authentication` reads a bearer token first, then the cookie. An expired or invalid cookie is cleared.
- **The token in the body:** still returned for curl and scripts. The web app ignores it.
- **CORS:** allows credentials.
- **Development:** Vite proxies `/api` to Rails, so the browser sees one origin.

**Why.** An httpOnly cookie keeps the token out of JavaScript, and survives a reload. Bearer tokens keep `test.md` and scripts working.

**Consequences.**
- Production should serve the web app and API from the same site (e.g. `app.` and `api.` subdomains). A cross-site deployment would need a different `SameSite` setting.

### D6. CSRF protection is a required `X-Requested-With` header on cookie-authenticated writes

**Decision.**
- **Which requests:** non-GET requests authenticated by the cookie must send `X-Requested-With: XMLHttpRequest`. Without it they get `403 csrf_failed`.
- **Exempt:** bearer-token requests and reads.
- **In the client:** `web/src/api/client.ts` sends the header on every request.

**Why.** A cross-site page can't add a custom header without a CORS preflight, and only `WEB_ORIGINS` pass that preflight. That's simpler than a token round-trip, and enough on top of `SameSite=Lax`.

---

## Web app

### D7. Frontend: AGENTS.md stack, plain CSS, no component library

**Decision.**
- **Stack:** React 19, Vite, TypeScript in strict mode, TanStack Query, React Router, React Hook Form with Zod, and Vitest with Testing Library and MSW.
- **Styling:** plain CSS with design tokens and a dark mode, and no UI or chart library. Charts are hand-written SVG.

**Why.** AGENTS.md forbids adding dependencies without asking. The UI is small enough that a component library would cost more than it saves.

**Consequences.**
- **Bundle size:** about 156 KB gzipped, which trips Vite's size warning. Route splitting is the fix when it matters.
- **Pages fetch, components don't:** the exceptions are the route guards and `EmployeePicker`, which receives its search through props.

### D8. One API client converts keys, raises `ApiError` and handles 401 globally

**Decision.** `client.ts` is the only code that calls `fetch`.
- **Keys:** converts snake_case and camelCase both ways. Error detail paths become camelCase too, e.g. `person.firstName`.
- **Errors:** throws `ApiError` (`status`, `code`, `details`), and returns `null` for `204`.
- **A 401:** calls one handler, which clears the cache, records the user as signed out (`["me"] = null`), and sends them to `/login?next=…`.
- **"Am I signed in?"** `GET /me` returns `null` on a 401 instead of throwing, so the route guards decide without a redirect loop.
- **After sign-in:** `RedirectIfSignedIn` sends the user to `?next=`. Only same-app paths are allowed (`safeNext` rejects `//` and `/\`).

**Why.** Handling auth once avoids repeating it in every page. Recording "signed out" in the cache stops guards from refetching `/me` and racing the navigation.

### D9. Money stays a string end to end; each currency is formatted in its own locale

**Decision.**
- **Amounts:** stay decimal strings everywhere. Form input becomes `"1850000.00"` through string handling (`toDecimalString`), never through float rounding. A string is converted to a number only to display it.
- **Formatting by currency:**
  - INR uses `en-IN` (₹18,50,000).
  - USD and AUD use `en-US`, so Australian dollars print as `A$` and can't be mistaken for US dollars on the same screen.
  - Charts and totals use compact notation: ₹936.2Cr, $352M.

**Why.** This matches the API's rule that amounts are strings and never floats. Australian dollars would otherwise show as a bare "$" next to US amounts in reports.

### D10. Server validation errors map onto form fields by path

**Decision.** `applyServerErrors` puts each `422` detail on its form field.
- **Path forms:** `addresses[1].line1` matches `addresses.1.line1`, and `assignment.grade` matches `assignment.gradeId`.
- **Aliases:** a per-form list covers other names, e.g. `compensation.annual_salary_cents` → `compensation.amount`.
- **Unmatched errors** go to a summary at the top of the form.

**Why.** The API keys errors by model attribute and submitted position, not by form field name.

**Shared form parts.** `RoleSection` (position and grade) takes already-registered field props, so the hire form and the change form share it.

### D11. Profile edits send only permitted fields, with removed rows last

**Decision.**
- **Which fields:** employees send `preferred_name`, `email`, `phone_number`, addresses and emergency contacts. HR also send legal name, date of birth and gender. Fields the user may not change are never sent, because the API answers `403 forbidden_fields`.
- **Row order:** rows on screen are sent in screen order. Removed rows are appended last as `{id, _destroy: true}`.
- **Primary contact:** a radio button, so at most one contact is primary.

**Why.** The API keys nested errors by submitted position. Putting removed rows last keeps "row N" the same on screen and in the error.

**Known gaps (not fixed yet):**
- The client's email check is stricter than the API's.
- Once a contact is primary, it can't be made non-primary without removing a contact.

### D12. A profile form keeps the copy it opened with; a 404 on save is a conflict

**Context.**
- **The remount bug:** the edit pages re-keyed the form whenever the cached profile changed, so saving remounted it mid-save. Save came back enabled, and a second click sent a second save.
- **The 404:** the API checks nested ids before `lock_version`, so a stale form that references a deleted address gets `404`, not `409`.

**Decision.**
- **The opened copy:** `ProfileEditor` keeps the profile it was opened with, and the `lock_version` it sends comes from that copy. It remounts only when the user clicks "Reload their changes".
- **A 404 on save** is handled like a `409`: "Someone else changed this profile", with a reload.

**Why.**
- A background refetch must not reset the form or silently swap the `lock_version`. Swapping it would let one person's save overwrite another's without a conflict.
- To the user, the 404 means the same as the conflict.

### D13. HR dashboard tabs: Employees (default) | Reports

**Decision.**
- **Routes:** `/dashboard` is Employees and stays the default. `/dashboard/reports` is Reports, the right-hand tab.
- **Tabs are links**, so each has a URL and the back button works.
- **Access:** employees never see the tabs, and `RequireRole` hides HR pages. The API is what actually enforces roles.

**Why.** Existing links to `/dashboard` keep working, and HR's daily task (finding employees) stays one click away.

### D14. Each report has its own filters and runs only on Go

**Context.** Reports first refetched on every filter change. Next they ran together from one shared filter row. HR wanted each report independent and fetched only on demand.

**Decision.** The three reports are independent sections.

| Report | Filters |
|---|---|
| Salary by country | As of, type. No country filter: countries are shown side by side. |
| Salary by job title | Job title, as of, type |
| Salary spend | Year, and its own country filter |

- **On demand:** nothing is fetched until a section's Go is pressed. Go with unchanged filters refreshes.
- **Saved runs:** each section keeps its applied filters in the URL under its own keys (`stats_*`, `jobs_*`, `spend_*`). A link or the back button reruns only those reports.
- **Job title:** a dropdown of real titles from `/jobs`, sent to the API as `job_title`.

**Why.**
- Fewer requests, and each report answers a different question.
- The API matches job titles exactly. A dropdown always matches; free text would often return nothing.

### D15. Charts follow the dataviz method; nothing is added across currencies

**Decision.**
- **Never across currencies:** every figure belongs to one country, with no cross-country totals, charts or axes.
- **Salary by country:** stat cards, with the median as the lead figure.
- **Salary by job title:** a table per country, with a thin min–max range bar and a dot for the median.
- **Salary spend:** a column chart per country (one card each).
  - Columns use a single blue hue, are at most 24px wide with rounded tops, and have hairline gridlines.
  - The chart is drawn at the container's real pixel width, so marks and text don't scale.
  - Hover and keyboard focus show the amount, and there's a table view.
  - Months after today are absent, not zero.
- **Chart blue:** `#257de0` (light) and `#338ced` (dark), validated against the app's card surfaces with the palette validator.

**Why.** The API never sums across currencies, and the UI must not imply it does. The first render scaled a fixed drawing up and made the columns about 44px wide, which is why the chart now measures its container.

### D16. Employment changes use the existing actions API and send only what changed

**Decision.**
- **Endpoints:** increments (`salary_change`), promotions and internal transfers go through `POST /employment_actions`, and the history through `GET /employment_actions?employment_id=`. No API changes were needed.
- **Prefill:** the form starts from the current job and pay, and sends only changed fields. The API copies the rest from the current row; for example, a promotion keeps the manager.
- **Date rule:** a change must be dated after the latest change of the same kind, using the assignment date for role changes and the compensation date when pay is sent. An increment always sends pay, so its rule applies before a salary is typed.
- **Promotion:** must change the grade or the position. A grade that isn't higher shows a hint but doesn't block, because the API doesn't require it.
- **Transfer:** must choose a different position at the same legal entity. Moving entity is a separation plus a new hire. The manager can be changed on a transfer.
- **Who can change:** only `active` employments. On-notice and separated ones get an explanation instead of buttons.
- **History card:** works out "what changed" on the client by comparing each row with the previous row of its kind.

**Why.** It reuses the domain's single path for employment changes, and avoids sending fields that would trip validations that don't apply.

**Out of scope for now:**
- manager change and regrade as their own tabs
- correcting a past action (`PATCH /employment_actions/:id`)
- separation
- choosing a reviewer (there's no endpoint listing HR users)

### D17. The logo is the full artwork in light mode, icon plus text in dark mode

**Decision.**
- **Light mode:** the full logo, on the sign-in card and in the header.
- **Dark mode:** the icon plus "Employee Information" as text in the page colour, because the artwork's navy lettering disappears on a dark background.
- **Favicon and touch icon:** the icon on its own.
- **Image clean-up:** the white background was made transparent with smooth edges, so there's no halo on grey or dark backgrounds.

**Open.** The logo says "Employee Information" while the browser title says "Employee Information System".

---

## Process

### D18. Branch before committing; keep the user's work in separate commits

**Decision.**
- **Branching:** commits go on a short-lived branch, then fast-forward into `main` when asked. There are no merge commits.
- **The user's work:** in separate commits, e.g. the project rename and AGENTS.md, without the AI co-author line.
- **Mixed files:** split when practical, e.g. a stylesheet with changes for two features.

**Why.** The history stays readable, and authorship stays accurate.

### D19. Verify against real data without leaving any behind

**Decision.** Besides unit and page tests, changes were checked against the real API and dev data.

**Tests:**
- **Fixtures** match the API exactly (snake_case), so the key conversion is exercised too.
- **MSW** fails on any unhandled request. In msw 3 the option is `onUnhandledFrame: 'error'`; the older name was silently ignored.

**Real-data checks:**
- **Writes** went through the Vite proxy with the exact payloads the UI sends. Each test change was reverted afterwards (e.g. Priya's profile).
- **Employment actions** were posted inside a database transaction that was rolled back. Actions can't be deleted, so this left no trace.
- **Screenshots:** pages were rendered in a throwaway headless Chrome, in light and dark mode. This caught bugs the tests missed: chart scaling, a select that couldn't show its value before its options loaded, and a hint that appeared too early.
- **Cleanup:** test sessions were signed out and temporary browser profiles deleted.

**Why.** Several real bugs only showed up against real data or in a real render.

---

## Future work

### F1. Report (c) and the `employee_snapshots_on` rule (CLAUDE.md TODO #3)

**Status:** open. Decide before touching `Reports::SalarySpend` or the CLAUDE.md rule.

**The mismatch.**
- CLAUDE.md says employee lists *and reports* read from `employee_snapshots_on(as_of)`, through `EmployeeSnapshot.as_of(date)`.
- Reports (a) and (b) do. Report (c), salary spend (`Reports::SalarySpend`), doesn't: it queries `compensations → employments → legal_entities → locations → countries` directly.
- `docs/domain-model.md` already documents this exemption; CLAUDE.md doesn't.

**Why report (c) is different.**
- `employee_snapshots_on` returns **one row per employment for one date**: the assignment and compensation in force then.
- Spend needs **every compensation row overlapping the year**, each clipped to the year, to today and to the last working day, then prorated by days. Someone with a raise in April contributes two rows. A single-date snapshot can't express that, however it's called.

**Options.**

| Option | What it means | Cost |
|---|---|---|
| A. Reword the rule (recommended) | CLAUDE.md: "Employee lists and point-in-time reports ((a), (b)) read `employee_snapshots_on(as_of)`. Period reports such as (c) read the effective-dated rows directly, but still derive country only through the legal entity." | A doc change. The code already does this and is tested. |
| B. A second SQL function | Add `compensation_periods_in(from, to)`, returning one row per compensation row overlapping the period, already clipped and with country attached. Build report (c) on it and add it to the rule. Follow the existing pattern: drop and recreate the function in a migration, with a typed view for ActiveRecord. | A migration, a rewrite of `SalarySpend` on the function, and specs to prove the figures don't change. Worth it only if another period report (e.g. headcount over time, turnover) needs the same rows. |
| C. Build (c) on `employee_snapshots_on` | Call the snapshot once per month or day and add up the results. | Slower, and less accurate: it misses mid-month changes unless run daily. Rejected. |

**Recommendation: A now, B when a second period report is planned.**

What any change must keep:
- Country only through `Employment → LegalEntity → Location → Country`.
- Never summing across currencies.
- The total being the sum of the monthly amounts.
- Dates passed from Rails (`Date.current`), never the database's `CURRENT_DATE`.
- Brakeman at 0 warnings, with raw SQL in constant templates and bound values.

**Done when:**
- CLAUDE.md's rule matches the code.
- TODO #3 is removed.
- `docs/domain-model.md` and `docs/api-design.md` §2.7 agree.
- For option B, `spec/requests/api/v1/reports_spec.rb` passes unchanged against the new implementation.

## Still open

- **AGENTS.md:** its `TODO(team)` items (error format, IDs, pagination, CSRF) are answered in [web-design.md](web-design.md) §9 but not yet confirmed in AGENTS.md by a person.
- **Earlier known gaps:** CLAUDE.md lists #3 (report (c) doesn't read `employee_snapshots_on`; see F1) and #4 (report responses don't echo all their parameters).
- **Profile form:** D11's two gaps, W1 and W2 in CLAUDE.md.
- **Bundle size:** D7.
- **Employment actions:** the out-of-scope items in D16.
- **Branding:** the logo and title wording (D17).
