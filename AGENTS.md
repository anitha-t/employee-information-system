# AGENTS.md — React frontend for the Rails 8 API

Read this whole file before writing code. If something here conflicts with a request, ask before proceeding.
Lines marked `TODO(team)` need confirming by a human — do not guess their values.

## 1. Stack & commands

- React 19 + Vite, TypeScript (strict mode)
- Data fetching: TanStack Query v5
- Routing: React Router
- Forms: React Hook Form (+ Zod for validation)
- Tests: Vitest + React Testing Library; API mocked with MSW

| Task | Command |
|---|---|
| Install | `npm install` |
| Dev server | `npm run dev` (Vite on http://localhost:5173) |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Tests | `npm test` |

The Rails API runs separately on http://localhost:3000.

## 2. Folder layout

```
src/
  api/          # ALL network code lives here
    client.ts   # the only place fetch() is called
    auth.ts     # login / logout / current user
    <resource>.ts  # one file per Rails resource (users.ts, orders.ts, ...)
  hooks/        # useQuery/useMutation wrappers per resource (useOrders, useCreateOrder)
  components/   # presentational components: props in, JSX out, no fetching
  pages/        # route-level components: use hooks, handle loading/error/empty
  types/        # TypeScript types mirroring API JSON
```

## 3. Authentication (Rails 8 session auth — read carefully)

- `api/client.ts` is the only place `fetch` is called. It adds
  `Authorization: Bearer <token>` to every request. No `credentials: "include"`.
- **The token is held in memory only**, in one module (`api/auth.ts`) that exposes
  `getToken()`, `setToken(token, expiresAt)` and `clearToken()`.
  - Never write it to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL,
    or logs. Never put it in TanStack Query data or React state that gets serialized.
  - Nothing outside `api/auth.ts` and `api/client.ts` touches the token.
- **Consequence:** a page reload or a new tab starts signed out, and the user signs
  in again. This is intended. Don't work around it by persisting the token. If
  "stay signed in" is needed later, that's a backend change (for example an
  httpOnly refresh cookie): flag it, don't build it client-side.
- Treat the token as expired once `expires_at` (14 days, no sliding renewal) has
  passed.
- "Am I logged in?" means a token is in memory and `GET /me` succeeds.
- On any **401**: `clearToken()`, `queryClient.clear()`, redirect to `/login`.
  Do this once, in `api/client.ts`.
- On logout: `DELETE /session`, then `clearToken()`, `queryClient.clear()`, and
  navigate to `/login`.

### Dev setup: use the Vite proxy (no CORS in development)

Proxy API calls through Vite so the browser sees one origin and the session cookie just works:

```ts
// vite.config.ts
server: {
  proxy: {
    "/api": { target: "http://localhost:3000", changeOrigin: true },
  },
}
```

`TODO(team)`: confirm whether Rails routes are under `/api` (e.g. `/api/v1/...`) or at the root;
adjust the proxy prefix to match. Base URL comes from `import.meta.env.VITE_API_URL` (default `/api`).

### Production

- Prefer serving frontend and API from the **same site** (same domain, or subdomains like
  `app.example.com` + `api.example.com`). Rails' session cookie is `SameSite=Lax`, which will
  **not** be sent on cross-site fetches.
- If origins differ, the backend must configure `rack-cors` with the exact frontend origin and
  `credentials: true` (wildcard `*` is not allowed with credentials). That is a backend change — flag it, don't work around it.
- CSRF: cookie auth needs CSRF protection. `TODO(team)`: confirm the backend's approach
  (SameSite=Lax only, or a CSRF token header such as `X-CSRF-Token`). If a token is required,
  attach it in `api/client.ts` only.

## 4. API client rules (`src/api/client.ts`)

The client must:
1. Prefix the base URL.
2. Set `credentials: "include"` and `Content-Type: application/json`, `Accept: application/json`.
3. Parse JSON; on non-2xx throw an `ApiError` with `status` and parsed body.
4. Handle 401 globally (see §3).
5. Handle `204 No Content` (return `null`, don't parse).

### Rails conventions to respect

- **Keys are snake_case** in Rails JSON. Convert to camelCase in `client.ts` on the way in and
  back to snake_case on the way out, so components only ever see camelCase. Do not mix styles.
- **Validation errors** come back as **422** with a body like `{ "errors": { "email_address": ["is invalid"] } }`.
  `TODO(team)`: confirm the exact error shape. Map field errors onto React Hook Form with `setError`.
- **IDs**: treat as `number` unless the backend uses UUIDs (`TODO(team)`).
- **Timestamps** are ISO 8601 strings (`created_at`). Keep them as strings in types; format only for display.
- **Pagination**: `TODO(team)` — confirm style (page/per_page params, headers, or a `meta` object).

## 5. Data fetching & state

- Server data → TanStack Query only. **Never copy query data into `useState`** or a global store.
- Do **not** fetch in `useEffect`.
- One hook per operation in `src/hooks/` (e.g. `useOrders`, `useOrder(id)`, `useCreateOrder`).
- Query keys: `["orders"]`, `["orders", id]`, `["me"]` — consistent arrays, defined in one place per resource.
- After a mutation succeeds, `invalidateQueries` for the affected keys.
- Local UI state (open modal, input text) → `useState`. Truly global client state (theme) → Context.
- Every page that loads data must render all of: **loading**, **error** (with retry), **empty**, **success**.

## 6. Components

- Function components only. Keep them small; split when a file passes ~150 lines.
- `pages/` fetch data; `components/` receive props and don't fetch.
- Lists rendered with `.map()` use a stable `key` (the record `id`), never the array index.
- Never use `dangerouslySetInnerHTML` with API data.

## 7. Contract discipline

- Use only endpoints and fields documented in: `TODO(team)` (path to OpenAPI file, or `config/routes.rb` + serializers).
- **Do not invent endpoints, params, or fields.** If something needed is missing, stop and ask.
- Keep `src/types/` in sync with the API; when the API changes, update types first and fix type errors.

## 8. Security

- No secrets in frontend code or `VITE_*` env vars — everything in the bundle is public.
- No auth data in web storage (see §3).
- Don't log request bodies containing passwords.

## 9. Definition of done

- `npm run lint`, `npm run typecheck`, `npm test` all pass.
- New API functions have MSW-mocked tests covering success, 422, and 401.
- Loading / error / empty states checked manually in the browser; no console errors.
- Only the requested change is made — no unrelated refactors or dependency additions without asking.
