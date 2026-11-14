# Issue Tracker – Backend Setup

A secure TypeScript REST API for the Issue Tracker System: authentication, issues, assignment, status tracking, comments and dashboard counts. Everything here runs on free services for up to ~10 users.

---

## 1. Prerequisites

| Tool                 | Version         | Purpose                                                  |
| -------------------- | --------------- | -------------------------------------------------------- |
| Node.js              | 22 LTS or newer | Runtime                                                  |
| npm                  | 10+             | Package manager                                          |
| Docker Desktop       | any             | Local PostgreSQL (optional if you use a Neon dev branch) |
| Git + GitHub account |                 | Source and deployment                                    |
| Neon account         | free            | Production database                                      |
| Render account       | free            | Production hosting                                       |

---

## 2. Bootstrap the Project (one time)

```bash
mkdir issue-tracker-backend && cd issue-tracker-backend
git init
npm init -y
echo "22" > .node-version

# Runtime dependencies
npm install express cors helmet express-rate-limit cookie-parser \
  jsonwebtoken bcryptjs zod dotenv pg drizzle-orm pino pino-http

# Dev dependencies
npm install -D typescript tsx @types/node @types/express @types/cors \
  @types/cookie-parser @types/jsonwebtoken @types/pg drizzle-kit \
  vitest supertest @types/supertest eslint typescript-eslint prettier pino-pretty
```

> `bcryptjs` v3 ships its own type definitions. If you install v2, also add `@types/bcryptjs`.

### `package.json` (key fields)

```json
{
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:migrate:prod": "node dist/db/migrate.js",
    "db:seed": "tsx src/db/seed.ts",
    "db:seed:prod": "node dist/db/seed.js",
    "db:studio": "drizzle-kit studio"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true
  },
  "include": ["src"]
}
```

`tsconfig.build.json` extends it and excludes `tests/`. Relative imports in source use the `.js` extension (NodeNext requirement).

### `drizzle.config.ts`

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

`src/db/migrate.ts` must resolve the migrations folder from the project root (`path.resolve(process.cwd(), 'src/db/migrations')`), because SQL files are not copied into `dist/`. This works on Render because the repo is present during the build.

---

## 3. Environment Configuration

Copy `.env.example` to `.env` and fill it in. `.env` is git-ignored. **The server refuses to start if a required variable is missing or invalid.**

```env
# ── Server ─────────────────────────────────────────────
NODE_ENV=development
PORT=4000
LOG_LEVEL=info
# Number of reverse proxies in front of the API (0 locally, 2 on Render behind Vercel)
TRUST_PROXY_HOPS=0

# ── Database ───────────────────────────────────────────
# Local Docker:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/issue_tracker
# Used only by `npm test` (a separate database, never your dev data):
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/issue_tracker_test
DB_POOL_MAX=5

# ── Auth ───────────────────────────────────────────────
# 32+ random chars. Generate: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_ACCESS_SECRET=replace-me-with-a-long-random-string-at-least-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_ISSUER=issue-tracker-api
JWT_AUDIENCE=issue-tracker-web
REFRESH_TOKEN_TTL_DAYS=7
BCRYPT_ROUNDS=12

# ── CORS (comma-separated, no trailing slash) ──────────
CORS_ORIGINS=http://localhost:5173

# ── Rate limiting ──────────────────────────────────────
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=20

# ── Seed (admin account + optional demo data) ──────────
ADMIN_NAME=System Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeMe123
SEED_DEMO_DATA=true
```

| Variable            |  Required   | Notes                                                                                         |
| ------------------- | :---------: | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      |     ✅      | Neon: use the **pooled** connection string (host contains `-pooler`)                          |
| `JWT_ACCESS_SECRET` |     ✅      | Never reuse between environments                                                              |
| `CORS_ORIGINS`      |     ✅      | Frontend origin(s). Not needed for the proxy path but required for local dev and direct calls |
| `TRUST_PROXY_HOPS`  |     ➖      | `2` on Render behind the Vercel rewrite; verify `req.ip` in logs                              |
| `ADMIN_*`           | ✅ for seed | Admin is created once; changing the password later is done in the app/DB, not by re-seeding   |
| `SEED_DEMO_DATA`    |     ➖      | `true` creates demo users and issues so the dashboard is populated                            |

Keep `.env.example` in sync every time you add a variable.

---

## 4. Local Database

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: issue_tracker
    ports: ['5432:5432']
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/init.sql:/docker-entrypoint-initdb.d/init.sql
volumes:
  pgdata:
```

`docker/init.sql`:

```sql
CREATE DATABASE issue_tracker_test;
```

```bash
docker compose up -d
npm run db:migrate      # create tables
npm run db:seed         # admin + demo data
npm run dev             # http://localhost:4000
```

No Docker? Create a free Neon **branch** named `dev` and use its connection string in `DATABASE_URL` (and another branch for `DATABASE_URL_TEST`).

---

## 5. Build and Run

```bash
npm install
npm run dev            # development, auto-reload
npm run build          # compile to dist/
npm start              # production
npm run lint && npm run typecheck && npm test
```

---

## 6. Production Setup

### 6.1 Neon (database)

1. Sign up at neon.com → **Create project** (Postgres 16/17).
2. Pick the region nearest your Render region (e.g. Singapore for India).
3. Dashboard → **Connection details** → toggle **Pooled connection** → copy the string. This is the production `DATABASE_URL`.
4. Optional: create a branch `test` for CI/integration tests.

Free-tier facts (checked Nov 2026): 1 GB storage per project, 100 compute-hours/month, compute suspends after 5 min idle (first query after idle is slightly slower), no card required.

### 6.2 Render (API)

1. Push the repo to GitHub.
2. Render → **New → Web Service** → connect the repo.
3. Settings:

| Field              | Value                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Language / runtime | Node                                                                                       |
| Region             | Same area as Neon                                                                          |
| Instance type      | **Free**                                                                                   |
| Build command      | `npm ci --include=dev && npm run build && npm run db:migrate:prod && npm run db:seed:prod` |
| Start command      | `npm start`                                                                                |
| Health check path  | `/api/v1/health`                                                                           |
| Auto-deploy        | On (branch `main`)                                                                         |

4. Environment variables: everything in §3 with production values, in particular
   `NODE_ENV=production`, `DATABASE_URL` (Neon pooled), a fresh `JWT_ACCESS_SECRET`, `CORS_ORIGINS=https://<frontend>.vercel.app`, `TRUST_PROXY_HOPS=2`, `ADMIN_*`, `SEED_DEMO_DATA=true` (or `false` for a clean DB).
5. Deploy. Open `https://<backend>.onrender.com/api/v1/ping`.

> Free-tier behaviour to know: the service sleeps after 15 minutes without traffic and takes about a minute to wake; filesystem is ephemeral; outbound SMTP ports are blocked (no email in this project). Run a keep-alive monitor (§6.3).

### 6.3 Keep-alive (avoids the cold start during evaluation)

Create a free monitor (UptimeRobot or cron-job.org) that requests `https://<backend>.onrender.com/api/v1/health` every 5 minutes. One always-on free service uses about 720 of the 750 monthly free instance-hours.

### 6.4 Frontend connection

In the frontend repo set the `/api/*` rewrite destination in `vercel.json` to the Render URL (see the frontend `SETUP.md`). No further backend change is needed for the proxy path.

### 6.5 Updating

Merge to `main` → Render rebuilds, runs migrations, redeploys. For schema changes: `npm run db:generate -- --name <what>`, review the SQL, commit, merge.

---

## 7. Smoke Test Checklist (run after every deploy)

```bash
BASE=https://<backend>.onrender.com/api/v1

curl $BASE/ping                       # "Welcome to Issue Tracker Backend"
curl $BASE/health/ready               # database reachable

# register + capture token
curl -s -X POST $BASE/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Test User","email":"test@example.com","password":"Passw0rdOK"}'
```

Then, in the UI or with the returned `accessToken`:

- [ ] Login works; wrong password gives `AUTH_INVALID_CREDENTIALS`
- [ ] `/auth/admin/login` rejects the normal user and accepts the admin
- [ ] Create an issue → appears in the list and the dashboard counts
- [ ] Assign it, change status Open → In Progress → Closed, reopen
- [ ] Comment, edit the comment, delete the comment
- [ ] A normal user gets `403` editing someone else's issue
- [ ] Deactivated user cannot log in
- [ ] Refresh works after the access token expires; logout clears the session

---

## 8. Agent Guide

Before writing any code, read in order:

1. **`SCOPE-AND-BRD.md`** — what we are building, roles, permission matrix, phases.
2. **`ARCHITECTURE.md`** — structure, schema, auth design, API contract, error codes.
3. **`SKILLS.md`** — code patterns and templates to copy.
4. **`AGENT.md`** — conventions, rules and boundaries for every task.

Follow all four for every feature. Use them to write `README.md`.

### Suggested task prompts, by phase

| Phase | Prompt to give the agent                                                                                                                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0    | "Scaffold the project per SETUP.md §2. Implement `env.ts`, `logger.ts`, `db/client.ts`, `app.ts`, `server.ts`, the error handler, `respond`, `AppError`, and the `ping`/`health` endpoints. Add the Drizzle schema for all five tables and the first migration. Add the CI workflow." |
| P1    | "Implement the auth module (register, login, admin login, refresh with rotation and reuse detection, logout, me), `authenticate`, `authorize`, the auth rate limiter, the admin seed, and integration tests."                                                                         |
| P2    | "Implement issues CRUD with soft delete, the filtered/paginated list, policies and tests."                                                                                                                                                                                            |
| P3    | "Implement the status and assignee endpoints, the activity service, `GET /issues/:id/activity`, `GET /users/assignable`, with tests."                                                                                                                                                 |
| P4    | "Implement comments (list, create, edit, soft delete) with policies and tests."                                                                                                                                                                                                       |
| P5    | "Implement `GET /dashboard/summary` and the admin users endpoints with the self/last-admin guards and tests."                                                                                                                                                                         |
| P6    | "Security and quality sweep: validation coverage, rate limits, error-code coverage, `npm audit`, missing tests."                                                                                                                                                                      |
| P7    | "Finalize README, seed demo data, verify the production smoke test."                                                                                                                                                                                                                  |

### First task: Ping API

Create `GET /api/v1/ping` returning `Welcome to Issue Tracker Backend` (wrapped in the standard success envelope), and `GET /api/v1/health` returning `{ status: "ok", uptime }`. Both are public. Deploy this to Render before building anything else.

---

## 9. CI (GitHub Actions)

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push: { branches: [main] }

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: issue_tracker_test }
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s
          --health-timeout 5s --health-retries 10
    env:
      NODE_ENV: test
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/issue_tracker_test
      DATABASE_URL_TEST: postgresql://postgres:postgres@localhost:5432/issue_tracker_test
      JWT_ACCESS_SECRET: ci-only-secret-ci-only-secret-ci-only-secret
      CORS_ORIGINS: http://localhost:5173
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run db:migrate
      - run: npm test
      - run: npm run build
      - run: npm audit --omit=dev --audit-level=high
```

---

## 10. Troubleshooting

| Symptom                                             | Likely cause / fix                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Server exits at boot with a Zod error               | A required env var is missing/invalid — read the printed path                              |
| `ECONNREFUSED 5432` locally                         | `docker compose up -d` not running                                                         |
| Neon `SSL`/`timeout` errors on first request        | Compute was suspended; retry — keep-alive and pooled string reduce this                    |
| `Cannot find module './x'` after build              | Missing `.js` extension on a relative import                                               |
| Login works but refresh fails in production         | Cookie `Path`/`Secure` mismatch, or the frontend is not calling through the Vercel rewrite |
| All users hit the rate limit together               | `TRUST_PROXY_HOPS` wrong; log `req.ip` and adjust                                          |
| Render build fails on `drizzle-kit`/`tsc` not found | Build command must use `npm ci --include=dev`                                              |
