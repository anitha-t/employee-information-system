# Architecture

## System overview

```mermaid
flowchart LR
    subgraph Client["web/ — React SPA"]
        UI_EMP["Employee views<br/>My profile, my history, directory"]
        UI_HR["HR views<br/>Employees, actions, reference data, reports"]
    end

    subgraph API["api/ — Rails 8 (API-only)"]
        AUTH["Auth<br/>Session + bearer token"]
        CTRL["Controllers<br/>/api/v1/*"]
        POL["Pundit policies<br/>role: hr | employee"]
        SVC["Service objects<br/>EmploymentActions::Create / Update<br/>Profiles::Update<br/>Reports::*"]
        MDL["Models<br/>money-rails, pg_search,<br/>paper_trail"]
        JOBS["Solid Queue jobs<br/>daily status sweep, mailers"]
    end

    subgraph DB["PostgreSQL"]
        TBL[("Core tables<br/>UUID PKs, exclusion constraints")]
        VIEWS[("SQL function<br/>employee_snapshots_on(as_of)")]
        VER[("versions<br/>audit trail")]
        SQ[("Solid Queue / Cache tables")]
    end

    MAIL["SMTP<br/>invites, password reset"]

    Client -- "HTTPS JSON<br/>Authorization: Bearer" --> AUTH --> CTRL --> POL --> SVC --> MDL
    MDL --> TBL
    MDL --> VER
    SVC -- "reports" --> VIEWS
    VIEWS -. "reads" .-> TBL
    JOBS --> TBL
    JOBS --> MAIL
    JOBS --- SQ
```

## Request flow: employment action (for example, a promotion)

```mermaid
sequenceDiagram
    participant HR as HR (React)
    participant C as EmploymentActionsController
    participant P as Pundit
    participant S as EmploymentActions::Create
    participant DB as PostgreSQL

    HR->>C: POST /api/v1/employment_actions (Bearer)
    C->>P: authorize :create? (role == hr)
    C->>S: call(params, current_user)
    S->>DB: BEGIN
    S->>DB: insert employment_action
    S->>DB: close current assignment / compensation (effective_to = effective_date)
    S->>DB: insert new assignment / compensation (employment_action_id)
    Note over DB: exclusion constraints reject overlaps<br/>paper_trail writes versions (whodunnit)
    S->>DB: COMMIT
    C-->>HR: 201 action + created rows (+ warnings)
```

## Layer responsibilities

| Layer | Responsibility | Must not |
|---|---|---|
| Controllers | Parse params, `authorize`, call a service, render JSON | Hold business rules or write multiple tables |
| Policies (Pundit) | Role checks; per-field permits for profile (`employee` vs `hr`) | Query beyond the record and `current_user` |
| Services | Transactions across tables: actions, nested profile save, reports | Render responses |
| Models | Validations, associations, `monetize`, scopes, search | Cross-aggregate writes |
| SQL views | Point-in-time joins for reporting and employee lists | Be written to |
| Jobs | Daily `on_notice → separated` sweep, emails | Run user-triggered business logic synchronously |

## Key technology choices

| Concern | Choice |
|---|---|
| API framework | Rails 8, `--api` mode |
| Database | PostgreSQL (`pgcrypto` for UUIDs, `btree_gist` for exclusion constraints, `pg_trgm` for search) |
| Auth | Rails 8 authentication generator, adapted for bearer tokens |
| Authorization | Pundit |
| Money | `money-rails` (amount in cents plus currency) |
| Audit | `paper_trail` |
| Search | Postgres full-text (`tsvector`) plus `pg_trgm` similarity, done in SQL by `EmployeeSearch`. `pg_search` provides `Person.search`. |
| Employee list / reporting | SQL function `employee_snapshots_on(as_of)` (inlined by Postgres), read through `EmployeeSnapshot` |
| Background jobs | Solid Queue |
| CORS | `rack-cors`, which allows the React origin |
| Frontend | React SPA in `web/` |
