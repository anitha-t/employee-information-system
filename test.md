# Testing the report APIs with curl

Manual checks for the three salary reports against the seeded development data
(10,000 employees). Requires `curl` and `jq`.

## 1. Start the server

In one terminal, from `api/`:

```sh
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
bin/rails s
```

The database must be running (`docker compose up -d` from the repo root) and seeded
(`bin/rails db:seed`).

## 2. Sign in as HR and save the token

In another terminal:

```sh
API=http://localhost:3000/api/v1
TOKEN=$(curl -s -X POST $API/session \
  -H 'Content-Type: application/json' \
  -d '{"email_address":"hr@salary-management.local","password":"dev-password-123"}' | jq -r .token)
echo $TOKEN
```

## 3. (a) Salary stats: min, max, average and median per country

```sh
# All countries, as of today
curl -s "$API/reports/salary_stats" -H "Authorization: Bearer $TOKEN" | jq

# One country
curl -s "$API/reports/salary_stats?country=IN" -H "Authorization: Bearer $TOKEN" | jq

# On a past date, full-time staff only
curl -s "$API/reports/salary_stats?country=US&as_of=2024-01-01&employment_type=full_time" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 4. (b) Salary by job title

```sh
# Every job title in Australia
curl -s "$API/reports/salary_by_job?country=AU" -H "Authorization: Bearer $TOKEN" | jq

# One job title across all countries (case-insensitive)
curl -s "$API/reports/salary_by_job?job_title=software%20engineer" -H "Authorization: Bearer $TOKEN" | jq

# Compact table: country, title, headcount, average
curl -s "$API/reports/salary_by_job?country=US" -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data[] | [.country, .job_title, .headcount, .average.amount] | @tsv'
```

## 5. (c) Salary spend in a calendar year

```sh
# Full year 2025, all countries
curl -s "$API/reports/salary_spend?year=2025" -H "Authorization: Bearer $TOKEN" | jq

# India 2025 with a monthly breakdown
curl -s "$API/reports/salary_spend?country=IN&year=2025&breakdown=month" -H "Authorization: Bearer $TOKEN" | jq

# This year so far (no year = current year, partial: true)
curl -s "$API/reports/salary_spend?country=US" -H "Authorization: Bearer $TOKEN" | jq
```

## 6. Error cases

```sh
# Unknown country -> 422
curl -s "$API/reports/salary_stats?country=XX" -H "Authorization: Bearer $TOKEN" | jq

# Year out of range -> 422
curl -s "$API/reports/salary_spend?year=1990" -H "Authorization: Bearer $TOKEN" | jq

# Parameter sent as a list -> 422 (-g stops curl treating [] as a pattern)
curl -sg "$API/reports/salary_stats?country[]=IN" -H "Authorization: Bearer $TOKEN" | jq

# No token -> 401
curl -s "$API/reports/salary_stats" | jq

# Signed in as an employee -> 403
EMP_TOKEN=$(curl -s -X POST $API/session -H 'Content-Type: application/json' \
  -d '{"email_address":"employee@salary-management.local","password":"dev-password-123"}' | jq -r .token)
curl -s "$API/reports/salary_stats" -H "Authorization: Bearer $EMP_TOKEN" | jq
```

## Tips

- Add `-w '\n%{http_code}\n'` to any command to print the HTTP status as well.
- Sign-in is limited to 10 attempts per 3 minutes per IP. On a `429`, wait a few
  minutes, or reuse `$TOKEN`, which stays valid for 14 days.
- Response shapes and parameters are documented in
  [docs/api-design.md](docs/api-design.md) §2.7.
