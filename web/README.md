# web: Employee Information System frontend

React 19 + Vite + TypeScript SPA for the Rails API in `../api`.

- Read [`../AGENTS.md`](../AGENTS.md) before changing code.
- [`../docs/web-design.md`](../docs/web-design.md) describes the pages and components.

## Run

```sh
# API (from ../api): Postgres via docker compose, then
bin/rails db:seed && bin/rails s            # http://localhost:3000

# Web (from here)
npm install
npm run dev                                 # http://localhost:5173, proxies /api to :3000
```

Sign in with `hr@employee-information-system.local` or
`employee@employee-information-system.local`, password `dev-password-123`.

## Check

```sh
npm run lint && npm run typecheck && npm test
```

## How it fits together

- **Auth** is an httpOnly session cookie set by `POST /api/v1/session`. JavaScript never sees a token.
  - `src/api/client.ts` is the only place that calls `fetch`. It sends `credentials: "include"` and `X-Requested-With: XMLHttpRequest`; the API requires that header for cookie-authenticated writes.
  - It converts snake_case ⇄ camelCase and throws `ApiError`.
  - A 401 clears the query cache and goes to `/login?next=…` (`src/setup.ts`).
- **Data**: TanStack Query hooks in `src/hooks/`, with keys in `hooks/queryKeys.ts`.
- **Routes**: `src/routes.tsx`. `RequireAuth` reads `GET /me`, and `RequireRole` hides HR pages from employees. The API enforces roles either way.
- **Tests**: Vitest + Testing Library. The API is mocked with MSW (`src/test/server.ts`), and fixtures are snake_case like the real API.
