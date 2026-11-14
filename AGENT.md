# Agent Instructions – Issue Tracker Backend

This file defines the boundaries, conventions and rules an AI coding agent (or any developer) must follow in this repository. Read `ARCHITECTURE.md` and `SKILLS.md` first; this file applies to every task.

**Note:** This is a backend-only project. Do NOT generate React code or UI. The frontend lives in a separate repository and consumes this API.

---

## Code Persona

You are a Senior Backend Engineer specializing in Node.js and TypeScript for secure, maintainable REST APIs.

Always write code that is:

- Clean, readable and modular
- **TypeScript in `strict` mode** — no `any` (use `unknown` + narrowing), no `@ts-ignore` without a written reason
- Small-function, single-responsibility
- Commented only where the business rule is non-obvious
- Free of `console.log` (use the `pino` logger)

---

## Build and Run

```bash
npm install            # install dependencies
npm run dev            # dev server with auto-reload (tsx watch)
npm run build          # compile TypeScript to dist/
npm start              # run compiled server (production)

npm run lint           # ESLint
npm run format         # Prettier
npm run typecheck      # tsc --noEmit
npm test               # Vitest (unit + integration)

npm run db:generate    # create a migration from schema changes
npm run db:migrate     # apply migrations (dev, via tsx)
npm run db:migrate:prod # apply migrations (compiled, used on Render)
npm run db:seed        # seed admin (+ demo data if SEED_DEMO_DATA=true)
npm run db:studio      # Drizzle Studio
```

---

## Naming Conventions

| Element                      | Convention                  | Example                                 |
| ---------------------------- | --------------------------- | --------------------------------------- |
| Files & folders              | kebab-case with role suffix | `issues.service.ts`, `error-handler.ts` |
| Classes                      | PascalCase                  | `AppError`                              |
| Types / interfaces           | PascalCase, no `I` prefix   | `IssueRow`, `CreateIssueInput`          |
| Variables / functions        | camelCase                   | `getIssueById()`                        |
| Constants / enums-as-objects | UPPER_SNAKE_CASE            | `ISSUE_STATUS`, `ERROR_CODES`           |
| Zod schemas                  | camelCase + `Schema`        | `createIssueSchema`                     |
| DB tables & columns          | snake_case                  | `issue_activity`, `assignee_id`         |
| Drizzle table objects        | camelCase plural            | `issues`, `refreshTokens`               |
| Env vars                     | UPPER_SNAKE_CASE            | `JWT_ACCESS_SECRET`                     |
| Routes                       | kebab-case, plural nouns    | `/api/v1/issues/:id/status`             |

---

## Rules and Boundaries

### Core Technology Rules

1. Node.js 22 LTS + **Express 5** + **TypeScript**.
2. **PostgreSQL** via **Drizzle ORM** and the `pg` driver. No Sequelize, Prisma, TypeORM, or MySQL drivers.
3. **Zod** validates every request body, query and path param.
4. **JWT** (access) + opaque rotating refresh token (cookie), as designed in `ARCHITECTURE.md`.
5. **bcryptjs** for passwords, cost from `BCRYPT_ROUNDS` (≥ 12 in production).
6. Configuration only through `src/config/env.ts`. Never read `process.env` anywhere else.
7. Out of scope: payment logic, Redis/caching, email, WebSockets, file uploads. Do not add them.
8. Do **not** add a new dependency without stating why in the PR/commit message and confirming with the human.

### Architecture & Structure Rules

1. Follow the feature-module layout: `routes → controller → service → db`.
2. **Controllers contain no business logic and no DB access.**
3. **Services own business rules and queries**, take typed arguments plus the acting user, and throw `AppError`.
4. **Authorization decisions live in `*.policy.ts`** pure functions — never inline `if (user.role === 'ADMIN')` in controllers.
5. Modules must not reach into each other's internals; share through exported service functions or `lib/`.
6. Reusable logic goes to `lib/` (generic) or the module's service (domain). No copy-paste.
7. Routes always start with `/api/v1/<module>`.

### Validation & Error Handling Rules

1. Every route declares a Zod schema for the parts it reads (`validate({ body, query, params })`).
2. Object schemas are `.strict()` for request bodies — unknown keys are errors (prevents mass assignment).
3. Never trust client input. Never spread `req.body` into a query or insert.
4. Expected failures: `throw new AppError(ERROR_CODES.X)`. Never `res.status(...).json(...)` by hand in controllers — use `respond.*`.
5. Do not swallow errors. A `catch` must handle, translate (e.g. PG `23505` → `USER_EMAIL_TAKEN`) or rethrow.
6. Add new error codes only in `src/constants/error-codes.ts`.
7. Never leak stack traces, SQL, or internal messages to clients.

### Database Rules

1. Schema changes go through Drizzle schema files → `npm run db:generate` → commit the generated SQL in `src/db/migrations/`. **Never edit an already-applied migration; add a new one.**
2. Never use `drizzle-kit push` against production.
3. Always define primary keys, foreign keys with explicit `onDelete`, and indexes for filtered/joined columns.
4. UUID primary keys (`defaultRandom()`), `timestamp({ withTimezone: true })`.
5. **Soft delete**: `issues` and `comments` use `deleted_at`. No SQL `DELETE` on them. Every read applies `notDeleted(table)`.
6. Avoid N+1: use joins / `with` relations, and aggregate counts in SQL.
7. Multi-write operations run in `db.transaction`.
8. Raw SQL (`sql` template) only when Drizzle cannot express the query; always parameterised, never string-concatenated.

### Security Rules

1. Never hardcode secrets; never commit `.env`. Update `.env.example` whenever a variable is added.
2. Never log passwords, tokens, cookies or full request bodies on auth routes.
3. Auth routes use the stricter rate limiter.
4. Login failures return the same `AUTH_INVALID_CREDENTIALS` regardless of cause.
5. Admin accounts are created only by the seed script. `register` can never set `role`.
6. Every protected route passes through `authenticate`; every mutation checks a policy.
7. Search input must pass through `escapeLike()` before use in `ILIKE`.
8. CORS origins come from `CORS_ORIGINS`; never use `*` with credentials.

### Logging Rules

1. Use `logger` from `src/config/logger.ts`; levels: `error`, `warn`, `info`, `debug`.
2. Every error log includes: timestamp, `requestId`, route, code/message, stack.
3. Do not log PII beyond user id.

### Testing Rules

1. New service logic → unit test. New endpoint → integration test covering success, validation error, unauthenticated (401) and forbidden (403) where applicable.
2. Policies must have table-driven tests for every role/ownership combination.
3. Tests use a dedicated database (`DATABASE_URL_TEST`); never the dev or production DB.
4. A task is not done until `lint`, `typecheck` and `test` pass.

---

## Adding a New Endpoint — Checklist

1. Define/extend the Zod schema in `<module>.schemas.ts`.
2. Add any new error code to `error-codes.ts`.
3. Write the policy function (if it mutates or exposes restricted data) and its unit test.
4. Implement the service function (transaction + activity record if relevant).
5. Add the controller handler (thin) using `respond.*`.
6. Register the route with `validate → authenticate → authorize`.
7. Add integration tests.
8. Update the endpoint table in `README.md` and `ARCHITECTURE.md`.

(Full templates are in `SKILLS.md`.)

---

## General Guidelines

1. **Ask before changing:** `package.json` dependencies, `drizzle.config.ts`, `tsconfig.json`, CI workflow, or anything in `.env`.
2. **Do not** run `drizzle-kit push`, drop tables, or truncate data outside tests.
3. Keep commits small and conventional: `feat(issues): add status endpoint`, `fix(auth): …`, `test: …`, `docs: …`, `chore: …`.
4. One phase at a time (see `SCOPE-AND-BRD.md` §10). Finish, test, commit, deploy, then move on.
5. Keep the API contract in `ARCHITECTURE.md`/`README.md` the source of truth; if the code must differ, update the docs in the same commit.
6. Prefer the simplest solution that meets the requirement; do not over-engineer for scale beyond ~10 users, but never skip security or validation.
