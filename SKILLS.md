# SKILLS.md – Backend Skills & Standards

Reusable patterns the backend must follow. Copy these shapes; do not invent new ones.

---

## 1. Skills Required

| Area       | Skill                                                               |
| ---------- | ------------------------------------------------------------------- |
| Language   | TypeScript 5 strict, ESM, async/await                               |
| Framework  | Express 5 middleware model                                          |
| Database   | PostgreSQL, Drizzle ORM schema, relations, transactions, migrations |
| Validation | Zod schemas, inferred types                                         |
| Auth       | JWT, refresh-token rotation, bcrypt, cookie flags                   |
| API design | REST, pagination, filtering, consistent envelopes, status codes     |
| Security   | OWASP Top 10, rate limiting, CORS, secure headers                   |
| Quality    | Vitest, Supertest, ESLint, Prettier, GitHub Actions                 |
| Ops        | Render and Neon deployment, env management, health checks           |

---

## 2. Core Library Code

### 2.1 `AppError` and error codes

```ts
// src/constants/error-codes.ts
export const ERROR_CODES = {
  VALIDATION_ERROR: { status: 400, message: 'Validation failed' },
  AUTH_INVALID_CREDENTIALS: { status: 401, message: 'Invalid email or password' },
  FORBIDDEN: { status: 403, message: 'You are not allowed to perform this action' },
  ISSUE_NOT_FOUND: { status: 404, message: 'Issue not found' },
  USER_EMAIL_TAKEN: { status: 409, message: 'An account with this email already exists' },
  // …every code from ARCHITECTURE.md
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
```

```ts
// src/lib/app-error.ts
import { ERROR_CODES, type ErrorCode } from '../constants/error-codes.js';

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    readonly details: unknown = null,
    message?: string,
  ) {
    super(message ?? ERROR_CODES[code].message);
    this.status = ERROR_CODES[code].status;
  }
}
```

### 2.2 Response helpers

```ts
// src/lib/respond.ts
import type { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const ok = <T>(res: Response, data: T) => res.status(200).json({ success: true, data });

export const created = <T>(res: Response, data: T) => res.status(201).json({ success: true, data });

export const paginated = <T>(res: Response, data: T[], meta: PageMeta) =>
  res.status(200).json({ success: true, data, meta });

export const noContent = (res: Response) => res.status(204).send();
```

### 2.3 Environment validation

```ts
// src/config/env.ts
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  DB_POOL_MAX: z.coerce.number().default(5),
  JWT_ACCESS_SECRET: z.string().min(32, 'use at least 32 random characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_ISSUER: z.string().default('issue-tracker-api'),
  JWT_AUDIENCE: z.string().default('issue-tracker-web'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  BCRYPT_ROUNDS: z.coerce.number().min(10).default(12),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY_HOPS: z.coerce.number().default(0),
  // …rate limit + seed vars (see SETUP.md)
});

export const env = schema.parse(process.env); // throws at boot if invalid
```

### 2.4 `validate` middleware

```ts
// src/middleware/validate.ts
import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    // ZodError is converted to VALIDATION_ERROR by the error handler
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.query)
      Object.defineProperty(req, 'query', {
        value: schemas.query.parse(req.query),
        writable: true,
      });
    next();
  };
```

> Express 5 makes `req.query` a getter, hence `defineProperty`.

### 2.5 `authenticate` / `authorize`

```ts
// src/middleware/authenticate.ts   (outline)
// 1. read "Authorization: Bearer <jwt>"           → else AUTH_TOKEN_MISSING
// 2. jwt.verify(token, secret, { algorithms: ['HS256'], issuer, audience })
//      TokenExpiredError → AUTH_TOKEN_EXPIRED, other → AUTH_TOKEN_INVALID
// 3. load user by `sub`; missing → AUTH_TOKEN_INVALID; !is_active → AUTH_ACCOUNT_DISABLED
// 4. req.user = { id, role, name, email }

// src/middleware/authorize.ts
export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw new AppError('FORBIDDEN');
    next();
  };
```

---

## 3. Module Template (Feature Pattern)

Using **issues → change status** as the worked example.

### 3.1 Schema

```ts
// issues.schemas.ts
import { z } from 'zod';
import { ISSUE_STATUS } from '../../constants/issue.js';

export const issueIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const changeStatusSchema = z
  .object({ status: z.enum(Object.values(ISSUE_STATUS) as [string, ...string[]]) })
  .strict();

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
```

### 3.2 Policy (pure)

```ts
// issues.policy.ts
import type { AuthUser } from '../../types/auth.js';
import type { IssueRow } from './issues.types.js';

export const isAdmin = (u: AuthUser) => u.role === 'ADMIN';

export const canChangeStatus = (u: AuthUser, issue: IssueRow) =>
  isAdmin(u) || issue.reporterId === u.id || issue.assigneeId === u.id;

export const canEditIssue = (u: AuthUser, issue: IssueRow) =>
  isAdmin(u) || issue.reporterId === u.id;
```

### 3.3 Service (rules + queries + transaction)

```ts
// issues.service.ts
export async function changeStatus(user: AuthUser, id: string, next: IssueStatus) {
  return db.transaction(async (tx) => {
    const [issue] = await tx
      .select()
      .from(issues)
      .where(and(eq(issues.id, id), notDeleted(issues)))
      .for('update');
    if (!issue) throw new AppError('ISSUE_NOT_FOUND');
    if (!canChangeStatus(user, issue)) throw new AppError('FORBIDDEN');
    if (issue.status === next) throw new AppError('ISSUE_STATUS_UNCHANGED');

    const [updated] = await tx
      .update(issues)
      .set({
        status: next,
        closedAt: next === 'CLOSED' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, id))
      .returning();

    await recordActivity(tx, {
      issueId: id,
      actorId: user.id,
      type: 'STATUS_CHANGED',
      from: issue.status,
      to: next,
    });
    return updated;
  });
}
```

### 3.4 Controller (thin)

```ts
// issues.controller.ts
export const changeStatus = async (req: Request, res: Response) => {
  const issue = await issuesService.changeStatus(req.user!, req.params.id, req.body.status);
  ok(res, issue);
};
```

### 3.5 Route

```ts
// issues.routes.ts
const router = Router();

router.patch(
  '/:id/status',
  authenticate,
  validate({ params: issueIdParamsSchema, body: changeStatusSchema }),
  issuesController.changeStatus,
);

export default router;
```

### 3.6 Register in `app.ts`

```ts
app.use('/api/v1/issues', issuesRouter);
```

---

## 4. Drizzle Patterns

### 4.1 Table with soft delete and partial index

```ts
export const issues = pgTable(
  'issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issueNumber: integer('issue_number').generatedAlwaysAsIdentity().notNull().unique(),
    title: varchar('title', { length: 150 }).notNull(),
    description: text('description').notNull().default(''),
    status: issueStatus('status').notNull().default('OPEN'),
    priority: issuePriority('priority').notNull().default('MEDIUM'),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('issues_status_idx')
      .on(t.status)
      .where(sql`${t.deletedAt} IS NULL`),
    index('issues_assignee_idx')
      .on(t.assigneeId)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);
```

### 4.2 `notDeleted` helper

```ts
export const notDeleted = (table: { deletedAt: AnyPgColumn }) => isNull(table.deletedAt);
```

### 4.3 Dynamic filters (list endpoint)

```ts
const conditions = [notDeleted(issues)];
if (q.status) conditions.push(eq(issues.status, q.status));
if (q.priority) conditions.push(eq(issues.priority, q.priority));
if (q.assigneeId) conditions.push(eq(issues.assigneeId, q.assigneeId));
if (q.unassigned) conditions.push(isNull(issues.assigneeId));
if (q.q) {
  const like = `%${escapeLike(q.q)}%`;
  conditions.push(or(ilike(issues.title, like), ilike(issues.description, like))!);
}
const where = and(...conditions);
```

Run the `count(*)` and the page query with the **same** `where`, in `Promise.all`.

### 4.4 Dashboard counts in one query

```ts
const rows = await db
  .select({ status: issues.status, count: sql<number>`count(*)::int` })
  .from(issues)
  .where(notDeleted(issues))
  .groupBy(issues.status);
```

### 4.5 Migrations

```bash
# after editing src/db/schema/*
npm run db:generate -- --name add_priority_to_issues
npm run db:migrate
```

Commit the generated SQL. In CI and on Render run `db:migrate:prod`.

---

## 5. Authentication Patterns

### 5.1 Password rules (Zod)

```ts
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters') // bcrypt ignores bytes past 72
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/\d/, 'Include a number');
```

### 5.2 Constant-time-ish login

```ts
const user = await findUserByEmail(email.toLowerCase());
const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
if (!user || !ok) throw new AppError('AUTH_INVALID_CREDENTIALS');
if (!user.isActive) throw new AppError('AUTH_ACCOUNT_DISABLED');
```

### 5.3 Refresh token issue / rotate

```ts
import { randomBytes, createHash } from 'node:crypto';

const newToken = () => randomBytes(32).toString('base64url');
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

// issue: store hash + expiry, send raw token as cookie
// rotate: find by hash →
//    missing/expired            → AUTH_REFRESH_INVALID
//    revoked_at not null        → revoke ALL user's active tokens, AUTH_REFRESH_REUSED
//    ok                         → mark revoked + replaced_by, insert new, set new cookie
```

### 5.4 Cookie options

```ts
res.cookie('refresh_token', token, {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/v1/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});
```

---

## 6. App Bootstrap Order (`app.ts`)

```ts
const app = express();
app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.disable('x-powered-by');

app.use(requestId);
app.use(pinoHttp({ logger, genReqId: (req) => req.id, redact: [...] }));
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(globalLimiter);

app.use('/api/v1', healthRouter);
app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/issues', issuesRouter);
app.use('/api/v1', commentsRouter);          // /issues/:id/comments and /comments/:id
app.use('/api/v1/dashboard', dashboardRouter);

app.use(notFound);
app.use(errorHandler);
export default app;
```

`server.ts` calls `app.listen`, and on `SIGTERM`/`SIGINT` stops accepting connections, waits for in-flight requests, closes the pg pool, then exits.

---

## 7. Testing Patterns

```ts
// tests/integration/issues.test.ts
import request from 'supertest';
import app from '../../src/app.js';

it("rejects a normal user editing someone else's issue", async () => {
  const { token } = await loginAs(userB);
  const res = await request(app)
    .patch(`/api/v1/issues/${issueOfUserA.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'hijack' });

  expect(res.status).toBe(403);
  expect(res.body.error.code).toBe('FORBIDDEN');
});
```

Policy tests are table-driven:

```ts
it.each([
  ['admin', adminUser, issueByA, true],
  ['reporter', userA, issueByA, true],
  ['other', userB, issueByA, false],
])('canEditIssue: %s', (_n, user, issue, expected) => {
  expect(canEditIssue(user, issue)).toBe(expected);
});
```

Minimum integration coverage: register/login/refresh/logout, admin-login rejection of USER, CRUD + permissions on issues, status/assign flow, comments ownership, dashboard counts, admin user guards (self / last admin).

---

## 8. API Quality Checklist (per endpoint)

- [ ] Zod schema for body/query/params, `.strict()` on bodies
- [ ] `authenticate` (and `authorize`) present unless public
- [ ] Policy check for resource access
- [ ] Soft-deleted rows excluded
- [ ] Pagination on lists, max 50
- [ ] Uses `respond.*` and `AppError`
- [ ] Activity record written for issue mutations
- [ ] Integration test: success, 400, 401, 403/404
- [ ] Documented in `README.md`

---

## 9. Performance & Scalability Mindset

- Paginate everything; select only needed columns on lists.
- Index what you filter and join on; verify with `EXPLAIN` if a query looks slow.
- Keep the pool small (Neon limits connections) and use the pooled connection string.
- Keep modules independent so features can be extracted or extended without ripple effects.

---

## 10. Don'ts

- Don't put business logic in controllers or routes.
- Don't read `process.env` outside `env.ts`.
- Don't use `any`, `@ts-ignore` without a reason, or `console.log`.
- Don't hard-delete issues or comments.
- Don't return different errors for "unknown email" vs "wrong password".
- Don't accept `role`, `id`, `reporterId` or `status` fields where the client must not set them.
- Don't edit an applied migration or run `drizzle-kit push` in production.
- Don't build SQL by string concatenation.
- Don't leave a new endpoint undocumented or untested.
