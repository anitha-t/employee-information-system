# CLAUDE.md

An employee and salary management system for ~10k employees (scaling to 20k+) across India, the US and Australia.

## Repo layout

- `api/`: Rails 8.1 API-only backend (Ruby 3.4) with PostgreSQL. The Rails app module is `EmployeeInformationSystem` (database names keep the original `salary_management_*` prefix). Controllers live under `Api::V1`.
- `web/`: React SPA (Vite, TypeScript). Read [AGENTS.md](AGENTS.md) before working there. Design: [docs/web-design.md](docs/web-design.md).
- `docs/`: design docs. **Read these before changing the schema or the API.**
  - [docs/domain-model.md](docs/domain-model.md): entities, rules, constraints, how the reports are computed
  - [docs/er-diagram.md](docs/er-diagram.md): ER diagram with columns
  - [docs/api-design.md](docs/api-design.md): endpoints, payloads, conventions
  - [docs/architecture.md](docs/architecture.md): system and request-flow diagrams, layer responsibilities
  - [docs/web-design.md](docs/web-design.md): web app pages, components and behaviour
  - [docs/decisions.md](docs/decisions.md): why things are the way they are (decision log). Add an entry for significant new decisions.

When the schema or the API changes, update the matching doc in the same change.

## Domain rules (do not break)

- **Country comes from the legal entity**: `Employment → LegalEntity → Location → Country`. Never use address or position location for reporting.
- **An employment's `legal_entity_id` never changes.** Moving entity = `separation` action + `hire` action for the same person.
- **Effective dating is half-open `[effective_from, effective_to)`**, where `effective_to = NULL` means open-ended. Postgres exclusion constraints (`btree_gist`) prevent overlaps for compensation and primary assignment.
- **Assignment and Compensation rows are created only by `EmploymentAction`s**, through `EmploymentActions::Create`. Corrections go through `EmploymentActions::Update`. Never write these rows directly from controllers.
- There is **no approval workflow**. Actions apply immediately. `reviewed_by_user_id` and `review_decision` are informational only.
- **Money**: `money-rails`, `annual_salary_cents` + `currency`. The currency must equal the legal entity's country currency. Never sum across currencies. Reports are always per country, in that country's currency. JSON format: `{"amount": "1850000.00", "currency": "INR"}` (the amount is a string, never a float).
- **Roles**: only `hr` (global, full access) and `employee` (own profile: `preferred_name`, `phone_number`, `email`, addresses, emergency contacts). Enforce roles in Pundit policies, not in controllers.
- **Audit**: `paper_trail` on all domain tables, with `whodunnit = current_user.id`.
- **Employee lists and reports** read from the SQL function `employee_snapshots_on(as_of)`, through `EmployeeSnapshot.as_of(date)`. Always pass the date from Rails (`Date.current`), never rely on the database's `CURRENT_DATE`. Postgres inlines the function, so filters push down. The `employee_snapshots` view exists only to give ActiveRecord column types. When changing the function, drop and recreate both in a migration.
- Salary reports include every employment with a compensation row active on `as_of`, and report every group whatever its size. They are HR-only.

## Conventions

- All primary keys are UUIDs.
- The API lives at `/api/v1` and uses snake_case JSON. Auth is an httpOnly session cookie (web app) or a bearer token (scripts).
- Editable tables have `lock_version`. A stale write returns `409`.
- Errors use the shape `{"error": {"code", "message", "details": {"field.path": [...]}}}`.
- Multi-table writes live in service objects (`app/services/`) and run in one transaction.
- Employee numbers come from a global Postgres sequence, formatted `E000123`.

## Commands

- **Whole stack in Docker:** `docker compose up -d --build` starts three services. Open http://localhost:8080 and sign in with a dev login (below).
  - `postgres`: PostgreSQL 18 on `localhost:5432`.
  - `api`: Rails in development mode, from `api/Dockerfile.dev`, on `localhost:3000`. On start, `bin/docker-dev-entrypoint` runs `db:prepare` and then the idempotent `db:seed`. The first start on an empty database seeds the 10,000 demo employees.
  - `web`: the built SPA, served by nginx from `web/Dockerfile` on `localhost:8080`. nginx proxies `/api` to the `api` service, so the session cookie is same-origin.
- **Database only:** `docker compose up -d postgres`, when you run `api/` and `web/` on the host.
- **Stopping:** `docker compose down`. Add `-v` to also delete the data volume.
- **Settings** (in `.env`, see `.env.example`):
  - the database user, password and name (default `salary` / `salary` / `salary_management_development`)
  - the ports (`POSTGRES_PORT`, `API_PORT`, `WEB_PORT`)
  - seeding (`SEED_ON_START`, `SEED_EMPLOYEES`)
- `api/Dockerfile` is the separate **production** image (Kamal / Thruster) and isn't used by compose.
- **Ports in use:** if you run Rails on the host (port 3000), stop the `api` container or change `API_PORT`.

Run API commands from `api/`. The host needs Homebrew `libpq` on `PATH`, both for the `pg` gem and because `structure.sql` is dumped with `pg_dump`:

```sh
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
bin/setup --skip-server     # bundle install + db:prepare
bin/rails db:migrate        # updates db/structure.sql (commit it)
bundle exec rspec           # tests + coverage report at coverage/index.html
COVERAGE=false bundle exec rspec spec/models/person_spec.rb   # single file, no coverage gate
bin/rubocop                 # lint (omakase + rspec, rspec_rails, factory_bot, performance)
bin/rubocop -a              # autocorrect safe offenses
bin/brakeman -q --no-pager  # security scan
bin/rails s                 # http://localhost:3000, health check at /up
bin/rails db:seed           # countries + demo org + 10,000 demo employees (skipped if any exist) + dev logins as employees (dev only)
bin/rails db:seed:replant   # wipe all data and reseed
bin/rails db:seed:employees COUNT=20000 SEED=42   # bulk demo employees at any size (refuses in production)
bin/rails db:seed:reference_data                  # demo org only: grades, teams, offices, entities, bands, jobs, positions (idempotent)
SEED_EMPLOYEES=0 bin/rails db:seed                # reference data and logins only
```

Run web commands from `web/` (Node 22+). `npm run dev` serves http://localhost:5173 and proxies `/api` to the Rails server on :3000:

```sh
npm install
npm run dev
npm run lint && npm run typecheck && npm test
```

Before finishing any change: `bundle exec rspec` and `bin/rubocop` must both pass. For `web/` changes, `npm run lint`, `npm run typecheck` and `npm test` must pass too.
- **Coverage gates** are set in `api/.simplecov`: line ≥ 95%, branch ≥ 85%, and every file ≥ 80% lines. A run below these fails.
- **Tests:** new code comes with specs. Don't lower the coverage thresholds to make a run pass.
- **RuboCop:** fix offenses rather than adding `rubocop:disable` comments.

## API code conventions

- Schema format is **`db/structure.sql`**, not `schema.rb`, because the schema uses exclusion constraints, generated columns, sequences and views.
- Generators create UUID primary keys and RSpec specs and factories.
- Errors are rendered by `ApiErrorHandling` (`app/controllers/concerns/`). Raise ActiveRecord or Pundit errors instead of rendering them by hand.
- **Authentication** (`Authentication` concern) is required by default. Opt out per action with `allow_unauthenticated_access only: ...`. `current_user` and `Current.session` come from the bearer token, or else from the signed `session_token` cookie set by `POST /session`. Cookie-authenticated non-GET requests must send `X-Requested-With: XMLHttpRequest`, otherwise they get `403 csrf_failed`.
- API controllers inherit `Api::V1::BaseController`, which runs `verify_authorized`. Every action must call `authorize` (Pundit), or explicitly `skip_after_action :verify_authorized`. Policies inherit the deny-by-default `ApplicationPolicy`, which provides `hr?`.
- **Audit trail:** paper_trail's whodunnit is set by `before_action :set_paper_trail_whodunnit`, which runs after authentication. paper_trail does not do this automatically.
- JSON bodies are **not** auto-wrapped (`wrap_parameters false`). Read params as documented, e.g. `params.expect(:email_address)`.
- Responses are built by POROs in `app/serializers` (`XSerializer.new(record).as_json`).
- **Field-level permissions:** policies expose `permitted_attributes`. Controllers raise `ForbiddenAttributesError` for disallowed fields, which renders as `403 forbidden_fields`. Never silently drop a field the user isn't allowed to send.
- **Profile edits** go through `Profiles::Update`. It always bumps the person's `lock_version`, so nested-only changes are also protected against concurrent edits.
- **Request-level validation** (payload shape, cross-record rules) raises `ValidationError` with `{"field.path" => [msgs]}`, which renders as `422 validation_failed`. Services in `app/services/employment_actions` prefix model errors with the payload section through `RecordErrors#with_section_errors`.
- **Employment actions** go through `EmploymentActions::Create` and `EmploymentActions::Update` only. These services lock the employment row, apply changes in date order, and never let effective-dated rows overlap. When moving a date, shrink the neighbouring row first and grow the other second.
- **Salary reports** live in `app/queries/reports` (`Reports::SalaryStats`, `Reports::SalarySpend`). They return `{…params, data: [per country]}` and never sum across currencies.
  - Raw SQL goes in constant templates with every value bound through `sanitize_sql_array`. Never interpolate runtime strings into SQL; Brakeman must stay at 0 warnings.
- Money in JSON goes through `MoneySerializer.call(money)`. List endpoints use the `Paginated` concern and return `{data, meta}`.
- `ActiveRecord::ExclusionViolation` renders as `422 conflicting_record`. The primary-emergency-contact constraint is `DEFERRABLE INITIALLY DEFERRED`. Specs that need it to fire must run `SET CONSTRAINTS … IMMEDIATE`, because test transactions never commit.
- **Reference data** (`/countries`, `/locations`, `/legal_entities`, `/teams`, `/grades`, `/jobs`, `/positions`, `/salary_bands`) is read-only and controllers inherit `ReferenceDataController` (`only_active`, `country`, `render_list`). Salary bands are HR-only, everything else is readable by any signed-in user (`ReferenceDataPolicy`). Flags go through `boolean_param`.
- **Dev logins** are seeded by `bin/rails db:seed` (development only, `db/seeds/dev_accounts.rb`). Both use password `dev-password-123`, and dev emails are written to `api/tmp/mails`.
  - `hr@employee-information-system.local` (HR) is Ananya Iyer, HR Generalist.
  - `employee@employee-information-system.local` (employee) is Priya Sharma, Software Engineer, who reports to an Engineering Manager.
  - Both are real employees with hire, salary and promotion history, addresses and emergency contacts, all created through `EmploymentActions::Create` and `Profiles::Update`.
  - The seeder is idempotent and re-links logins that older seeds attached to other people.
- **Demo org** (`db/seeds/reference_data.rb`, `Seeds::ReferenceData`): grades, teams, offices, legal entities with registered addresses, salary bands, jobs and positions, including some open or remote seats.
  - It is idempotent: it finds records by natural key and only creates or fills in what's missing, so `db:seed` tops up an existing dev DB.
  - `Seeds::Employees` builds on the org it returns.
- **Demo data** (`db/seeds/employees.rb`): names come from `db/seeds/first_names.txt` × `last_names.txt`.
  - Rows are built in memory and loaded with Postgres `COPY`, so validations and audit versions are skipped. The generator must keep the data valid itself, and `spec/seeds` checks it with model validations.
  - When changing the domain rules, update the generator too.
- CORS allows `WEB_ORIGINS` (default `http://localhost:5173`) on `/api/*`, with credentials.
- Audit versions are stored in jsonb (`object`, `object_changes`), plus `whodunnit`, `request_id` and `ip`.
- Enums are string columns declared with `string_enum` (`ApplicationRecord`). They are validated, and accept `allow_nil: true` for optional values.
- Effective-dated models include the `EffectiveDated` concern (`active_on(date)`, `current`, `open_ended`).
- `ApplicationRecord` uses `implicit_order_column = :created_at`, because UUID keys don't sort meaningfully.
- Model specs live in `spec/models`. Factories live in `spec/factories` (countries are reused through `find_or_initialize_by`).
- Controllers read query-string values through `QueryParams` (`string_param`, `string_params`, `date_param`, `integer_param`, `boolean_param`), never raw `params[...]`. Arrays and hashes (`?x[]=`, `?x[a]=`) return `422 "must be a single value"` instead of a 500.

## Known gaps (TODO)

The reasoning behind most of these is in [docs/decisions.md](docs/decisions.md) ("Still open" and the "Future work" entries). Remove an item here when it's fixed.

**API** (flagged in code review, 2026-11-25):

- **TODO (#3): the "reports read `employee_snapshots_on`" rule is out of date.**
  - The rule above says employee lists *and reports* read from `employee_snapshots_on(as_of)`. But `Reports::SalarySpend` (report c) queries `compensations → employments → legal_entities → locations → countries` directly, because it needs every compensation row overlapping the year, not one row per employment. `docs/domain-model.md` already describes this exemption.
  - Options and the recommendation (reword the rule to exempt report c, or build a period function) are in decisions.md **F1**. Decide there before changing the code or the rule.
- **TODO (#4): report responses don't echo all request parameters.**
  - The "Salary reports" rule says they return `{…params, data}`. In fact `salary_stats` and `salary_by_job` return only `as_of`, dropping `employment_type` and `job_title`. `salary_spend` returns `year` but not `country`.
  - Either echo the effective filters at the top level, or relax the rule. The web app doesn't rely on the echo: it shows the filters it sent.

**Web** (flagged in code review, 2026-11-26; see decisions.md D11):

- **TODO (W1): the profile form's email check is stricter than the API's.** Zod `z.email` rejects some addresses that `URI::MailTo::EMAIL_REGEXP` accepts (e.g. `ops@intranet`). A person with such an email can't save any other profile change. Match the API's rule, or validate email only when it changed.
- **TODO (W2): a primary emergency contact can't be unset.** The radio group has no "none" option, so the only way out is to remove the contact. Add a way to clear it, or decide that one primary is required.

**Other:**

- **TODO: AGENTS.md `TODO(team)` items are unconfirmed.** The error shape, UUID ids, pagination and the CSRF header are answered in `docs/web-design.md` §9, but a person needs to confirm them in AGENTS.md.
- **TODO: employment actions not yet in the web app.** These are manager change and regrade as their own tabs, correcting a past action (`PATCH /employment_actions/:id`), separation, and the reviewer fields. The reviewer fields need an endpoint that lists HR users. See decisions.md D16.
- **TODO: bundle size.** The web bundle is ~156 KB gzipped and trips Vite's 500 KB (minified) warning. Split routes (e.g. lazy-load the hire, change and reports pages) when it matters.
- **TODO: brand wording.** The logo reads "Employee Information" while the browser title is "Employee Information System". Pick one.
