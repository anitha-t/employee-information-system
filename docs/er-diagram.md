# ER Diagram

Source of truth for column meanings and rules: [domain-model.md](domain-model.md).
All PKs are UUIDs. `lock_version` and timestamps are omitted from the diagram for readability.

```mermaid
erDiagram
    COUNTRY {
        uuid id PK
        string iso_code UK "IN, US, AU"
        string name
        string currency "INR, USD, AUD"
    }
    LOCATION {
        uuid id PK
        uuid country_id FK
        string state
        string city
        boolean is_active
    }
    LEGAL_ENTITY {
        uuid id PK
        uuid location_id FK "gives country"
        string name
        date effective_from
        date effective_to
        boolean is_active
    }
    ADDRESS {
        uuid id PK
        string addressable_type "Person | LegalEntity"
        uuid addressable_id
        string address_type "home, mailing, registered"
        string line1
        string line2
        string city
        string state
        string postal_code
        uuid country_id FK
    }
    TEAM {
        uuid id PK
        uuid parent_id FK
        string name
        boolean is_active
    }
    GRADE {
        uuid id PK
        string code UK
        string name
        integer rank
        boolean is_active
    }
    SALARY_BAND {
        uuid id PK
        uuid grade_id FK
        uuid country_id FK
        bigint min_cents
        bigint max_cents
        string currency
        date effective_from
        date effective_to
    }
    JOB {
        uuid id PK
        string code UK
        string title
        string level
        text description
        uuid min_grade_id FK
        uuid max_grade_id FK
        boolean is_active
    }
    JOB_COUNTRY {
        uuid job_id FK
        uuid country_id FK
    }
    POSITION {
        uuid id PK
        string code UK
        string name
        uuid job_id FK
        uuid team_id FK
        uuid legal_entity_id FK
        uuid location_id FK "null if remote"
        boolean is_remote
        integer required_head_count
        date effective_from
        date effective_to
    }
    PERSON {
        uuid id PK
        string first_name
        string last_name
        string preferred_name
        string full_name "generated"
        string email UK "personal"
        string phone_number "E.164"
        date dob
        string gender
        tsvector search_vector "generated, GIN"
    }
    EMERGENCY_CONTACT {
        uuid id PK
        uuid person_id FK
        string name
        string relationship
        string phone_number
        boolean is_primary
    }
    USER {
        uuid id PK
        uuid person_id FK,UK
        string email_address UK
        string password_digest
        string role "hr, employee"
    }
    SESSION {
        uuid id PK
        uuid user_id FK
        string token_digest UK
        string ip_address
        string user_agent
        datetime expires_at
    }
    EMPLOYMENT {
        uuid id PK
        uuid person_id FK
        uuid legal_entity_id FK "immutable"
        string employee_number UK "E000123"
        string employment_type
        string status "active, on_notice, separated"
        date hire_date
        integer notice_period_days
        date resignation_date
        date last_working_date
        string separation_type
        text separation_reason
        boolean eligible_for_rehire
        string work_email
    }
    EMPLOYMENT_ACTION {
        uuid id PK
        uuid employment_id FK
        string action_type
        date effective_date
        text reason
        uuid created_by_user_id FK
        uuid reviewed_by_user_id FK "informational"
        string review_decision "approved, rejected"
        datetime reviewed_at
    }
    ASSIGNMENT {
        uuid id PK
        uuid employment_id FK
        uuid employment_action_id FK
        uuid position_id FK
        uuid grade_id FK
        uuid reports_to_employment_id FK
        boolean is_primary
        date effective_from
        date effective_to
    }
    COMPENSATION {
        uuid id PK
        uuid employment_id FK
        uuid employment_action_id FK
        bigint annual_salary_cents
        string currency
        string pay_frequency
        date effective_from
        date effective_to
    }

    COUNTRY ||--o{ LOCATION : has
    COUNTRY ||--o{ SALARY_BAND : has
    COUNTRY ||--o{ JOB_COUNTRY : ""
    COUNTRY ||--o{ ADDRESS : ""
    LOCATION ||--o{ LEGAL_ENTITY : "registered in"
    LOCATION ||--o{ POSITION : "office of"

    PERSON ||--o{ ADDRESS : addressable
    LEGAL_ENTITY ||--o{ ADDRESS : addressable
    PERSON ||--o{ EMERGENCY_CONTACT : has
    PERSON ||--o| USER : "logs in as"
    USER ||--o{ SESSION : has

    TEAM ||--o{ TEAM : "parent of"
    TEAM ||--o{ POSITION : has
    JOB ||--o{ POSITION : "instantiated as"
    JOB ||--o{ JOB_COUNTRY : "available in"
    GRADE ||--o{ SALARY_BAND : "priced by"
    GRADE ||--o{ JOB : "min/max grade"
    GRADE ||--o{ ASSIGNMENT : "graded at"
    LEGAL_ENTITY ||--o{ POSITION : owns
    LEGAL_ENTITY ||--o{ EMPLOYMENT : employs

    PERSON ||--o{ EMPLOYMENT : has
    EMPLOYMENT ||--o{ EMPLOYMENT_ACTION : "changed by"
    EMPLOYMENT ||--o{ ASSIGNMENT : "effective-dated"
    EMPLOYMENT ||--o{ COMPENSATION : "effective-dated"
    EMPLOYMENT_ACTION ||--o| ASSIGNMENT : creates
    EMPLOYMENT_ACTION ||--o| COMPENSATION : creates
    POSITION ||--o{ ASSIGNMENT : "filled by"
    EMPLOYMENT ||--o{ ASSIGNMENT : "manager of (reports_to)"
    USER ||--o{ EMPLOYMENT_ACTION : "created / reviewed"
```

## Reporting path

```mermaid
flowchart LR
    C[Compensation] --> E[Employment] --> LE[LegalEntity] --> L[Location] --> CO[Country]
    E --> A["Assignment (primary, as_of)"] --> P[Position] --> J["Job.title"]
```
