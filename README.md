# DECODE

DECODE helps beginners learn HTML, CSS, and JavaScript through structured courses, theory lessons, quizzes, coding labs, and guided projects. Students keep account-backed learning records; a designated instructor authors and publishes curriculum and reviews workshop source submissions.

**Current review:** 27 October 2026, source commit `59614ec`. Start AI coding work with [AGENTS.md](AGENTS.md). See [project status](docs/PROJECT-STATUS.md) for evidence and limits.

## Features and roles

| Role | Current capability |
| --- | --- |
| Student | Dashboard, published curriculum, lessons/practice, server-graded quizzes, browser-checked labs, workshop source submissions/feedback, playground, progress, browser-local profile preferences |
| Instructor | Protected workspace, courses/modules/activities, Theory/Quiz/Lab/Workshop editors, draft saves, immutable course publication, student insights, real submission review and source download |
| Admin | Frontend exists on unmerged `feature/admin-dashboard`; absent from this checkout. ADMIN authentication and all admin backend integrations remain pending. |

Email/password registration and cookie sessions work across the connected frontend/backend. Google sign-in and password recovery are unavailable. Labs are not secure server grading; workshop delivery currently sends saved source code, not uploaded archives. [Roles and feature status](docs/ROLES-AND-FEATURES.md) describes these distinctions.

## Stack and layout

- Frontend: Next.js 16.4.2 App Router, React 19.3, TypeScript, Tailwind CSS 4/scoped CSS, Monaco and Emmet.
- Backend: NestJS 12 / Express, Prisma 7.10 with the PostgreSQL adapter, PostgreSQL, salted-scrypt passwords and opaque cookie sessions.
- Tests: Node test runner + JSDOM/esbuild on the frontend; Vitest + Supertest on the backend, plus explicit live/database integration scripts.

```text
frontend/app/             Routes, components, domain and API adapters
frontend/tests/           Frontend behavior and regression tests
backend/src/             NestJS auth, learning and health services/controllers
backend/prisma/          Active schema and committed migrations
backend/test/            HTTP, live auth and PostgreSQL workflow tests
docs/                    Current project documentation
```

The root package has no scripts or workspace configuration. Install and run the two packages separately. Backend builds also need installed frontend dependencies to bundle shared learning rules.

## Prerequisites

- Git, npm, and Node.js compatible with both dependency trees. Node 24 is a suitable common baseline; the reviewed environment used Node 24.17.0 / npm 11.13.0. Installed Prisma declares `^20.19 || ^22.12 || >=24.0`; inspect lockfiles/runtime requirements when upgrading.
- A running PostgreSQL instance and a developer-owned database. pgAdmin4 is optional; [local database setup](backend/prisma/README.md) retains its setup instructions.
- Network access for dependency installation and Google Fonts during frontend production builds.

## Local setup

From the repository root, install frontend dependencies first:

```powershell
cd frontend
npm ci
if (!(Test-Path -LiteralPath .env.local)) { Copy-Item .env.example .env.local }
cd ../backend
npm ci
if (!(Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
```

Copy examples only when the target local file does not already exist; preserve existing settings. Configure the variable names below with your own local values. Create the database before applying migrations. Never commit environment secrets.

### Environment configuration

| File/scope | Variable names | Purpose |
| --- | --- | --- |
| `frontend/.env.local` | `API_URL` | Server-side backend origin, used by API rewrite and server session checks; no trailing slash |
| `backend/.env` | `DATABASE_URL` | Private PostgreSQL datasource used by Prisma configuration/runtime |
| `backend/.env` | `PORT` | Backend listener; default is port 4000 |
| `backend/.env` | `FRONTEND_URL` | Primary allowed frontend origin; default frontend port is 3000 |
| `backend/.env` | `FRONTEND_ORIGINS` | Optional comma-separated additional exact allowed origins |
| Explicit instructor provisioning only | `INSTRUCTOR_BOOTSTRAP_PASSWORD` | Owner-supplied bootstrap secret; remove after use |
| Runtime | `NODE_ENV` | Production cookie security and origin-policy behavior |

No public frontend secret or JWT-signing variable is required. Restart applications after environment changes. Origin values must be HTTP(S) origins without paths, credentials, queries, or fragments. Nonproduction loopback setups accept ports 3000, 3001, and 3100; production uses configured exact origins.

### Database and Prisma Client

From `backend/`, with the intended local database configured:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run prisma:status
npm run prisma:deploy
```

`prisma:deploy` applies committed migrations without a shadow database; inspect the target and pending migrations first. It does not reset data. For an intentional schema change in a development database, use `npm run prisma:migrate -- --name describe_change`, inspect the generated SQL, and commit the schema/migration together through review. Stop if Prisma proposes a reset. [Backend migration guidance](docs/BACKEND-GUIDE.md#migrations-and-seeding) covers custom database constraints.

There is no `prisma db seed` configuration. The designated instructor can be provisioned explicitly with `npm run instructor:provision` after the owner supplies the bootstrap variable locally; see [authentication setup](backend/AUTH.md). Instructor workspace access/catalog delivery initializes baseline course snapshots when that account exists. Registration creates ordinary students, with no demo password.

### Development servers

Use two terminals:

```powershell
# Terminal 1, from backend/
npm run start:dev
```

```powershell
# Terminal 2, from frontend/
npm run dev
```

Visit the frontend on port 3000 (`/register`, `/login`). The frontend proxies `/api/*` to NestJS on port 4000 by default. Students open `/dashboard`; the authenticated designated instructor opens `/instructor`. `/login/success` is a compatibility redirect after session verification.

`GET /api/health` checks API liveness; `GET /api/health/database` checks that Prisma can query `users`. It does not prove all learning migrations are applied: also check migration status. PostgreSQL connects lazily.

For compiled operation, run `npm run build` in each package, then `npm start` in `frontend/` and `npm run start:prod` in `backend/`. Backend `prebuild` bundles shared learning code and generates Prisma Client. Deploy `backend/domain/learning.cjs` together with `backend/dist/`; a standalone copy of `dist/` is insufficient. The repository has no verified production hosting pipeline.

## Tests and checks

Run in the corresponding package directory:

| Directory | Commands | Scope |
| --- | --- | --- |
| `frontend/` | `npm test`, `npm run lint`, `npm run build` | Node/JSDOM behavior suite, ESLint, Next production validation |
| `backend/` | `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build` | Vitest unit suite, mocked Prisma HTTP suite, oxlint, Nest build |
| `backend/` | `npm run prisma:validate`, `npm run prisma:status` | Schema validation; migration state against configured database |
| `backend/` | `npm run test:auth:live` | Requires both apps/database; creates then removes a temporary test account |
| `backend/` | `npm run test:learning:integration` | Builds backend, creates a disposable PostgreSQL schema, applies SQL, tests connected workflows, then drops only that schema |

Use an approved local test database for mutating integration scripts; never reset the working database to run tests. The HTTP `test:e2e` suite uses test doubles and does not establish real PostgreSQL readiness. Frontend UI tests do not certify real browser layout or iframe isolation. Current run results and unrun checks are in [project status](docs/PROJECT-STATUS.md#testing-status). On Windows, `npm.cmd` avoids PowerShell script-policy issues.

## Documentation index

| Guide | Read for |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Agent entry point, invariants, safety and Git rules |
| [Project architecture](docs/PROJECT-ARCHITECTURE.md) | System boundaries, session and learning flows |
| [Frontend guide](docs/FRONTEND-GUIDE.md) | Routes, design system, providers, exact change locations |
| [Backend guide](docs/BACKEND-GUIDE.md) | Controllers, all implemented endpoints/contracts, schema and migrations |
| [Roles and features](docs/ROLES-AND-FEATURES.md) | Implemented, partial, local-only, and deferred capabilities |
| [Development workflow](docs/DEVELOPMENT-WORKFLOW.md) | Commands, branches, PRs, API handoffs, safe migrations |
| [Project status](docs/PROJECT-STATUS.md) | Review evidence, limitations, documentation discrepancies, priorities |
| [Connected learning implementation](backend/docs/learning-workflow.md) | Earlier connected-workflow narrative; current code wins where it differs |
| [Authentication setup](backend/AUTH.md) / [database setup](backend/prisma/README.md) | Focused local setup and authentication checks |

Files in `frontend/docs/` are historical stage reports. `backend/docs/stage-5e/` is an unselected schema/API proposal; its normalized models and proposed routes are not the active implementation. Admin reports exist only on the separate branch, inspectable with `git show feature/admin-dashboard:docs/admin-dashboard-implementation.md`; see [Admin evidence](docs/PROJECT-STATUS.md#deferred-admin-dashboard).
