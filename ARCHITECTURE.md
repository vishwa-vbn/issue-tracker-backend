# Issue Tracker – Backend Architecture

---

## Overview

The Issue Tracker backend is a production-style REST API that manages:

- User registration, login, admin login and session refresh
- Issues: create, edit, soft-delete, search and filter
- Assignment and status tracking, with a per-issue activity timeline
- Comments on issues
- Dashboard counts
- Admin user management

It follows:

- **Layered / feature-module architecture** — `routes → controller → service → database`
- **Clean code principles** — single responsibility, DRY, small functions, strict TypeScript
- **Enterprise API standards** — one response envelope, stable error codes, request IDs, centralized error handling, server-side RBAC

The API is consumed by the React SPA in `issue-tracker-frontend`. Scope and phases are in `SCOPE-AND-BRD.md`.

---

## Tech Stack

| Layer            | Technology                                       | Notes                                                 |
| ---------------- | ------------------------------------------------ | ----------------------------------------------------- |
| Runtime          | Node.js 22 LTS                                   | `engines.node >= 22`                                  |
| Language         | TypeScript 5 (`strict`)                          | ESM, compiled with `tsc` to `dist/`                   |
| Framework        | Express 5                                        | Async errors reach the error middleware automatically |
| Database         | PostgreSQL (Neon free tier in production)        | Local Postgres via Docker for development             |
| ORM / migrations | Drizzle ORM + drizzle-kit                        | SQL migration files committed to git                  |
| DB driver        | `pg`                                             | Pooled connections                                    |
| Validation       | Zod                                              | Every body, query and param; `.strict()` objects      |
| Authentication   | JWT access token + opaque rotating refresh token | `jsonwebtoken`                                        |
| Password hashing | `bcryptjs` (cost 12)                             | Pure JS, deploys anywhere                             |
| Security         | `helmet`, `cors`, `express-rate-limit`           |                                                       |
| Logging          | `pino` + `pino-http`                             | JSON logs, secrets redacted                           |
| Config           | `dotenv` + Zod-validated `env.ts`                | App refuses to boot on bad config                     |
| Testing          | Vitest + Supertest                               | Real Postgres for integration tests                   |
| Tooling          | ESLint, Prettier, tsx, GitHub Actions            |                                                       |

**Not used (by design):** payments, Redis/caching, WebSockets, email service, ORMs other than Drizzle.

---

## High-Level Architecture

```
Browser (React SPA on Vercel)
        │  same-origin /api/*  (Vercel rewrite)
        ▼
Express app (Render)
  ├─ Global middleware: request-id → helmet → cors → body limit → cookies → rate limit → pino-http
  ├─ Routes  (/api/v1/<module>)
  │     └─ per-route: validate(zod) → authenticate → authorize(role)
  ├─ Controllers   (HTTP in/out only)
  ├─ Services      (business rules + Drizzle queries; throw AppError)
  ├─ Policies      (pure authorization functions: can this user do X to this issue?)
  └─ Error middleware (AppError / ZodError / unknown → standard envelope)
        ▼
Drizzle ORM ──► PostgreSQL (Neon)
```

---

## Project Structure

```
/issue-tracker-backend
├── src/
│   ├── config/
│   │   ├── env.ts                  # dotenv + Zod schema; exports typed `env`
│   │   └── logger.ts               # pino instance with redaction
│   ├── db/
│   │   ├── client.ts               # pg Pool + drizzle instance
│   │   ├── schema/
│   │   │   ├── index.ts            # re-exports everything
│   │   │   ├── enums.ts            # pgEnum definitions
│   │   │   ├── users.ts
│   │   │   ├── issues.ts
│   │   │   ├── comments.ts
│   │   │   ├── issue-activity.ts
│   │   │   └── refresh-tokens.ts
│   │   ├── migrations/             # generated SQL (committed) — never hand-edit applied files
│   │   ├── migrate.ts              # programmatic migrator (used locally and on Render)
│   │   └── seed.ts                 # idempotent admin (+ optional demo data)
│   ├── modules/                    # one folder per feature
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.schemas.ts     # Zod request schemas + inferred types
│   │   │   └── token.service.ts    # sign/verify access JWT, issue/rotate/revoke refresh tokens
│   │   ├── users/                  # users.routes|controller|service|schemas
│   │   ├── issues/
│   │   │   ├── issues.routes.ts
│   │   │   ├── issues.controller.ts
│   │   │   ├── issues.service.ts
│   │   │   ├── issues.policy.ts    # canEdit / canDelete / canChangeStatus / canAssign
│   │   │   ├── issues.schemas.ts
│   │   │   └── activity.service.ts # records issue_activity rows
│   │   ├── comments/               # comments.routes|controller|service|policy|schemas
│   │   ├── dashboard/              # dashboard.routes|controller|service
│   │   └── health/                 # health + ping routes
│   ├── middleware/
│   │   ├── authenticate.ts         # verifies access JWT, loads user, sets req.user
│   │   ├── authorize.ts            # requireRole('ADMIN')
│   │   ├── validate.ts             # validate({ body, query, params }) with Zod
│   │   ├── rate-limit.ts           # global + auth limiters
│   │   ├── request-id.ts
│   │   ├── not-found.ts
│   │   └── error-handler.ts
│   ├── constants/
│   │   ├── roles.ts                # USER_ROLES
│   │   ├── issue.ts                # ISSUE_STATUS, ISSUE_PRIORITY, ACTIVITY_TYPE
│   │   └── error-codes.ts          # ERROR_CODES → { status, message } (single source of truth)
│   ├── lib/
│   │   ├── app-error.ts            # AppError class
│   │   ├── respond.ts              # ok(), created(), paginated(), noContent()
│   │   ├── pagination.ts           # parse + meta builder
│   │   ├── password.ts             # hash / verify (+ dummy hash for timing safety)
│   │   └── escape-like.ts          # escape % and _ for ILIKE search
│   ├── types/
│   │   └── express.d.ts            # augments Request with `user` and `id`
│   ├── app.ts                      # builds the Express app (no listen) — imported by tests
│   └── server.ts                   # listen + graceful shutdown
├── tests/
│   ├── setup.ts                    # test DB, truncate between tests
│   ├── helpers/                    # factories, login helper
│   ├── unit/                       # policies, services with pure logic
│   └── integration/                # supertest: auth, issues, comments, dashboard, users
├── drizzle.config.ts
├── tsconfig.json
├── eslint.config.js
├── .prettierrc
├── docker-compose.yml              # local Postgres
├── .env.example
├── .github/workflows/ci.yml
└── package.json
```

---

## Layer Responsibilities

### Routes

- Declare endpoints under `/api/v1/<module>`.
- Compose middleware in this order: `validate` → `authenticate` → `authorize`.
- No logic. One line per route.

### Controllers

- Translate HTTP ↔ service calls: read `req.body/query/params` (already validated), call the service, reply with `respond.*`.
- **No business logic, no database access.**

### Services

- All business rules and Drizzle queries live here.
- Receive plain typed arguments plus the acting user; throw `AppError` for expected failures.
- Call `policies` for permission decisions and `activity.service` to record history.
- Use transactions whenever more than one write must succeed together (e.g. status change + activity row).

### Policies

- Pure functions, no I/O: `canEditIssue(user, issue)`, `canChangeStatus(user, issue)`, etc.
- Unit-tested exhaustively. This is the permission matrix from `SCOPE-AND-BRD.md` §5 in code.

### Data access (Drizzle schema)

- Schema files define tables, enums, indexes, relations. No business logic.
- Types are derived with `typeof table.$inferSelect` / `$inferInsert`.

### Middleware

- `authenticate` — verify `Authorization: Bearer`, check `iss`/`aud`/`exp`, load the user, reject inactive users.
- `authorize` — role gate.
- `validate` — parse with Zod, replace `req.body/query/params` with parsed values (unknown keys rejected).
- `error-handler` — final stop; maps errors to the envelope and logs.

---

## Database Schema

PostgreSQL, UUID primary keys (`gen_random_uuid()`), `timestamptz` timestamps, native enums.

### Enums

| Enum             | Values                                                                        |
| ---------------- | ----------------------------------------------------------------------------- |
| `user_role`      | `USER`, `ADMIN`                                                               |
| `issue_status`   | `OPEN`, `IN_PROGRESS`, `CLOSED`                                               |
| `issue_priority` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`                                           |
| `activity_type`  | `CREATED`, `UPDATED`, `STATUS_CHANGED`, `ASSIGNED`, `UNASSIGNED`, `COMMENTED` |

### Tables

**`users`**

| Column                     | Type         | Notes                                  |
| -------------------------- | ------------ | -------------------------------------- |
| `id`                       | uuid PK      |                                        |
| `name`                     | varchar(80)  | not null                               |
| `email`                    | varchar(254) | not null, stored lowercase, **unique** |
| `password_hash`            | varchar(100) | bcrypt output                          |
| `role`                     | user_role    | default `USER`                         |
| `is_active`                | boolean      | default `true`                         |
| `created_at`, `updated_at` | timestamptz  |                                        |

**`issues`**

| Column                     | Type                     | Notes                                               |
| -------------------------- | ------------------------ | --------------------------------------------------- |
| `id`                       | uuid PK                  | used in URLs                                        |
| `issue_number`             | integer identity, unique | human-friendly `#12`                                |
| `title`                    | varchar(150)             | not null                                            |
| `description`              | text                     | max 5000 enforced in Zod                            |
| `status`                   | issue_status             | default `OPEN`                                      |
| `priority`                 | issue_priority           | default `MEDIUM`                                    |
| `reporter_id`              | uuid FK → users          | not null                                            |
| `assignee_id`              | uuid FK → users          | nullable                                            |
| `closed_at`                | timestamptz              | set when status becomes `CLOSED`, cleared on reopen |
| `created_at`, `updated_at` | timestamptz              |                                                     |
| `deleted_at`               | timestamptz              | soft delete                                         |

Indexes: `(status)`, `(assignee_id)`, `(reporter_id)`, `(created_at DESC)` — all partial `WHERE deleted_at IS NULL`.

**`comments`**

| Column                     | Type             | Notes        |
| -------------------------- | ---------------- | ------------ |
| `id`                       | uuid PK          |              |
| `issue_id`                 | uuid FK → issues | not null     |
| `author_id`                | uuid FK → users  | not null     |
| `body`                     | text             | 1–2000 chars |
| `created_at`, `updated_at` | timestamptz      |              |
| `deleted_at`               | timestamptz      | soft delete  |

Index: `(issue_id, created_at)`.

**`issue_activity`**

| Column                   | Type             | Notes                                      |
| ------------------------ | ---------------- | ------------------------------------------ |
| `id`                     | uuid PK          |                                            |
| `issue_id`               | uuid FK → issues |                                            |
| `actor_id`               | uuid FK → users  |                                            |
| `type`                   | activity_type    |                                            |
| `from_value`, `to_value` | varchar(100)     | e.g. `OPEN` → `IN_PROGRESS`; assignee name |
| `created_at`             | timestamptz      |                                            |

Index: `(issue_id, created_at)`. Append-only.

**`refresh_tokens`**

| Column        | Type            | Notes                                   |
| ------------- | --------------- | --------------------------------------- |
| `id`          | uuid PK         |                                         |
| `user_id`     | uuid FK → users |                                         |
| `token_hash`  | char(64)        | SHA-256 of the opaque token, **unique** |
| `expires_at`  | timestamptz     |                                         |
| `revoked_at`  | timestamptz     | nullable                                |
| `replaced_by` | uuid            | nullable, links the rotation chain      |
| `created_at`  | timestamptz     |                                         |

Index: `(user_id)`.

### Relations

```
users 1 ─── * issues (reporter_id)
users 1 ─── * issues (assignee_id)
issues 1 ─── * comments
issues 1 ─── * issue_activity
users 1 ─── * comments / issue_activity / refresh_tokens
```

### Status rules

```
OPEN ⇄ IN_PROGRESS ⇄ CLOSED     (any change to a different status is allowed; same → same is rejected)
```

`closed_at` is set on `→ CLOSED` and cleared on reopen. The allowed-transition map lives in `constants/issue.ts` so it can be tightened later without touching services.

---

## Soft Delete Strategy

- `issues` and `comments` carry `deleted_at`. "Delete" sets it; **no SQL `DELETE`** on these tables.
- Every read adds `isNull(deleted_at)` through a shared helper (`notDeleted(table)`), so no query forgets it.
- Soft-deleting an issue hides its comments and activity from all endpoints.
- `users` are never deleted; they are deactivated (`is_active = false`).
- `refresh_tokens` and `issue_activity` are operational/audit data, not user content, and are not soft-deleted.

---

## Authentication & Session Strategy

| Item           | Design                                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passwords      | bcryptjs, cost 12 (`BCRYPT_ROUNDS`). Input limited to 8–72 chars (bcrypt ignores bytes past 72) with at least one letter and one digit                                                 |
| Access token   | JWT HS256, 15 min, claims `sub` (user id), `role`, `iss`, `aud`; algorithm pinned on verify. Sent as `Authorization: Bearer` and held **in memory** by the SPA                         |
| Refresh token  | 256-bit random opaque string in an `httpOnly; Secure; SameSite=Lax; Path=/api/v1/auth` cookie, 7 days. Only its SHA-256 is stored                                                      |
| Rotation       | Every `/auth/refresh` revokes the presented token and issues a new one. Presenting a **revoked** token revokes the user's whole chain (theft signal) and returns `AUTH_REFRESH_REUSED` |
| Logout         | Revokes the presented refresh token and clears the cookie                                                                                                                              |
| Admin login    | `POST /auth/admin/login` uses the same credential check, then requires `role = ADMIN`; otherwise the **same** generic invalid-credentials error is returned                            |
| Login errors   | Always `AUTH_INVALID_CREDENTIALS`. A dummy bcrypt compare runs for unknown emails to equalise timing                                                                                   |
| Admin creation | Seed script only. Public registration always creates `USER` and ignores any `role` field (the schema is `.strict()`)                                                                   |
| Inactive users | Rejected at login, at refresh, and in `authenticate`                                                                                                                                   |

---

## Authorization Strategy

Three checks, in order:

1. **Authenticated?** — `authenticate` middleware.
2. **Role gate** — `authorize('ADMIN')` for admin-only routes.
3. **Resource policy** — services load the resource and call a policy (`canEditIssue`, …) which throws `FORBIDDEN` when denied. This prevents IDOR: an id in the URL never grants access by itself.

Missing resources return `404`, and policy failures return `403`.

---

## API Conventions

- Base path: **`/api/v1`**. JSON only.
- IDs are UUIDs. Dates are ISO-8601 UTC strings.
- Pagination: `?page=1&limit=10` (default 10, max 50). Sorting: `?sort=createdAt&order=desc`.

### Response envelope

```jsonc
// success
{ "success": true, "data": { /* payload */ }, "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }   // meta only on lists

// error
{ "success": false,
  "error": { "code": "ISSUE_NOT_FOUND", "message": "Issue not found", "details": null },
  "requestId": "b5c1c1c2-…" }
```

`details` is an array of `{ path, message }` for `VALIDATION_ERROR`, otherwise `null`. Stack traces are never returned.

### Error code catalogue (`constants/error-codes.ts`)

| Code                       | HTTP | Meaning                                              |
| -------------------------- | ---- | ---------------------------------------------------- |
| `VALIDATION_ERROR`         | 400  | Zod validation failed                                |
| `AUTH_INVALID_CREDENTIALS` | 401  | Wrong email/password, or not an admin on admin login |
| `AUTH_TOKEN_MISSING`       | 401  | No bearer token                                      |
| `AUTH_TOKEN_EXPIRED`       | 401  | Access token expired — client should refresh         |
| `AUTH_TOKEN_INVALID`       | 401  | Malformed / wrong signature                          |
| `AUTH_REFRESH_INVALID`     | 401  | Refresh cookie missing, unknown or expired           |
| `AUTH_REFRESH_REUSED`      | 401  | Rotated token presented again                        |
| `AUTH_ACCOUNT_DISABLED`    | 403  | User is deactivated                                  |
| `FORBIDDEN`                | 403  | Role or policy denies the action                     |
| `USER_NOT_FOUND`           | 404  |                                                      |
| `USER_EMAIL_TAKEN`         | 409  | Registration with an existing email                  |
| `USER_LAST_ADMIN`          | 409  | Would remove the last active admin                   |
| `USER_SELF_MODIFY`         | 409  | Admin tried to demote/deactivate themselves          |
| `ISSUE_NOT_FOUND`          | 404  | Missing or soft-deleted                              |
| `ISSUE_STATUS_UNCHANGED`   | 409  | Requested status equals current                      |
| `ASSIGNEE_NOT_FOUND`       | 404  | Assignee missing or inactive                         |
| `COMMENT_NOT_FOUND`        | 404  |                                                      |
| `RATE_LIMITED`             | 429  |                                                      |
| `ROUTE_NOT_FOUND`          | 404  |                                                      |
| `INTERNAL_ERROR`           | 500  | Unexpected                                           |

New codes are added **only** in `error-codes.ts`; the frontend maps on `code`, never on message text.

---

## Endpoints

All under `/api/v1`. 🔒 = needs access token · 👑 = admin only.

### Health

| Method | Path            | Description                                            |
| ------ | --------------- | ------------------------------------------------------ |
| GET    | `/ping`         | Returns `Welcome to Issue Tracker Backend`             |
| GET    | `/health`       | Liveness (no DB). Used by Render and the uptime pinger |
| GET    | `/health/ready` | Readiness: runs `SELECT 1`                             |

### Auth

| Method | Path                | Body                        | Result                                         |
| ------ | ------------------- | --------------------------- | ---------------------------------------------- |
| POST   | `/auth/register`    | `{ name, email, password }` | `201` `{ user, accessToken }` + refresh cookie |
| POST   | `/auth/login`       | `{ email, password }`       | `{ user, accessToken }` + cookie               |
| POST   | `/auth/admin/login` | `{ email, password }`       | Same, admins only                              |
| POST   | `/auth/refresh`     | cookie                      | `{ user, accessToken }` + rotated cookie       |
| POST   | `/auth/logout`      | cookie                      | `204`                                          |
| GET 🔒 | `/auth/me`          | —                           | `{ user }`                                     |

### Users

| Method   | Path                | Description                                           |
| -------- | ------------------- | ----------------------------------------------------- |
| GET 🔒   | `/users/assignable` | Active users `{ id, name }` for the assignee dropdown |
| GET 👑   | `/users`            | Paginated list; `?q=&role=&isActive=`                 |
| PATCH 👑 | `/users/:id`        | `{ role?, isActive? }`                                |

### Issues

| Method    | Path                   | Description                                                                 |
| --------- | ---------------------- | --------------------------------------------------------------------------- |
| GET 🔒    | `/issues`              | `?page&limit&q&status&priority&assigneeId&reporterId&unassigned&sort&order` |
| POST 🔒   | `/issues`              | `{ title, description, priority?, assigneeId? }`                            |
| GET 🔒    | `/issues/:id`          | Issue + reporter + assignee + comment count                                 |
| PATCH 🔒  | `/issues/:id`          | `{ title?, description?, priority? }` — reporter or admin                   |
| PATCH 🔒  | `/issues/:id/status`   | `{ status }` — reporter, assignee or admin                                  |
| PATCH 🔒  | `/issues/:id/assignee` | `{ assigneeId: uuid \| null }` — reporter or admin                          |
| DELETE 🔒 | `/issues/:id`          | Soft delete — reporter or admin. `204`                                      |
| GET 🔒    | `/issues/:id/activity` | Timeline, newest first                                                      |

### Comments

| Method    | Path                        | Description                          |
| --------- | --------------------------- | ------------------------------------ |
| GET 🔒    | `/issues/:issueId/comments` | Oldest first, paginated              |
| POST 🔒   | `/issues/:issueId/comments` | `{ body }`                           |
| PATCH 🔒  | `/comments/:id`             | `{ body }` — author only             |
| DELETE 🔒 | `/comments/:id`             | Soft delete — author or admin. `204` |

### Dashboard

| Method | Path                 | Description     |
| ------ | -------------------- | --------------- |
| GET 🔒 | `/dashboard/summary` | See shape below |

```jsonc
{
  "totals": { "all": 24, "open": 9, "inProgress": 8, "closed": 7 },
  "byPriority": { "low": 5, "medium": 10, "high": 7, "critical": 2 },
  "mine": { "assigned": 4, "assignedOpen": 3, "reported": 6 },
  "recent": [/* 5 latest issues */],
  "admin": { "unassigned": 3, "users": { "total": 10, "active": 9 } }, // only present for ADMIN
}
```

Counts are computed with a single grouped query per metric set (no per-row loops).

---

## Error Handling Strategy

- Expected failures: `throw new AppError(ERROR_CODES.ISSUE_NOT_FOUND)`.
- Express 5 forwards rejected async handlers to the error middleware, so controllers need no boilerplate `try/catch`. A `try/catch` is added only when the code can **recover** or must **translate** an error (e.g. map a Postgres unique violation `23505` to `USER_EMAIL_TAKEN`).
- `error-handler` maps: `AppError` → its status/code; `ZodError` → `VALIDATION_ERROR`; JWT errors → `AUTH_TOKEN_*`; anything else → `INTERNAL_ERROR` (logged with stack, hidden from the client).

---

## Logging Strategy

- `pino-http` logs one line per request: method, path, status, duration, `requestId`, user id.
- Errors log: timestamp, requestId, route, error code/message, stack (server side only).
- Redacted paths: `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`, `*.password`, `*.token`.
- Pretty printing in development only.

---

## Performance

- Pagination on every list (max 50). Selected columns only on list queries.
- Single query with joins for list + reporter/assignee names (no N+1).
- Indexes listed above; search uses `ILIKE` on title/description with wildcard-escaped input (enough for this scale; `pg_trgm` is the upgrade path).
- Pool size `DB_POOL_MAX` (default 5) to stay inside Neon connection limits; use Neon's **pooled** connection string.
- Compression is not enabled on the API (the CDN handles static assets; JSON payloads are small).

---

## Security Summary (OWASP mapping)

| Risk                         | Control                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| Broken access control / IDOR | Policies on every resource route; UUID ids; 404 vs 403 rules                                        |
| Cryptographic failures       | bcrypt 12; secrets only in env; HTTPS by platform; hashed refresh tokens                            |
| Injection                    | Drizzle parameterised queries; Zod validation; escaped `ILIKE`                                      |
| Insecure design              | Rotation + reuse detection; seeded admin only; last-admin guard                                     |
| Misconfiguration             | `helmet`; strict CORS allow-list; body limit 100 kb; no stack traces in prod; env validated at boot |
| Auth failures                | Rate-limited auth routes; generic errors; timing equalisation                                       |
| Mass assignment              | Zod `.strict()` — unknown fields are rejected, never spread into queries                            |
| Logging failures             | Structured logs with redaction and request IDs                                                      |
| Vulnerable components        | `npm audit` in CI; lockfile committed                                                               |

---

## Conclusion

The backend gives a clean, testable separation of concerns, a single predictable API contract, secure token handling that works on free hosting, and soft-delete safety on all user content. It is small enough to finish in a day and structured so another developer can extend it module by module.
