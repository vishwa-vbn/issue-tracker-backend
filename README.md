# Issue Tracker – Backend API

REST API for the Issue Tracker System: user and admin authentication, issue management, assignment, status tracking, comments and dashboard counts.

|                   |                                                                  |
| ----------------- | ---------------------------------------------------------------- |
| **Live API**      | `https://<backend>.onrender.com/api/v1` _(replace after deploy)_ |
| **Live app**      | `https://<frontend>.vercel.app` _(replace after deploy)_         |
| **Frontend repo** | `https://github.com/<you>/issue-tracker-frontend`                |
| **Health check**  | `GET /api/v1/health`                                             |

> **Heads-up for reviewers:** the API runs on a free Render instance that sleeps after 15 minutes of inactivity. A monitor pings it every 5 minutes, but if the very first request is slow (~1 min), it is waking up.

### Demo credentials

| Role  | Email                   | Password      |
| ----- | ----------------------- | ------------- |
| Admin | `admin@example.com`     | `ChangeMe123` |
| User  | `demo.user@example.com` | `Passw0rdOK`  |

_(Demo data only. Rotate or remove after evaluation.)_

---

## Table of contents

1. [Features](#features) · 2. [Architecture](#architecture) · 3. [Tech stack](#tech-stack) · 4. [Getting started](#getting-started) · 5. [Environment variables](#environment-variables) · 6. [Scripts](#scripts) · 7. [API reference](#api-reference) · 8. [Security](#security) · 9. [Testing](#testing) · 10. [Deployment](#deployment) · 11. [Project documents](#project-documents)

---

## Features

- **Authentication** – register, login, logout, silent refresh with rotating refresh tokens
- **Admin login** – separate endpoint accepting only ADMIN accounts; admins are seeded, never self-registered
- **Issues** – create, edit, soft-delete, view; search, filter (status, priority, assignee, reporter), sort, paginate
- **Assignment** – assign / unassign any active user
- **Status tracking** – `OPEN` → `IN_PROGRESS` → `CLOSED` (and reopen) with a full activity timeline
- **Comments** – add, edit (author), delete (author or admin)
- **Dashboard** – totals, counts by status and priority, "mine", plus admin-only metrics
- **Admin user management** – list users, change role, activate/deactivate (with self and last-admin guards)
- **Role-based access control** enforced on the server for every action

---

## Architecture

```
React SPA (Vercel) ──/api/*──► Express API (Render) ──► PostgreSQL (Neon)
```

Request flow inside the API:

```
request-id → helmet → cors → json(100kb) → cookies → rate-limit
   → route → validate(Zod) → authenticate → authorize(role)
   → controller → service (+ policy) → Drizzle → PostgreSQL
   → respond.* | error-handler
```

- **Layers:** routes (wiring) → controllers (HTTP only) → services (business rules + queries) → Drizzle schema.
- **Policies:** pure functions that encode who may do what to which issue/comment.
- **Single response envelope** and a **central error-code catalogue**.
- **Soft delete** (`deleted_at`) on issues and comments; users are deactivated, not deleted.

Details: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

```
src/
├── config/        env (Zod-validated), logger
├── db/            Drizzle client, schema, migrations, seed
├── modules/       auth · users · issues · comments · dashboard · health
├── middleware/    authenticate · authorize · validate · rate-limit · error-handler …
├── constants/     roles, issue enums, error codes
├── lib/           AppError, respond, pagination, password, escape-like
├── app.ts         Express app (importable by tests)
└── server.ts      listen + graceful shutdown
```

---

## Tech stack

| Concern            | Choice                                                        |
| ------------------ | ------------------------------------------------------------- |
| Runtime / language | Node.js 22 LTS, TypeScript (strict)                           |
| Framework          | Express 5                                                     |
| Database           | PostgreSQL (Neon free tier)                                   |
| ORM / migrations   | Drizzle ORM, drizzle-kit                                      |
| Validation         | Zod                                                           |
| Auth               | JWT access token + rotating httpOnly refresh cookie, bcryptjs |
| Security           | helmet, cors allow-list, express-rate-limit                   |
| Logging            | pino, pino-http                                               |
| Testing            | Vitest, Supertest                                             |
| CI / hosting       | GitHub Actions · Render (API) · Vercel (frontend) · Neon (DB) |

---

## Getting started

**Prerequisites:** Node.js ≥ 22, npm, Docker (or a free Neon account).

```bash
git clone https://github.com/<you>/issue-tracker-backend.git
cd issue-tracker-backend
npm install

cp .env.example .env            # then edit values
docker compose up -d            # local PostgreSQL

npm run db:migrate              # create tables
npm run db:seed                 # admin + demo data
npm run dev                     # http://localhost:4000

curl http://localhost:4000/api/v1/ping
```

Full setup, production configuration and troubleshooting: [`SETUP.md`](./SETUP.md).

---

## Environment variables

Validated at startup; the process exits if any required value is missing or invalid.

| Variable                                        | Required | Default                                   | Description                                                       |
| ----------------------------------------------- | :------: | ----------------------------------------- | ----------------------------------------------------------------- |
| `NODE_ENV`                                      |          | `development`                             | `development` / `test` / `production`                             |
| `PORT`                                          |          | `4000`                                    | HTTP port (Render injects its own)                                |
| `LOG_LEVEL`                                     |          | `info`                                    | pino level                                                        |
| `TRUST_PROXY_HOPS`                              |          | `0`                                       | Reverse proxies in front of the API (`2` on Render behind Vercel) |
| `DATABASE_URL`                                  |    ✅    | –                                         | PostgreSQL connection string (Neon pooled in production)          |
| `DATABASE_URL_TEST`                             |  tests   | –                                         | Separate DB used by `npm test`                                    |
| `DB_POOL_MAX`                                   |          | `5`                                       | pg pool size                                                      |
| `JWT_ACCESS_SECRET`                             |    ✅    | –                                         | ≥ 32 random characters                                            |
| `JWT_ACCESS_EXPIRES_IN`                         |          | `15m`                                     | Access token lifetime                                             |
| `JWT_ISSUER` / `JWT_AUDIENCE`                   |          | `issue-tracker-api` / `issue-tracker-web` | Token claims                                                      |
| `REFRESH_TOKEN_TTL_DAYS`                        |          | `7`                                       | Refresh cookie lifetime                                           |
| `BCRYPT_ROUNDS`                                 |          | `12`                                      | bcrypt cost (min 10)                                              |
| `CORS_ORIGINS`                                  |    ✅    | `http://localhost:5173`                   | Comma-separated allowed origins                                   |
| `RATE_LIMIT_WINDOW_MS`                          |          | `900000`                                  | Window for rate limits                                            |
| `RATE_LIMIT_MAX`                                |          | `300`                                     | Requests per window per IP (global)                               |
| `AUTH_RATE_LIMIT_MAX`                           |          | `20`                                      | Requests per window per IP on `/auth/*`                           |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` |   seed   | –                                         | Admin created by `db:seed` if absent                              |
| `SEED_DEMO_DATA`                                |          | `false`                                   | Create demo users and issues                                      |

Secrets are never committed; see `.env.example`.

---

## Scripts

| Script                                   | Purpose                                  |
| ---------------------------------------- | ---------------------------------------- |
| `npm run dev`                            | Dev server with reload                   |
| `npm run build` / `npm start`            | Compile / run production build           |
| `npm run lint` · `format` · `typecheck`  | Static checks                            |
| `npm test`                               | Unit + integration tests                 |
| `npm run db:generate`                    | Generate a migration from schema changes |
| `npm run db:migrate` · `db:migrate:prod` | Apply migrations                         |
| `npm run db:seed` · `db:seed:prod`       | Seed admin / demo data                   |
| `npm run db:studio`                      | Browse data with Drizzle Studio          |

---

## API reference

Base URL: `/api/v1` · JSON only · 🔒 requires `Authorization: Bearer <accessToken>` · 👑 admin only.

### Conventions

**Success**

```json
{ "success": true, "data": {}, "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }
```

`meta` appears only on paginated lists.

**Error**

```json
{
  "success": false,
  "error": { "code": "ISSUE_NOT_FOUND", "message": "Issue not found", "details": null },
  "requestId": "b5c1c1c2-…"
}
```

Validation errors return `details: [{ "path": "title", "message": "Required" }]`.

**Pagination / sorting:** `?page=1&limit=10` (max 50), `?sort=createdAt|updatedAt|priority|status&order=asc|desc`.

### Endpoints

| Method | Path                        |  Auth  | Description                                         |
| ------ | --------------------------- | :----: | --------------------------------------------------- |
| GET    | `/ping`                     |   –    | `Welcome to Issue Tracker Backend`                  |
| GET    | `/health`                   |   –    | Liveness                                            |
| GET    | `/health/ready`             |   –    | Readiness (DB check)                                |
| POST   | `/auth/register`            |   –    | Create a USER account                               |
| POST   | `/auth/login`               |   –    | Login                                               |
| POST   | `/auth/admin/login`         |   –    | Login, ADMIN accounts only                          |
| POST   | `/auth/refresh`             | cookie | Rotate refresh token, get new access token          |
| POST   | `/auth/logout`              | cookie | Revoke refresh token                                |
| GET    | `/auth/me`                  |   🔒   | Current user                                        |
| GET    | `/users/assignable`         |   🔒   | Active users `{ id, name }`                         |
| GET    | `/users`                    |   👑   | List users (`q`, `role`, `isActive`, pagination)    |
| PATCH  | `/users/:id`                |   👑   | Change `role` / `isActive`                          |
| GET    | `/issues`                   |   🔒   | List with filters                                   |
| POST   | `/issues`                   |   🔒   | Create issue                                        |
| GET    | `/issues/:id`               |   🔒   | Issue details                                       |
| PATCH  | `/issues/:id`               |   🔒   | Edit title/description/priority (reporter or admin) |
| PATCH  | `/issues/:id/status`        |   🔒   | Change status (reporter, assignee or admin)         |
| PATCH  | `/issues/:id/assignee`      |   🔒   | Assign/unassign (reporter or admin)                 |
| DELETE | `/issues/:id`               |   🔒   | Soft delete (reporter or admin)                     |
| GET    | `/issues/:id/activity`      |   🔒   | Activity timeline                                   |
| GET    | `/issues/:issueId/comments` |   🔒   | List comments                                       |
| POST   | `/issues/:issueId/comments` |   🔒   | Add comment                                         |
| PATCH  | `/comments/:id`             |   🔒   | Edit own comment                                    |
| DELETE | `/comments/:id`             |   🔒   | Soft delete (author or admin)                       |
| GET    | `/dashboard/summary`        |   🔒   | Counts and recent issues                            |

### Examples

**Register** — `POST /auth/register`

```json
// request
{ "name": "Asha Rao", "email": "asha@example.com", "password": "Passw0rdOK" }
// 201 response
{ "success": true,
  "data": { "user": { "id": "…", "name": "Asha Rao", "email": "asha@example.com", "role": "USER" },
            "accessToken": "eyJ…" } }
```

The refresh token is set as an `httpOnly` cookie, never in the body.

**Create issue** — `POST /issues` 🔒

```json
// request
{ "title": "Login button unresponsive on Safari", "description": "Steps: …",
  "priority": "HIGH", "assigneeId": "7c1e…" }
// 201 response (data)
{ "id": "…", "issueNumber": 12, "title": "…", "status": "OPEN", "priority": "HIGH",
  "reporter": { "id": "…", "name": "Asha Rao" }, "assignee": { "id": "7c1e…", "name": "Ravi K" },
  "createdAt": "2026-11-14T08:30:00.000Z" }
```

**Change status** — `PATCH /issues/:id/status` 🔒

```json
{ "status": "IN_PROGRESS" }
```

**List** — `GET /issues?status=OPEN&assigneeId=<id>&q=login&page=1&limit=10&sort=createdAt&order=desc`

**Dashboard** — `GET /dashboard/summary`

```json
{
  "success": true,
  "data": {
    "totals": { "all": 24, "open": 9, "inProgress": 8, "closed": 7 },
    "byPriority": { "low": 5, "medium": 10, "high": 7, "critical": 2 },
    "mine": { "assigned": 4, "assignedOpen": 3, "reported": 6 },
    "recent": [],
    "admin": { "unassigned": 3, "users": { "total": 10, "active": 9 } }
  }
}
```

### Error codes

`VALIDATION_ERROR` 400 · `AUTH_INVALID_CREDENTIALS` / `AUTH_TOKEN_MISSING` / `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` / `AUTH_REFRESH_INVALID` / `AUTH_REFRESH_REUSED` 401 · `AUTH_ACCOUNT_DISABLED` / `FORBIDDEN` 403 · `*_NOT_FOUND` 404 · `USER_EMAIL_TAKEN` / `USER_LAST_ADMIN` / `USER_SELF_MODIFY` / `ISSUE_STATUS_UNCHANGED` 409 · `RATE_LIMITED` 429 · `INTERNAL_ERROR` 500. Full table in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

### Permission summary

| Action                           |         USER         | ADMIN |
| -------------------------------- | :------------------: | :---: |
| View issues, comments, dashboard |          ✅          |  ✅   |
| Create issue / comment           |          ✅          |  ✅   |
| Edit / delete issue              |         own          |  any  |
| Change status                    | reporter or assignee |  any  |
| Assign                           |       reporter       |  any  |
| Edit comment                     |         own          |   –   |
| Delete comment                   |         own          |  any  |
| Manage users                     |          ❌          |  ✅   |

---

## Security

- Passwords hashed with bcrypt (cost 12); 8–72 char policy
- 15-minute JWT access token held in memory by the client; 7-day refresh token in an `httpOnly; Secure; SameSite=Lax` cookie, stored hashed, **rotated on every use** with reuse detection
- Generic login errors and equalised timing to prevent account enumeration
- Zod validation on every input, `.strict()` bodies (no mass assignment)
- Server-side authorization on every route plus resource policies (no IDOR)
- `helmet`, CORS allow-list, 100 kb body limit, global and stricter auth rate limits
- Structured logs with secrets redacted; stack traces never sent to clients
- `npm audit` in CI; no secrets in git

---

## Testing

```bash
npm test
```

- **Unit:** permission policies (table-driven), pure helpers
- **Integration:** Supertest against a real PostgreSQL (`DATABASE_URL_TEST`) covering auth flows, issue CRUD and permissions, status/assignment, comments, dashboard counts, admin guards
- **CI:** GitHub Actions runs lint, typecheck, migrations, tests, build and `npm audit` on every PR

---

## Deployment

| Component  | Host                       | Notes                                               |
| ---------- | -------------------------- | --------------------------------------------------- |
| API        | Render Web Service (Free)  | Build runs migrations and the idempotent admin seed |
| Database   | Neon PostgreSQL (Free)     | Use the pooled connection string                    |
| Frontend   | Vercel (Hobby)             | `vercel.json` rewrites `/api/*` to the Render URL   |
| Keep-alive | UptimeRobot / cron-job.org | Pings `/api/v1/health` every 5 min                  |

**Render settings**

- Build: `npm ci --include=dev && npm run build && npm run db:migrate:prod && npm run db:seed:prod`
- Start: `npm start`
- Health check path: `/api/v1/health`
- Env vars: see [Environment variables](#environment-variables) (production values; `NODE_ENV=production`, `TRUST_PROXY_HOPS=2`)

**Update flow:** merge to `main` → automatic rebuild, migration and deploy. Roll back with the host's "redeploy previous build".

Step-by-step instructions and the post-deploy smoke test: [`SETUP.md`](./SETUP.md) §6–7 and the BRD's Deployment section in [`SCOPE-AND-BRD.md`](./SCOPE-AND-BRD.md) §12.

---

## Project documents

| File                                     | Purpose                                              |
| ---------------------------------------- | ---------------------------------------------------- |
| [`SCOPE-AND-BRD.md`](./SCOPE-AND-BRD.md) | Scope, requirements, phases, risks, **Deployment**   |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)   | Structure, schema, auth design, API contract         |
| [`SETUP.md`](./SETUP.md)                 | Environment setup, deploy steps, CI, troubleshooting |
| [`SKILLS.md`](./SKILLS.md)               | Code patterns and templates                          |
| [`AGENT.md`](./AGENT.md)                 | Conventions and rules for contributors and AI agents |

---

## License

MIT (or as required by the assessment).
