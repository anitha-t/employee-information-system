# employee-information-system

## Setup

Run everything with Docker:

```sh
cp .env.example .env          # optional: change ports, credentials or seeding
docker compose up -d --build  # PostgreSQL, the Rails API and the web app
```

Then open http://localhost:8080. The first start seeds 10,000 demo employees, which takes a minute; follow it with `docker compose logs -f api`.

Sign in with either dev login. The password for both is `dev-password-123`.
- HR: `hr@employee-information-system.local`
- Employee: `employee@employee-information-system.local`

`docker compose down` stops the stack. Add `-v` to also delete the database.

To develop on the host instead, run only the database with `docker compose up -d postgres`. Then follow [CLAUDE.md](CLAUDE.md) for `api/` and [web/README.md](web/README.md) for `web/`.

## Usage

- [Testing the report APIs with curl](test.md)

## License
