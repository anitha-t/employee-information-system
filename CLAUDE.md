# CLAUDE.md

An employee and salary management system for ~10k employees (scaling to 20k+) across India, the US and Australia.

## Repo layout

- `api/`: Rails 8.1 API-only backend (Ruby 3.4) with PostgreSQL. The Rails app module is `SalaryManagement`. Controllers live under `Api::V1`.
- `web/`: React SPA. Not scaffolded yet.
- `docs/`: design docs. **Read these before changing the schema or the API.**
  - [docs/domain-model.md](docs/domain-model.md): entities, rules, constraints, how the reports are computed
  - [docs/er-diagram.md](docs/er-diagram.md): ER diagram with columns
  - [docs/api-design.md](docs/api-design.md): endpoints, payloads, conventions
  - [docs/architecture.md](docs/architecture.md): system and request-flow diagrams, layer responsibilities

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
- Reports and employee lists read from the Scenic views `current_employee_snapshots` and `compensation_periods`.
- The salary-by-job report suppresses groups with fewer than 5 employees.

## Conventions

- All primary keys are UUIDs.
- The API lives at `/api/v1`, uses snake_case JSON and bearer-token auth.
- Editable tables have `lock_version`. A stale write returns `409`.
- Errors use the shape `{"error": {"code", "message", "details": {"field.path": [...]}}}`.
- Multi-table writes live in service objects (`app/services/`) and run in one transaction.
- Employee numbers come from a global Postgres sequence, formatted `E000123`.

## Commands

- `docker compose up -d` starts local PostgreSQL 18 on `localhost:5432`. The user, password and database default to `salary` / `salary` / `salary_management_development`. Override them in `.env` (see `.env.example`).
- `docker compose down` stops it. Add `-v` to also delete the data volume.

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
```

Before finishing any change: `bundle exec rspec` and `bin/rubocop` must both pass.
- **Coverage gates** are set in `api/.simplecov`: line ≥ 95%, branch ≥ 85%, and every file ≥ 80% lines. A run below these fails.
- **Tests:** new code comes with specs. Don't lower the coverage thresholds to make a run pass.
- **RuboCop:** fix offenses rather than adding `rubocop:disable` comments.

## API code conventions

- Schema format is **`db/structure.sql`**, not `schema.rb`, because the schema uses exclusion constraints, generated columns, sequences and views.
- Generators create UUID primary keys and RSpec specs and factories.
- Errors are rendered by `ApiErrorHandling` (`app/controllers/concerns/`). Raise ActiveRecord or Pundit errors instead of rendering them by hand.
- CORS allows `WEB_ORIGINS` (default `http://localhost:5173`) on `/api/*`.
- Audit versions are stored in jsonb (`object`, `object_changes`), plus `whodunnit`, `request_id` and `ip`.
- Enums are string columns declared with `string_enum` (`ApplicationRecord`). They are validated, and accept `allow_nil: true` for optional values.
- Effective-dated models include the `EffectiveDated` concern (`active_on(date)`, `current`, `open_ended`).
- `ApplicationRecord` uses `implicit_order_column = :created_at`, because UUID keys don't sort meaningfully.
- Overlap violations raise `ActiveRecord::ExclusionViolation`. Services should catch it and turn it into a 422.
- Model specs live in `spec/models`. Factories live in `spec/factories` (countries are reused through `find_or_initialize_by`).
